import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getManualPosition } from "@/lib/manual-location";
import { toast } from "sonner";
import { Zap, Check, LoaderCircle, Ban, Flag, MapPin, Compass, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/PersonAvatar";
import { GenderAvatarIcon } from "@/components/GenderAvatarIcon";

import { VerifiedBadge } from "@/components/VerifiedBadge";
import { SuspendedGate } from "@/components/SuspendedGate";
import { IncomingSignals } from "@/components/IncomingSignals";
import { useHelpBeacons } from "@/components/BatSignal";

import { IntentChip } from "@/components/IntentSheet";
import { useMyIntent } from "@/hooks/useIntent";
import { intentFor, helpKindFor } from "@/lib/intents";
import { ActiveChats } from "@/components/ActiveChats";
import { beaconColor } from "@/lib/beacon-styles";
import { useChatSheet } from "@/components/ChatSheet";
import { sendPushNotification } from "@/lib/push-notifications.functions";

import { Brand, BrandMark } from "@/components/Brand";
import { DEFAULT_MAX_RADIUS, MIN_RADIUS, useMaxRadius } from "@/hooks/useMaxRadius";
import { useSettings } from "@/hooks/useAppSettings";
import { useBillingInfo, useIsPro } from "@/hooks/useBilling";
import { useFeatureAccess, FEATURE } from "@/hooks/useProFeatures";
import { useRadarAlert } from "@/hooks/useRadarSound";
import { useCompassHeading, compassPoint } from "@/hooks/useCompassHeading";
import { withTimeout } from "@/lib/net";
import { nativeDebug, nativeDebugError } from "@/lib/native-debug";

export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({
    meta: [
      { title: "Radar — Who's around you on SKANAROUND" },
      {
        name: "description",
        content:
          "See people sharing your spot right now, send a signal and unlock the chat when it's mutual.",
      },
      { property: "og:title", content: "SKANAROUND Radar" },
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
  /** True compass bearing from me to them, 0 = north, clockwise. */
  bearing_deg?: number | null;
  /** Seconds since their location was last published. */
  updated_age_s?: number | null;
  /** Horizontal accuracy radius reported by their device. */
  accuracy_m?: number | null;
  /** Pro members get a priority beacon. */
  is_pro?: boolean | null;
  /** Pro members' chosen beacon colour (null unless they're Pro). */
  beacon_style?: string | null;
  /** What they're up to right now, and their one-line mood. */
  intent?: string | null;
  intent_note?: string | null;
  mood?: string | null;
};

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
  const { data: billing } = useBillingInfo();
  const isPro = useIsPro();
  const { has, isPaidFeature } = useFeatureAccess();
  const proPriorityOn = isPaidFeature(FEATURE.priorityBeacon);
  const adminCap = maxRadius ?? DEFAULT_MAX_RADIUS;
  // Free members are capped at the free-tier range while payments are live.
  const cap =
    billing?.enabled && !has(FEATURE.extendedRadius)
      ? Math.min(adminCap, billing.free_max_radius_m || adminCap)
      : adminCap;
  const [radiusPref, setRadiusPref] = useState(settings.default_radius_m);
  useEffect(() => {
    const saved = Number(localStorage.getItem("skan-radius") ?? "");
    if (Number.isFinite(saved) && saved > 0) setRadiusPref(saved);
    else setRadiusPref(settings.default_radius_m);
  }, [settings.default_radius_m]);
  const radius = Math.min(Math.max(radiusPref, MIN_RADIUS), cap);

  const [visible, setVisible] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [checkinUntil, setCheckinUntil] = useState<number | null>(null);
  const operation = useRef(0);
  const initialCheckout = useRef<PromiseLike<{ error: unknown }> | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [located, setLocated] = useState(false);

  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [accuracyM, setAccuracyM] = useState<number | null>(null);

  async function stopSharing() {
    operation.current += 1;
    setVisible(false);
    setCheckinUntil(null);
    const { error } = await supabase.rpc("end_location_checkin");
    if (error)
      setGeoError(
        "Could not confirm checkout. Retry; the server check-in expires automatically after 15 minutes.",
      );
  }

  async function locate(share: boolean) {
    if (locationBusy) return;
    const request = ++operation.current;
    setLocationBusy(true);
    setGeoError(null);
    try {
      const checkout = await initialCheckout.current;
      if (checkout?.error)
        throw new Error("Could not confirm your location is hidden. Reload and try again.");
      const coords = await getManualPosition();
      if (request !== operation.current || document.hidden) return;
      if (share) {
        const { data, error } = await supabase.rpc("begin_location_checkin", {
          _lat: coords.latitude,
          _lng: coords.longitude,
          _accuracy: coords.accuracy,
        });
        if (error) throw error;
        // If the app was backgrounded while the request was running, revoke
        // the newly-created lease rather than restoring visibility on return.
        if (request !== operation.current || document.hidden) {
          await supabase.rpc("end_location_checkin");
          return;
        }
        setVisible(true);
        setCheckinUntil(new Date(data).getTime());
      } else {
        const { error: checkoutError } = await supabase.rpc("end_location_checkin");
        if (checkoutError) throw checkoutError;
        setVisible(false);
        setCheckinUntil(null);
        const { error } = await supabase.from("locations").upsert({
          user_id: user.id,
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy_m: coords.accuracy,
          is_visible: false,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      setAccuracyM(coords.accuracy);
      setLocated(true);
      queryClient.invalidateQueries({ queryKey: ["nearby"] });
    } catch (error) {
      setGeoError(errorMessage(error, "Could not get location. Please try again."));
    } finally {
      setLocationBusy(false);
    }
  }

  useEffect(() => {
    // Never restore a previous session's check-in, including after a crash.
    initialCheckout.current = supabase.rpc("end_location_checkin").then((result) => result);
    const onHidden = () => {
      if (document.hidden) void stopSharing();
    };
    window.addEventListener("pagehide", stopSharing);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      operation.current += 1;
      void supabase.rpc("end_location_checkin");
      window.removeEventListener("pagehide", stopSharing);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  useEffect(() => {
    if (checkinUntil === null) return;
    const timer = window.setTimeout(
      () => void stopSharing(),
      Math.max(0, checkinUntil - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [checkinUntil]);

  // Stale signal cleanup is a staff-only maintenance routine (see admin panel).

  const nearby = useQuery({
    queryKey: ["nearby", radius],
    // Discovery can use our last private position; it never creates a check-in.
    enabled: true,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,

    queryFn: async () => {
      nativeDebug("nearby lookup started", { radius });
      const { data, error } = await supabase.rpc("nearby_people", { radius_m: radius });
      if (error) {
        nativeDebugError(
          "nearby lookup failed",
          new Error(`${error.code ?? "unknown"}: ${error.message}`),
        );
        throw error;
      }
      const count = data?.length ?? 0;
      nativeDebug("nearby lookup succeeded", { count });
      if (count === 0) {
        // Aggregate-only diagnostic (no names, ids, or coordinates) so an
        // empty radar can be traced to the exact failing condition on device.
        const probe = await (
          supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: { message: string } | null }>
        )("radar_self_check", { radius_m: radius });
        if (probe.error) {
          nativeDebugError("radar self check failed", new Error(probe.error.message));
        } else {
          const row = Array.isArray(probe.data) ? probe.data[0] : probe.data;
          nativeDebug("radar self check", (row ?? {}) as Record<string, unknown>);
        }
      }
      return (data ?? []) as NearbyPerson[];
    },
  });

  const { data: myIntent } = useMyIntent();

  const signal = useMutation({
    mutationFn: async (person: NearbyPerson) => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) throw new Error("Not signed in");
      const result = await withTimeout<{ error: { message: string } | null }>(
        (supabase as any).from("signals").upsert(
          {
            from_user: me,
            to_user: person.id,
            intent: myIntent?.intent ?? null,
            intent_note: myIntent?.intent_note ?? null,
            created_at: new Date().toISOString(),
            expires_at: new Date(
              Date.now() + (settings.signal_expiry_hours || 6) * 3_600_000,
            ).toISOString(),
          },
          { onConflict: "from_user,to_user" },
        ),
        10_000,
        "Signal",
      );
      if (result.error) throw result.error;
      return person;
    },
    onSuccess: async (person) => {
      setSelectedId(null);
      let updated: NearbyPerson | undefined;
      try {
        const { data, error } = await withTimeout(
          supabase.rpc("nearby_people", { radius_m: radius }),
          8_000,
          "Radar refresh",
        );
        if (error) throw error;
        queryClient.setQueryData(["nearby", radius], data ?? []);
        updated = ((data ?? []) as NearbyPerson[]).find((p) => p.id === person.id);
      } catch {
        void queryClient.invalidateQueries({ queryKey: ["nearby"] });
      }
      if (updated?.match_id) {
        toast.success(`It's mutual with @${person.username}! Chat unlocked.`);
        const mutualMatchId = updated.match_id;
        setSelectedId(null);
        setTimeout(() => openChat(mutualMatchId), 0);
      } else {
        toast.success(`Signal sent to @${person.username} — expires in 6 hours`);
        await sendPush({
          data: {
            kind: "signal",
            recipientId: person.id,
            title: person.display_name ?? `@${person.username}`,
            body: "wants to chat on SKANAROUND",
          },
        }).catch(() => {
          /* push failure is non-fatal */
        });
      }
    },
    onError: (e) => toast.error(errorMessage(e, "Could not send signal")),
  });

  // nearby_people already applies the server's presence grace window. Keep
  // those rows on the scope when a phone briefly suspends its heartbeat;
  // is_online is presentation state, not a second visibility filter.
  const people = nearby.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Optional alert tone whenever somebody new shows up on the scope.
  const playRadarAlert = useRadarAlert();
  const seenIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(people.map((p) => p.id));
    const seen = seenIdsRef.current;
    seenIdsRef.current = ids;
    if (!seen) return; // first load: don't chirp for everyone already there
    for (const id of ids) {
      if (!seen.has(id)) {
        playRadarAlert();
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

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
    toast.success("Report sent. Thanks for keeping SKANAROUND safe.");
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

  const [zoom, setZoom] = useState(1);

  // Live compass. In heading-up mode the whole scope counter-rotates with the
  // phone, so the top of the radar is literally the way you are facing.
  // Compass is opt-in. Starting the sensor during radar mount caused an Android
  // permission prompt before the person had chosen to use heading-up mode.
  const [headingUp, setHeadingUp] = useState(false);
  const toggleHeadingUp = () => setHeadingUp((value) => !value);
  const {
    heading,
    needsPermission,
    request: requestCompass,
    calibrating,
    unavailable: compassUnavailable,
  } = useCompassHeading(headingUp);
  const compassActive = headingUp && heading != null;
  const compassCalibrating = headingUp && calibrating && !compassUnavailable;
  const rot = compassActive ? -(heading as number) : 0;

  // Auto-fitting layout. Beacons keep a constant on-screen size and gap, so
  // pinching to zoom genuinely expands the map and pulls crowded people apart
  // instead of stacking them.
  const { beacons, beaconSize, markerScale } = useMemo(() => {
    const scope = scopeSize || 320;
    const count = people.length;
    const z = zoom;
    // Markers shrink as the crowd grows so far more people fit before we have
    // to de-crowd, with a floor that keeps them tappable.
    const base = Math.max(
      14,
      Math.min(40, Math.round(scope / (4.6 + Math.sqrt(Math.max(count, 1)) * 2.1))),
    );
    // Pinching resizes the beacons themselves — the radar disc never moves.
    const size = base;
    const layerSize = base * z;
    const maxDist = people.reduce((m, p) => Math.max(m, p.distance_m), 0);
    const viewMax = Math.max(25, Math.min(radius, maxDist * 1.15));
    const limit = scope * 0.46 - layerSize / 2;

    const nodes = people.map((person, index) => {
      // True geographic placement: north is up, bearing runs clockwise, and
      // the radius is the real distance scaled against the scan range. At
      // exactly the same coordinates PostGIS has no azimuth, so distribute
      // those beacons around the centre instead of filtering them out.
      const reportedBearing = Number(person.bearing_deg);
      const bearing = Number.isFinite(reportedBearing) ? reportedBearing : (index * 137.508) % 360;
      const rad = (bearing * Math.PI) / 180;
      const rr = Math.max(layerSize * 0.6, Math.min(1, person.distance_m / viewMax) * limit);
      return { person, bearing, radius: rr, angle: rad };
    });

    return {
      beaconSize: size,
      markerScale: z,
      beacons: nodes
        // Pro beacons render last so they always sit on top of the stack.
        .slice()
        .sort((a, b) => Number(Boolean(a.person.is_pro)) - Number(Boolean(b.person.is_pro)))
        .map((n) => ({
          person: n.person,
          bearing: n.bearing,
          left: `calc(50% + ${Math.sin(n.angle) * n.radius}px)`,
          top: `calc(50% + ${-Math.cos(n.angle) * n.radius}px)`,
        })),
    };
  }, [people, scopeSize, radius, zoom]);

  // Bat-Signals ride the same scope as people: true bearing, scaled distance,
  // so a cry for help is visible on the radar itself, not only in the list.
  const { data: helpBeacons = [] } = useHelpBeacons();
  const helpMarkers = useMemo(() => {
    const scope = scopeSize || 320;
    const z = zoom;
    const size = Math.max(16, Math.min(34, Math.round(scope / 9))) * z;
    const maxDist = Math.max(
      people.reduce((m, p) => Math.max(m, p.distance_m), 0),
      helpBeacons.reduce((m, b) => Math.max(m, b.distance_m), 0),
    );
    const viewMax = Math.max(25, Math.min(radius, maxDist * 1.15));
    const limit = scope * 0.46 - size / 2;
    return helpBeacons
      .filter((b) => !b.mine && b.bearing_deg != null && Number.isFinite(Number(b.bearing_deg)))
      .map((b) => {
        const rad = (Number(b.bearing_deg) * Math.PI) / 180;
        const rr = Math.max(size * 0.6, Math.min(1, b.distance_m / viewMax) * limit);
        return {
          beacon: b,
          size,
          left: `calc(50% + ${Math.sin(rad) * rr}px)`,
          top: `calc(50% + ${-Math.cos(rad) * rr}px)`,
        };
      });
  }, [helpBeacons, people, scopeSize, radius, zoom]);

  // ---- Pinch to resize the beacons ---------------------------------------
  // The radar disc itself never scales or pans: pinching only grows or shrinks
  // the people on it, so you can pack more beacons in or make them easier to
  // read without losing the map.
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 2.4;
  const viewRef = useRef({ zoom: 1 });
  viewRef.current = { zoom };

  const zoomAt = (nextZoomRaw: number) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoomRaw));
    if (Math.abs(next - viewRef.current.zoom) < 0.001) return;
    setZoom(next);
  };
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = scopeRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Only a deliberate pinch/ctrl-scroll resizes beacons; plain scrolling
      // stays a page scroll.
      if (!e.ctrlKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAtRef.current(viewRef.current.zoom * Math.exp(-dy * 0.0018));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Two-finger pinch resizes the beacons.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number } | null>(null);
  const dragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    if (pointers.current.size > 1) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (!gesture.current) gesture.current = { dist, zoom: viewRef.current.zoom };
      zoomAtRef.current(gesture.current.zoom * (dist / gesture.current.dist));
      dragged.current = true;
    }
  };
  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-[var(--app-gutter)] pt-2 min-[390px]:pt-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center">
          <Brand />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {/* Use the app shell's single scroll area: cards must never be clipped
            into a fixed-height region above the radar. */}
        <div className="shrink-0 pt-2 pb-2">
          <div className="mx-auto max-w-[min(24rem,100%)]">
            <div className="mb-2 rounded-xl border px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="font-medium" role="status">
                  {visible ? "Sharing · up to 15 min" : "Location hidden"}
                </span>
                <Button
                  size="sm"
                  variant={visible ? "destructive" : "default"}
                  className={
                    visible
                      ? undefined
                      : "bg-green-700 text-white hover:bg-green-800 focus-visible:ring-green-600"
                  }
                  disabled={locationBusy}
                  onClick={() => (visible ? void stopSharing() : void locate(true))}
                >
                  {locationBusy ? "Locating…" : visible ? "Stop sharing" : "Check in"}
                </Button>
              </div>
              <details className="text-muted-foreground">
                <summary className="cursor-pointer py-1">Location privacy & safety</summary>
                <p className="mt-1 leading-relaxed">
                  Check in manually each time. Check-ins expire after 15 minutes and never renew
                  automatically. Leaving Radar or backgrounding requests checkout; expiry still
                  applies if you lose connection. Stop sharing is free.
                </p>
                <Link to="/support" className="inline-block py-2 underline">
                  Safety & contact
                </Link>
              </details>
            </div>

            {geoError && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
                <span className="min-w-0">{geoError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void locate(false)}
                >
                  Retry
                </Button>
              </div>
            )}
            {!geoError && nearby.isError && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                <span className="min-w-0">
                  Radar could not refresh. Check your connection and try again.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void nearby.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}
            {located &&
              !geoError &&
              !nearby.isError &&
              people.length === 0 &&
              !nearby.isLoading && (
                <p className="mb-2 text-center text-xs leading-5 text-muted-foreground">
                  {settings.empty_radar_text} Widen your scan range in your profile.
                </p>
              )}
            <div className="mt-2.5 max-[360px]:mt-2">
              <IntentChip />
            </div>
            <ActiveChats />
            <IncomingSignals />
          </div>
        </div>

        {/* Keep a true square in normal flow. Short screens scroll instead of
            shrinking or covering the cards above. Bottom navigation stays fixed. */}
        <div className="relative flex shrink-0 flex-col items-center justify-center gap-2 pb-3">
          <section
            ref={scopeRef}
            aria-label={geoError ?? "Radar"}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            style={{ touchAction: "pan-y" }}
            className="relative aspect-square h-auto shrink-0 w-full max-w-[min(24rem,100%)] overflow-hidden rounded-full border border-border bg-secondary/20"
          >
            <div
              className="absolute inset-0 origin-center"
              style={{
                transform: `rotate(${rot}deg)`,
                // will-change only while pinching/panning: keeping it on during
                // compass rotation makes the browser reuse a cached bitmap, which
                // is what made the grid and labels look blurry while walking.
                willChange: gesture.current ? "transform" : "auto",
                transition: gesture.current
                  ? "none"
                  : "transform 260ms cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <div className="radar-grid absolute inset-0" />
              {/* Compass rose: beacons sit at their true bearing. In heading-up mode
              the rose turns with the phone so N always points at real north. */}
              <span className="pointer-events-none absolute left-1/2 top-[2%] -translate-x-1/2 text-[9px] font-semibold tracking-widest text-muted-foreground/70">
                N
              </span>
              <span className="pointer-events-none absolute right-[2%] top-1/2 -translate-y-1/2 text-[9px] font-semibold tracking-widest text-muted-foreground/50">
                E
              </span>
              <span className="pointer-events-none absolute bottom-[2%] left-1/2 -translate-x-1/2 text-[9px] font-semibold tracking-widest text-muted-foreground/50">
                S
              </span>
              <span className="pointer-events-none absolute left-[2%] top-1/2 -translate-y-1/2 text-[9px] font-semibold tracking-widest text-muted-foreground/50">
                W
              </span>
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

              {beacons.map(({ person, left, top }) => {
                const priority = Boolean(person.is_pro) && proPriorityOn;
                const custom = beaconColor(person.beacon_style);
                const scaleUp = priority ? 1.16 : 1;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      if (dragged.current) return;
                      setSelectedId(person.id);
                    }}
                    style={{
                      left,
                      top,
                      opacity: person.is_online ? 1 : 0.5,
                      zIndex: priority ? 3 : 2,
                      transition: "left 500ms ease, top 500ms ease, opacity 500ms ease",
                    }}

                    aria-label={`${person.display_name ?? person.username}${person.is_online ? ", active now" : ""}${priority ? ", Pro member" : ""}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 duration-500 active:scale-90"
                    // Only tween position/fade. Tweening `all` restarted a 500ms
                    // animation on every compass tick, which smeared the beacons.
                  >
                    <span
                      className="relative flex items-center justify-center"
                      style={{
                        width: beaconSize,
                        height: beaconSize,
                        transform: `scale(${markerScale * scaleUp}) rotate(${-rot}deg)`,
                        transition: "transform 260ms cubic-bezier(0.22,1,0.36,1)",
                      }}
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
                        const ringClass = {
                          "gender-male": "ring-gender-male",
                          "gender-female": "ring-gender-female",
                          "gender-other": "ring-gender-other",
                        }[token];
                        const iconClass = {
                          "gender-male": "text-gender-male",
                          "gender-female": "text-gender-female",
                          "gender-other": "text-gender-other",
                        }[token];
                        return (
                          <>
                            {/* soft glow pool */}
                            <span
                              aria-hidden
                              className={
                                custom
                                  ? "absolute inset-0 rounded-full blur-md"
                                  : `absolute inset-0 rounded-full blur-md ${glowClass}`
                              }
                              style={custom ? { background: custom, opacity: 0.35 } : undefined}
                            />
                            {/* ping for people who signaled you */}
                            {person.they_signaled && !person.match_id && (
                              <span
                                aria-hidden
                                className={
                                  custom
                                    ? "beacon-ping absolute inset-0 rounded-full border"
                                    : `beacon-ping absolute inset-0 rounded-full border ${pingClass}`
                                }
                                style={custom ? { borderColor: custom } : undefined}
                              />
                            )}
                            {/* Pro priority halo */}
                            {priority && (
                              <span
                                aria-hidden
                                className="absolute inset-[-14%] rounded-full border"
                                style={{
                                  borderColor: custom ?? "oklch(0.82 0.16 85)",
                                  opacity: 0.7,
                                }}
                              />
                            )}
                            {/* gendered avatar marker; neutral gender is intentionally bare — only the ring + glow */}
                            <span
                              className={
                                custom
                                  ? "relative z-10 flex items-center justify-center rounded-full bg-background ring-2 heartbeat-glow"
                                  : `relative z-10 flex items-center justify-center rounded-full bg-background ring-2 heartbeat-glow ${ringClass}`
                              }
                              style={{
                                width: beaconSize * 0.62,
                                height: beaconSize * 0.62,
                                ...(custom ? { ["--tw-ring-color" as any]: custom } : {}),
                              }}
                            >
                              {person.gender && person.gender !== "other" && (
                                <GenderAvatarIcon
                                  gender={person.gender}
                                  className={
                                    custom ? "h-[76%] w-[76%]" : `h-[76%] w-[76%] ${iconClass}`
                                  }
                                  {...(custom ? { style: { color: custom } } : {})}
                                />
                              )}
                            </span>
                          </>
                        );
                      })()}
                      {intentFor(person.intent) ? (
                        <span
                          aria-hidden
                          className="absolute -right-1 -top-1 z-20 flex size-[45%] items-center justify-center rounded-full bg-background text-[9px] leading-none shadow-sm ring-1 ring-border"
                        >
                          {intentFor(person.intent)?.emoji}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}

              {helpMarkers.map(({ beacon, size, left, top }) => (
                <button
                  key={beacon.id}
                  type="button"
                  onClick={() => {
                    if (dragged.current) return;
                    navigate({ to: "/local", hash: "help-beacons" });
                    setTimeout(() => {
                      document
                        .getElementById("help-beacons")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 250);
                  }}
                  style={{ left, top, zIndex: 4 }}
                  aria-label={`${helpKindFor(beacon.kind)?.label ?? "Someone needs help"}, ${Math.round(beacon.distance_m)} metres away`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 active:scale-90"
                >
                  <span
                    className="relative flex items-center justify-center"
                    style={{
                      width: size,
                      height: size,
                      transform: `scale(${markerScale}) rotate(${-rot}deg)`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="beacon-ping absolute inset-[-20%] rounded-full border border-destructive/70"
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-destructive/30 blur-md"
                    />
                    <span className="relative z-10 flex size-full items-center justify-center rounded-full bg-destructive text-destructive-foreground ring-2 ring-background">
                      <LifeBuoy className="size-[62%]" />
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {settings.radar_sweep_enabled && (
              <div className="radar-sweep pointer-events-none absolute inset-0 rounded-full" />
            )}

            {/* Facing indicator: fixed to the screen, marks the way you are pointed. */}
            {compassActive && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[6%] size-0 -translate-x-1/2 border-x-[6px] border-b-[10px] border-x-transparent border-b-primary/70"
              />
            )}

            {nearby.isLoading && (
              <LoaderCircle className="absolute inset-x-0 bottom-[16%] mx-auto size-5 animate-spin text-muted-foreground" />
            )}
          </section>

          {/* Compass toggle: sits directly under the radar scope. */}
          <button
            type="button"
            onClick={() => {
              if (needsPermission) {
                void requestCompass().then((ok) => {
                  if (ok) {
                    if (!headingUp) toggleHeadingUp();
                  } else toast.error("Compass access was declined");
                });
                return;
              }
              if (headingUp && heading == null) {
                void requestCompass().then((ok) => {
                  if (!ok) toast.error("Compass is unavailable on this device");
                });
                return;
              }
              toggleHeadingUp();
            }}
            className="mb-1 flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur"
          >
            {compassCalibrating ||
            (headingUp && heading == null && !needsPermission && !compassUnavailable) ? (
              <LoaderCircle className="size-3.5 animate-spin text-primary" />
            ) : (
              <Compass className={`size-3.5 ${compassActive ? "text-primary" : ""}`} />
            )}
            {needsPermission
              ? "Enable compass"
              : compassActive
                ? compassCalibrating
                  ? "Calibrating…"
                  : `Facing ${compassPoint(heading as number)}`
                : headingUp
                  ? compassUnavailable
                    ? "No compass signal — tap to retry"
                    : "Finding north…"
                  : "North up"}
          </button>

          {/* Calibration notice: shown below the compass button while the magnetometer settles. */}
          {compassCalibrating && (
            <div className="flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
              <LoaderCircle className="size-3.5 animate-spin text-primary" />
              Calibrating compass — move your phone in a figure 8
            </div>
          )}

          {headingUp && compassUnavailable && (
            <div className="max-w-[18rem] rounded-2xl border border-border bg-background/90 px-3 py-2 text-center text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
              Your phone isn’t sending a compass reading. Move away from metal or magnets, wave the
              phone in a figure 8, then tap the compass button to try again.
            </div>
          )}
        </div>
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
                <DialogDescription asChild>
                  <div className="space-y-1">
                    {selected.bearing_deg != null &&
                      Number.isFinite(Number(selected.bearing_deg)) && (
                        <p className="text-sm font-semibold text-primary">
                          {compassPoint(Number(selected.bearing_deg))}{" "}
                          {Math.round(Number(selected.bearing_deg))}°
                        </p>
                      )}
                    <p className="text-xs text-muted-foreground">
                      @{selected.username}
                      {selected.is_online ? " · active now" : ""}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {(() => {
                const def = intentFor(selected.intent);
                if (!def && !selected.mood) return null;
                return (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {def ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                        {def.emoji} {def.label}
                        {selected.intent_note ? ` · ${selected.intent_note}` : ""}
                      </span>
                    ) : null}
                    {selected.mood ? (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                        {selected.mood}
                      </span>
                    ) : null}
                  </div>
                );
              })()}

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
                    <Button variant="ghost" className="flex-1" onClick={() => setReporting(false)}>
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
                      onClick={() => {
                        const id = selected.match_id as string;
                        // Close the profile card first: its focus trap blocks
                        // the chat screen rendered above it.
                        setSelectedId(null);
                        setTimeout(() => openChat(id), 0);
                      }}
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
                      disabled={signal.isPending || !selected.is_online}
                      onClick={() => signal.mutate(selected)}
                    >
                      {signal.isPending ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Zap className="size-4" />
                      )}
                      {selected.is_online ? "Signal" : "No longer nearby"}
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
