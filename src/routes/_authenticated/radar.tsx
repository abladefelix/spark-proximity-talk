import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { toast } from "sonner";
import {
  Zap,
  Check,
  LoaderCircle,
  Ban,
  Flag,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/PersonAvatar";

import { VerifiedBadge } from "@/components/VerifiedBadge";
import { SuspendedGate } from "@/components/SuspendedGate";
import { IncomingSignals } from "@/components/IncomingSignals";
import { ActiveChats } from "@/components/ActiveChats";
import { useChatSheet } from "@/components/ChatSheet";
import { sendPushNotification } from "@/lib/push-notifications.functions";

import { Brand, BrandMark } from "@/components/Brand";
import { DEFAULT_MAX_RADIUS, MIN_RADIUS, useMaxRadius } from "@/hooks/useMaxRadius";
import { useSettings } from "@/hooks/useAppSettings";





export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({
    meta: [
      { title: "Radar — Who's around you on SkanAround" },
      {
        name: "description",
        content:
          "See people sharing your spot right now, send a signal and unlock the chat when it's mutual.",
      },
      { property: "og:title", content: "SkanAround Radar" },
      { property: "og:description", content: "People near you, right now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SuspendedGate>
      <RadarPage />
    </SuspendedGate>
  ),
});


type NearbyPerson = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  distance_m: number;
  i_signaled: boolean;
  they_signaled: boolean;
  match_id: string | null;
  verified: boolean;
  is_online: boolean;
  gender: "male" | "female" | "other" | null;
};

function formatDistance(m: number) {
  return m < 950 ? `${Math.max(1, Math.round(m))} m away` : `${(m / 1000).toFixed(1)} km away`;
}

function genderToken(gender: NearbyPerson["gender"]) {
  if (gender === "male") return "gender-male";
  if (gender === "female") return "gender-female";
  return "gender-other";
}


function RadarPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { openChat } = useChatSheet();
  const sendPush = useServerFn(sendPushNotification);
  const queryClient = useQueryClient();
  const { data: maxRadius } = useMaxRadius();
  const settings = useSettings();
  const cap = maxRadius ?? DEFAULT_MAX_RADIUS;
  const [radiusPref, setRadiusPref] = useState(settings.default_radius_m);
  useEffect(() => {
    const saved = Number(localStorage.getItem("skan-radius") ?? "");
    if (Number.isFinite(saved) && saved > 0) setRadiusPref(saved);
    else setRadiusPref(settings.default_radius_m);
  }, [settings.default_radius_m]);
  const radius = Math.min(Math.max(radiusPref, MIN_RADIUS), cap);
  const [visible, setVisible] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [located, setLocated] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [askLocation, setAskLocation] = useState(false);
  const [permDenied, setPermDenied] = useState(false);



  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const lastCoords = useRef<{ latitude: number; longitude: number } | null>(null);
  const myIdRef = useRef<string | null>(user.id);

  // Keep my location fresh while the radar is open.

  useEffect(() => {
    if (askLocation) return;
    const isNative = Capacitor.isNativePlatform();
    if (!isNative && !("geolocation" in navigator)) {
      setGeoError("This device can't share location.");
      return;
    }

    let cancelled = false;
    let browserWatch: number | undefined;
    let nativeWatch: string | undefined;
    const push = async (coords: { latitude: number; longitude: number }) => {
      if (cancelled) return;
      lastCoords.current = { latitude: coords.latitude, longitude: coords.longitude };
      localStorage.setItem("skan-last-location", JSON.stringify(lastCoords.current));

      // Use the locally cached session: a network round-trip here (getUser)
      // can hang on flaky mobile networks and silently kill the heartbeat.
      let me = myIdRef.current;
      if (!me) {
        me = (await supabase.auth.getSession()).data.session?.user?.id ?? null;
        myIdRef.current = me;
      }
      if (!me) return;
      const { error } = await supabase.from("locations").upsert(
        {
          user_id: me,
          lat: coords.latitude,
          lng: coords.longitude,
          is_visible: visible,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) {
        setGeoError(error.message);
        return;
      }
      setGeoError(null);
      setLocated(true);
      queryClient.invalidateQueries({ queryKey: ["nearby"] });
    };

    // Do not leave the radar waiting for the native bridge. A previously
    // confirmed fix is safe to re-publish immediately while iOS gets a fresh
    // reading, and prevents a cold/resumed app from appearing offline.
    const cachedLocation = localStorage.getItem("skan-last-location");
    if (cachedLocation) {
      try {
        const parsed = JSON.parse(cachedLocation) as { latitude?: unknown; longitude?: unknown };
        if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
          void push({ latitude: parsed.latitude, longitude: parsed.longitude });
        }
      } catch {
        localStorage.removeItem("skan-last-location");
      }
    }
    const refreshFix = () => {
      if (isNative) {
        void Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          maximumAge: 60000,
          timeout: 30000,
        })
          .then((position) => push(position.coords))
          .catch(() => {
            // A remotely hosted Capacitor app can occasionally lose the native
            // plugin callback after resume. WKWebView location remains usable,
            // so fall back instead of silently letting presence expire.
            if ("geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition(
                (position) => void push(position.coords),
                () => {},
                { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
              );
            }
          });
      } else if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => void push(position.coords),
          () => {},
          { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
        );
      }
    };
    const fail = (denied: boolean, unavailable = false) => {
      if (cancelled) return;
      if (denied) {
        setPermDenied(true);
        setAskLocation(true);
        setGeoError("Location permission is off. Turn it on to see who's around.");
        return;
      }
      if (unavailable) setGeoError("Turn on Location Services to use the radar.");
    };

    void (async () => {
      if (isNative) {
        // Start the WKWebView provider in parallel. Capacitor's permission or
        // position promise can remain pending after an iOS resume; waiting for
        // it used to prevent both presence updates and nearby queries.
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => void push(position.coords),
            () => {},
            { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 },
          );
          browserWatch = navigator.geolocation.watchPosition(
            (position) => void push(position.coords),
            () => {},
            { enableHighAccuracy: false, maximumAge: 300000, timeout: 30000 },
          );
        }
        try {
          let permission = await Geolocation.checkPermissions();
          if (permission.location === "prompt" || permission.location === "prompt-with-rationale") {
            permission = await Geolocation.requestPermissions();
          }
          if (permission.location !== "granted") {
            fail(true);
            return;
          }

          setAskLocation(false);
          setPermDenied(false);
          nativeWatch = await Geolocation.watchPosition(
            { enableHighAccuracy: true, maximumAge: 300000, timeout: 60000 },
            (position, error) => {
              if (position) void push(position.coords);
              else if (error) {
                const denied = error.code === "OS-PLUG-GLOC-0003";
                const unavailable = error.code === "OS-PLUG-GLOC-0007";
                fail(denied, unavailable);
              }
            },
          );
          if (cancelled && nativeWatch) void Geolocation.clearWatch({ id: nativeWatch });

          // A cached fix makes startup instant when available. A timeout here is
          // not an error: the watcher above remains active until iOS gets a fix.
          try {
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              maximumAge: 300000,
              timeout: 60000,
            });
            await push(position.coords);
          } catch {
            // Keep the native watcher, but also start the WebView provider. On
            // iOS it can recover when a plugin callback is lost after resume.
            if ("geolocation" in navigator && browserWatch === undefined) {
              navigator.geolocation.getCurrentPosition(
                (position) => void push(position.coords),
                () => {},
                { enableHighAccuracy: false, maximumAge: 300000, timeout: 30000 },
              );
              browserWatch = navigator.geolocation.watchPosition(
                (position) => void push(position.coords),
                () => {},
                { enableHighAccuracy: false, maximumAge: 300000, timeout: 60000 },
              );
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          fail(
            message.includes("permission") || message.includes("denied"),
            message.includes("location services") || message.includes("disabled"),
          );
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => void push(position.coords),
        (error) => fail(error.code === error.PERMISSION_DENIED, error.code === error.POSITION_UNAVAILABLE),
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 60000 },
      );
      browserWatch = navigator.geolocation.watchPosition(
        (position) => void push(position.coords),
        (error) => fail(error.code === error.PERMISSION_DENIED, error.code === error.POSITION_UNAVAILABLE),
        { enableHighAccuracy: true, maximumAge: 300000, timeout: 60000 },
      );
    })();

    // Stationary phones stop emitting position updates, which would make the
    // user look offline to everyone else. Re-publish the last fix periodically,
    // and ask for a fresh one when the watcher never delivered anything.
    const heartbeat = setInterval(() => {
      const coords = lastCoords.current;
      if (coords) void push(coords);
      else refreshFix();
    }, 20000);

    // Backgrounded tabs and suspended apps stop the heartbeat, so the person
    // goes stale for everyone else. Re-publish (and refresh) on foreground.
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      const coords = lastCoords.current;
      if (coords) void push(coords);
      refreshFix();
      queryClient.invalidateQueries({ queryKey: ["nearby"] });
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);
    window.addEventListener("online", onWake);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
      window.removeEventListener("online", onWake);
      if (browserWatch !== undefined) navigator.geolocation.clearWatch(browserWatch);
      if (nativeWatch) void Geolocation.clearWatch({ id: nativeWatch });
    };
  }, [visible, queryClient, retryKey, askLocation]);





  // Stale signal cleanup is a staff-only maintenance routine (see admin panel).



  const nearby = useQuery({
    queryKey: ["nearby", radius],
    // Runs even before our own fix lands: the server falls back to the last
    // published location, so the radar is never blank just because the
    // device watcher is slow.
    enabled: true,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,

    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_people", { radius_m: radius });
      if (error) throw error;
      return (data ?? []) as NearbyPerson[];
    },
  });

  const signal = useMutation({
    mutationFn: async (person: NearbyPerson) => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) throw new Error("Not signed in");
      const { error } = await supabase
        .from("signals")
        .insert({ from_user: me, to_user: person.id });
      if (error) throw error;
      return person;
    },
    onSuccess: async (person) => {
      const { data } = await supabase.rpc("nearby_people", { radius_m: radius });
      queryClient.setQueryData(["nearby", radius], data ?? []);
      const updated = ((data ?? []) as NearbyPerson[]).find((p) => p.id === person.id);
      setSelectedId(null);
      if (updated?.match_id) {
        toast.success(`It's mutual with @${person.username}! Chat unlocked.`);
        openChat(updated.match_id);
      } else {
        toast.success(`Signal sent to @${person.username} — expires in 6 hours`);
        await sendPush({
          data: {
            kind: "signal",
            recipientId: person.id,
            title: person.display_name ?? `@${person.username}`,
            body: "wants to chat on SkanAround",
          },
        }).catch(() => {
          /* push failure is non-fatal */
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send signal"),
  });


  const people = nearby.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const selected = people.find((p) => p.id === selectedId) ?? null;

  async function blockPerson(person: NearbyPerson) {
    const me = (await supabase.auth.getUser()).data.user?.id;
    if (!me) return;
    const { error } = await supabase.from("blocks").insert({ blocker: me, blocked: person.id });
    if (error) {
      toast.error("Couldn't block");
      return;
    }
    setSelectedId(null);
    toast.success(`@${person.username} blocked`);
    queryClient.invalidateQueries({ queryKey: ["nearby"] });
    queryClient.invalidateQueries({ queryKey: ["blocked"] });
  }

  async function reportPerson(person: NearbyPerson) {
    const me = (await supabase.auth.getUser()).data.user?.id;
    if (!me || !reason.trim()) return;
    const { error } = await supabase
      .from("reports")
      .insert({ reporter: me, reported: person.id, reason: reason.trim() });
    if (error) {
      toast.error("Couldn't send report");
      return;
    }
    setReason("");
    setReporting(false);
    toast.success("Report sent. Thanks for keeping SkanAround safe.");
  }

  const scopeRef = useRef<HTMLElement | null>(null);
  const [scopeSize, setScopeSize] = useState(0);
  useEffect(() => {
    const el = scopeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setScopeSize(entry.contentRect.width);
    });
    ro.observe(el);
    setScopeSize(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Auto-fitting layout: zooms the scope to the furthest person, scales beacon
  // size with crowd density and pushes overlapping beacons apart.
  const { beacons, beaconSize } = useMemo(() => {
    const scope = scopeSize || 320;
    const count = people.length;
    const size = Math.max(
      18,
      Math.min(44, Math.round(scope / (4.2 + Math.sqrt(Math.max(count, 1)) * 1.5))),
    );
    const maxDist = people.reduce((m, p) => Math.max(m, p.distance_m), 0);
    const viewMax = Math.max(25, Math.min(radius, maxDist * 1.15));
    const limit = scope * 0.46 - size / 2;

    const nodes = people.map((person) => {
      let hash = 0;
      for (let i = 0; i < person.id.length; i++) hash = (hash * 31 + person.id.charCodeAt(i)) | 0;
      const angle = ((hash >>> 0) % 360) * (Math.PI / 180);
      const rr = Math.min(1, person.distance_m / viewMax) * limit;
      return { person, x: Math.cos(angle) * rr, y: Math.sin(angle) * rr };
    });

    const minGap = size + 6;
    for (let iter = 0; iter < 80; iter++) {
      let moved = false;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d === 0) {
            dx = Math.cos(i * 2.4) * 0.01;
            dy = Math.sin(i * 2.4) * 0.01;
            d = 0.01;
          }
          if (d < minGap) {
            const push = (minGap - d) / 2;
            const ux = dx / d;
            const uy = dy / d;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
            moved = true;
          }
        }
      }
      for (const n of nodes) {
        const d = Math.hypot(n.x, n.y);
        if (d > limit) {
          n.x = (n.x / d) * limit;
          n.y = (n.y / d) * limit;
        }
      }
      if (!moved) break;
    }

    return {
      beaconSize: size,
      beacons: nodes.map((n) => ({
        person: n.person,
        left: `calc(50% + ${n.x}px)`,
        top: `calc(50% + ${n.y}px)`,
      })),
    };
  }, [people, scopeSize, radius]);

  // ---- Zoom & pan on the radar scope -------------------------------------
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 6;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  viewRef.current = { zoom, pan };

  const clampPan = (z: number, p: { x: number; y: number }) => {
    const scope = scopeSize || 320;
    const slack = (scope * (z - 1)) / 2 + scope * 0.08 * (z - 1);
    return {
      x: Math.max(-slack, Math.min(slack, p.x)),
      y: Math.max(-slack, Math.min(slack, p.y)),
    };
  };

  const zoomAt = (nextZoomRaw: number, px: number, py: number) => {
    const { zoom: z, pan: p } = viewRef.current;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoomRaw));
    if (next === z) return;
    const k = next / z;
    // Anchor the point under the cursor. Transform is translate(pan) scale(z)
    // about the scope centre.
    const c = (scopeSize || 320) / 2;
    const ax = px - c;
    const ay = py - c;
    const nextPan = { x: ax - (ax - p.x) * k, y: ay - (ay - p.y) * k };
    setZoom(next);
    setPan(next <= 1.001 ? { x: 0, y: 0 } : clampPan(next, nextPan));
  };
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = scopeRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Let the page scroll normally unless the user is deliberately zooming.
      if (!e.ctrlKey && viewRef.current.zoom <= 1.001) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      const { zoom: z } = viewRef.current;
      zoomAtRef.current(z * Math.exp(-dy * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Pointer drag to pan, two-finger pinch to zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number } | null>(null);
  const dragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    // Only capture when a gesture is actually possible, so vertical page
    // scrolling keeps working at the default zoom level.
    if (viewRef.current.zoom > 1.001 || pointers.current.size > 1) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const el = scopeRef.current;
    if (pts.length >= 2 && el) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (!gesture.current) gesture.current = { dist, zoom: viewRef.current.zoom };
      const rect = el.getBoundingClientRect();
      zoomAtRef.current(
        gesture.current.zoom * (dist / gesture.current.dist),
        (a.x + b.x) / 2 - rect.left,
        (a.y + b.y) / 2 - rect.top,
      );
      dragged.current = true;
      return;
    }
    if (viewRef.current.zoom <= 1.001) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) dragged.current = true;
    setPan((p) => clampPan(viewRef.current.zoom, { x: p.x + dx, y: p.y + dy }));
  };
  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };


  return (
    <main data-fixed-page className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden px-5 pt-3">
      <div className="flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Switch checked={visible} onCheckedChange={setVisible} aria-label="Visible on radar" />
          <span className="text-xs text-muted-foreground">{visible ? "Visible" : "Hidden"}</span>
        </div>
      </div>

      <ActiveChats />
      <IncomingSignals />



      <Dialog open={askLocation} onOpenChange={(o) => !o && setAskLocation(false)}>
        <DialogContent className="max-w-xs rounded-3xl text-center">
          <DialogHeader className="items-center">
            <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="size-7 text-primary" />
            </span>
            <DialogTitle>Turn on location</DialogTitle>
            <DialogDescription>
              {permDenied
                ? "Location is blocked for this site. Enable it in your browser or phone settings, then tap Try again."
                : "SkanAround needs your location to show people around you. Only distance is ever shared — never your exact spot."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="heat"
              className="w-full"
              onClick={() => {
                setPermDenied(false);
                setAskLocation(false);
                setRetryKey((k) => k + 1);
              }}
            >
              {permDenied ? "Try again" : "Allow location"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setAskLocation(false)}>
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {geoError && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
          <span>{geoError}</span>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="shrink-0 rounded-full border border-border px-3 py-1 font-medium text-foreground"
          >
            Retry
          </button>
        </div>
      )}
      {!geoError && people.length === 0 && !nearby.isLoading && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {settings.empty_radar_text} Widen your scan range in your profile.
        </p>
      )}


      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
      <section
        ref={scopeRef}
        aria-label={geoError ?? "Radar"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        style={{
          touchAction: zoom > 1.001 ? "none" : "pan-y",
          cursor: zoom > 1.001 ? "grab" : "default",
        }}
        className="relative aspect-square size-[min(100%,24rem)] shrink-0 overflow-hidden rounded-full border border-border bg-secondary/20"
      >
        <div
          className="absolute inset-0 origin-center will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: gesture.current ? "none" : "transform 120ms ease-out",
          }}
        >
          <div className="radar-grid absolute inset-0" />
          <div className="absolute inset-[16%] rounded-full border border-border/70" />
          <div className="absolute inset-[33%] rounded-full border border-border/50" />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/40" />
          <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border/40" />
          <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          <span className="pulse-ring absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30" />
          <BrandMark
            size={80}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.12]"
          />

          {beacons.map(({ person, left, top }) => (
            <button
              key={person.id}
              type="button"
              onClick={() => {
                if (dragged.current) return;
                setSelectedId(person.id);
              }}
              style={{ left, top, opacity: person.is_online ? 1 : 0.5 }}
              aria-label={`${person.display_name ?? person.username}, ${formatDistance(person.distance_m)}${person.is_online ? ", active now" : ""}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 active:scale-90"
            >
              <span
                className="relative flex items-center justify-center"
                style={{ width: beaconSize, height: beaconSize }}
              >
                {(() => {
                  const token = genderToken(person.gender);
                  const glowClass = {
                    "gender-male": "bg-gender-male/30",
                    "gender-female": "bg-gender-female/30",
                    "gender-other": "bg-gender-other/30",
                  }[token];
                  const pingClass = {
                    "gender-male": "border-gender-male/60",
                    "gender-female": "border-gender-female/60",
                    "gender-other": "border-gender-other/60",
                  }[token];
                  const dotClass = {
                    "gender-male": "bg-gender-male text-gender-male",
                    "gender-female": "bg-gender-female text-gender-female",
                    "gender-other": "bg-gender-other text-gender-other",
                  }[token];
                  return (
                    <>
                      {/* soft glow pool */}
                      <span
                        aria-hidden
                        className={`absolute inset-0 rounded-full blur-md ${glowClass}`}
                      />
                      {/* ping for people who signaled you */}
                      {person.they_signaled && !person.match_id && (
                        <span
                          aria-hidden
                          className={`beacon-ping absolute inset-0 rounded-full border ${pingClass}`}
                        />
                      )}
                      {/* the dot */}
                      <span
                        className={`relative z-10 rounded-full ring-2 ring-background heartbeat-glow ${dotClass}`}
                        style={{ width: beaconSize * 0.42, height: beaconSize * 0.42 }}
                      />
                    </>
                  );
                })()}
              </span>

            </button>

          ))}
        </div>

        {settings.radar_sweep_enabled && (
          <div className="radar-sweep pointer-events-none absolute inset-0 rounded-full" />
        )}




        {nearby.isLoading && (
          <LoaderCircle className="absolute inset-x-0 bottom-[16%] mx-auto size-5 animate-spin text-muted-foreground" />
        )}
      </section>
      </div>



      <Dialog
        open={Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedId(null);
            setReporting(false);
            setReason("");
          }
        }}
      >
        <DialogContent className="max-w-xs rounded-3xl text-center">
          {selected && (
            <>
              <DialogHeader className="items-center">
                <PersonAvatar
                  path={selected.avatar_url}
                  name={selected.display_name}
                  username={selected.username}
                  gender={selected.gender}
                  className="size-28"
                />
                <DialogTitle className="mt-4 flex items-center gap-1.5 text-xl">
                  {selected.display_name ?? selected.username}
                  {selected.verified && <VerifiedBadge className="size-5" />}
                </DialogTitle>
                <DialogDescription>
                  @{selected.username} · {formatDistance(selected.distance_m)}
                  {selected.is_online ? " · active now" : ""}
                </DialogDescription>
              </DialogHeader>

              {selected.bio && (
                <p className="text-sm leading-relaxed text-muted-foreground">{selected.bio}</p>
              )}

              {reporting ? (
                <div className="space-y-3 text-left">
                  <Textarea
                    value={reason}
                    maxLength={500}
                    rows={3}
                    placeholder="What happened?"
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <DialogFooter className="flex-row gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setReporting(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="heat"
                      className="flex-1"
                      disabled={!reason.trim()}
                      onClick={() => void reportPerson(selected)}
                    >
                      Send report
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <>
                  {!settings.chat_enabled ? (
                    <Button variant="ghost" className="w-full" disabled>
                      Chat is off right now
                    </Button>
                  ) : selected.match_id ? (
                    <Button
                      variant="heat"
                      className="w-full"
                      onClick={() => openChat(selected.match_id as string)}
                    >
                      Chat
                    </Button>
                  ) : selected.i_signaled ? (
                    <Button variant="ghost" className="w-full" disabled>
                      <Check className="size-4" /> Signal sent
                    </Button>
                  ) : (
                    <Button
                      variant="heat"
                      className="w-full"
                      disabled={signal.isPending}
                      onClick={() => signal.mutate(selected)}
                    >
                      <Zap className="size-4" /> Signal
                    </Button>
                  )}

                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5"
                      onClick={() => void blockPerson(selected)}
                    >
                      <Ban className="size-3.5" /> Block
                    </button>
                    {settings.reports_enabled && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5"
                        onClick={() => setReporting(true)}
                      >
                        <Flag className="size-3.5" /> Report
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
