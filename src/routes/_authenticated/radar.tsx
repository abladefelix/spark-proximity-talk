import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  Compass,
  LifeBuoy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { HelpBeaconList, useHelpBeacons } from "@/components/BatSignal";
import { QuestionBroadcasts } from "@/components/QuestionBroadcasts";
import { IntentChip } from "@/components/IntentSheet";
import { useMyIntent } from "@/hooks/useIntent";
import { intentFor, helpKindFor } from "@/lib/intents";
import { ActiveChats } from "@/components/ActiveChats";
import { useProUpgradeSheet } from "@/components/ProUpgradeSheet";
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
import { GeoKalman, preciseDistance } from "@/lib/geo-filter";
import { withTimeout } from "@/lib/net";
import { nativeDebug, nativeDebugError } from "@/lib/native-debug";






/** Fixes worse than this are network/wifi guesses, not usable GPS. */
const COARSE_FIX_LIMIT_M = 65;
/** How long we wait for a precise fix before falling back to a coarse one. */
const COARSE_GRACE_MS = 45000;

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

  const [visible, setVisible] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [located, setLocated] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [askLocation, setAskLocation] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const { open: openPro } = useProUpgradeSheet();



  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const lastCoords = useRef<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const myIdRef = useRef<string | null>(user.id);

  // Keep my location fresh while the radar is open.

  useEffect(() => {
    if (askLocation) return;
    const isNative = Capacitor.isNativePlatform();
    nativeDebug("radar location effect started", { platform: Capacitor.getPlatform() });
    // On Android the WebView's own location provider goes through the same
    // native permission flow as the plugin. Running both at once while the
    // system permission dialog is open kills the app process, so the WebView
    // fallback is kept for iPhone only (where it rescues lost plugin
    // callbacks after the app resumes).
    const webFallbackOk = !isNative || Capacitor.getPlatform() === "ios";
    if (!isNative && !("geolocation" in navigator)) {
      setGeoError("This device can't share location.");
      return;
    }

    let cancelled = false;
    let browserWatch: number | undefined;
    let nativeWatch: string | undefined;
    let lastPublished: { lat: number; lng: number; at: number; accuracy: number } | null = null;
    let publishInFlight = false;
    let pendingFix: { latitude: number; longitude: number; accuracy?: number | null } | null = null;
    const startedAt = Date.now();
    const filter = new GeoKalman();
    const push = async (
      raw: {
        latitude: number;
        longitude: number;
        accuracy?: number | null;
        speed?: number | null;
      },
      force = false,
      preSmoothed = false,
    ) => {

      if (cancelled) return;
      if (!Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude)) return;

      // Smooth GPS jitter before publishing so distances stay steady while
      // standing still, yet still follow real movement.
      const smoothed = preSmoothed
        ? { latitude: raw.latitude, longitude: raw.longitude, accuracy: raw.accuracy ?? filter.accuracy ?? 50 }
        : filter.process(raw);
      if (!smoothed) return;
      const coords = { latitude: smoothed.latitude, longitude: smoothed.longitude };
      const accuracy = smoothed.accuracy;

      // Wifi / IP fixes (laptops, phones with GPS still warming up) can be
      // hundreds of metres off and make someone sitting next to you look far
      // away. Keep them local: never publish them while a precise fix is in
      // reach, and only fall back to one if nothing better arrives at all.
      if (accuracy > COARSE_FIX_LIMIT_M) {
        lastCoords.current = { latitude: coords.latitude, longitude: coords.longitude, accuracy };
        setAccuracyM(accuracy);
        const precise = lastPublished && lastPublished.accuracy <= COARSE_FIX_LIMIT_M;
        const stillHopeful = Date.now() - startedAt < COARSE_GRACE_MS;
        if (precise || stillHopeful) {
          setGeoError(
            "Getting a precise GPS fix… hold on a moment.",
          );
          return;
        }
      }


      // Native and WebView providers can report at the same time. Serialize
      // writes and retain only the newest fix so an older async write cannot
      // land after a newer one and make the beacon jump backwards.
      if (publishInFlight) {
        pendingFix = coords;
        return;
      }

      // Accuracy gate: a coarse wifi/IP fix can sit hundreds of metres away and
      // would place this person in completely the wrong direction for everyone
      // else. Never let one overwrite a recent precise GPS fix.
      if (
        lastPublished &&
        accuracy > Math.max(60, lastPublished.accuracy * 2.5) &&
        Date.now() - lastPublished.at < 120000
      ) {
        return;
      }

      lastCoords.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy,
      };
      localStorage.setItem("skan-last-location", JSON.stringify(lastCoords.current));
      setAccuracyM(accuracy);

      // Track motion promptly. The threshold follows the reported horizontal
      // uncertainty so stationary GPS noise is not presented as real motion.
      if (!force && lastPublished) {
        const moved = preciseDistance(
          { latitude: lastPublished.lat, longitude: lastPublished.lng },
          coords,
        );
        // Keep the floor sub-metre on a good fix so short walks register.
        const movementFloor = Math.max(0.5, Math.min(3, accuracy * 0.2));
        if (moved < movementFloor && Date.now() - lastPublished.at < 4000) return;
      }



      // Use the locally cached session: a network round-trip here (getUser)
      // can hang on flaky mobile networks and silently kill the heartbeat.
      let me = myIdRef.current;
      if (!me) {
        me = (await supabase.auth.getSession()).data.session?.user?.id ?? null;
        myIdRef.current = me;
      }
      if (!me) return;
      publishInFlight = true;
      try {
        nativeDebug("location publish started", { accuracyBucket: accuracy <= COARSE_FIX_LIMIT_M ? "precise" : "coarse" });
        const publishedAt = Date.now();
        const { error } = await supabase.from("locations").upsert(
          {
            user_id: me,
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy_m: accuracy,
            is_visible: visible,
            updated_at: new Date(publishedAt).toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) {
          nativeDebugError("location publish failed", error);
          setGeoError(error.message);
          return;
        }
        nativeDebug("location publish succeeded");
        lastPublished = {
          lat: coords.latitude,
          lng: coords.longitude,
          at: publishedAt,
          accuracy,
        };
        setGeoError(null);
        setLocated(true);
        queryClient.invalidateQueries({ queryKey: ["nearby"] });
      } finally {
        publishInFlight = false;
        const next = pendingFix;
        pendingFix = null;
        if (next && !cancelled) void push(next);
      }
    };

    // Retain the cached fix only for local continuity. Never publish it: an old
    // coordinate is worse than a short wait for a fresh high-accuracy fix.
    const cachedLocation = localStorage.getItem("skan-last-location");
    if (cachedLocation) {
      try {
        const parsed = JSON.parse(cachedLocation) as {
          latitude?: unknown;
          longitude?: unknown;
          accuracy?: unknown;
        };
        if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
          const cachedAccuracy =
            typeof parsed.accuracy === "number" ? parsed.accuracy : undefined;
          lastCoords.current = {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            ...(cachedAccuracy === undefined ? {} : { accuracy: cachedAccuracy }),
          };
        }
      } catch {
        localStorage.removeItem("skan-last-location");
      }
    }
    const refreshFix = () => {
      if (isNative) {
        nativeDebug("requesting one-off native location refresh");
        void Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        })
          .then((position) => {
            nativeDebug("one-off native location received", { accuracy: position.coords.accuracy });
            return push(position.coords);
          })
          .catch((error) => {
            nativeDebugError("one-off native location failed", error);
            // A remotely hosted Capacitor app can occasionally lose the native
            // plugin callback after resume. WKWebView location remains usable,
            // so fall back instead of silently letting presence expire.
            if (webFallbackOk && "geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition(
                (position) => void push(position.coords),
                () => {},
                { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
              );
            }
          });
      } else if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => void push(position.coords),
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
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
        if (webFallbackOk && "geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => void push(position.coords),
            () => {},
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
          );
          browserWatch = navigator.geolocation.watchPosition(
            (position) => void push(position.coords),
            () => {},
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
          );
        }
        try {
          nativeDebug("checking native location permission");
          let permission = await Geolocation.checkPermissions();
          nativeDebug("native location permission checked", { location: permission.location });
          if (permission.location === "prompt" || permission.location === "prompt-with-rationale") {
            nativeDebug("showing native location permission prompt");
            permission = await Geolocation.requestPermissions();
            nativeDebug("native location permission prompt returned", { location: permission.location });
          }
          if (permission.location !== "granted") {
            fail(true);
            return;
          }

          setAskLocation(false);
          setPermDenied(false);
          nativeDebug("starting native location watcher");
          nativeWatch = await Geolocation.watchPosition(
             { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
            (position, error) => {
              if (position) {
                nativeDebug("native location watcher update", { accuracy: position.coords.accuracy });
                void push(position.coords);
              }
              else if (error) {
                nativeDebugError("native location watcher failed", error);
                const denied = error.code === "OS-PLUG-GLOC-0003";
                const unavailable = error.code === "OS-PLUG-GLOC-0007";
                fail(denied, unavailable);
              }
            },
          );
          nativeDebug("native location watcher started", { hasWatchId: Boolean(nativeWatch) });
          if (cancelled && nativeWatch) void Geolocation.clearWatch({ id: nativeWatch });

          // A cached fix makes startup instant when available. A timeout here is
          // not an error: the watcher above remains active until iOS gets a fix.
          try {
            nativeDebug("requesting initial native location fix");
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 15000,
            });
            nativeDebug("initial native location fix received", { accuracy: position.coords.accuracy });
            await push(position.coords);
          } catch (error) {
            nativeDebugError("initial native location fix failed", error);
            // Keep the native watcher, but also start the WebView provider. On
            // iOS it can recover when a plugin callback is lost after resume.
            if (webFallbackOk && "geolocation" in navigator && browserWatch === undefined) {
              navigator.geolocation.getCurrentPosition(
                (position) => void push(position.coords),
                () => {},
                { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
              );
              browserWatch = navigator.geolocation.watchPosition(
                (position) => void push(position.coords),
                () => {},
                { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
              );
            }
          }
        } catch (error) {
          nativeDebugError("native location startup failed", error);
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
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
      browserWatch = navigator.geolocation.watchPosition(
        (position) => void push(position.coords),
        (error) => fail(error.code === error.PERMISSION_DENIED, error.code === error.POSITION_UNAVAILABLE),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    })();

    // Stationary phones stop emitting position updates, which would make the
    // user look offline to everyone else. Re-publish the last fix periodically,
    // and ask for a fresh one when the watcher never delivered anything.
    const heartbeat = setInterval(() => {
      const coords = lastCoords.current;
      if (coords) void push(coords, true, true);
      else refreshFix();
    }, 10000);

    // Backgrounded tabs and suspended apps stop the heartbeat, so the person
    // goes stale for everyone else. Re-publish (and refresh) on foreground.
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      const coords = lastCoords.current;
      if (coords) void push(coords, true, true);
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
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,

    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_people", { radius_m: radius });
      if (error) throw error;
      return (data ?? []) as NearbyPerson[];
    },
  });

  const { data: myIntent } = useMyIntent();

  const signal = useMutation({
    mutationFn: async (person: NearbyPerson) => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) throw new Error("Not signed in");
      const result = await withTimeout<{ error: { message: string } | null }>(
        (supabase as any)
          .from("signals")
          .insert({
            from_user: me,
            to_user: person.id,
            intent: myIntent?.intent ?? null,
            intent_note: myIntent?.intent_note ?? null,
          }),
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


  const people = (nearby.data ?? []).filter((person) => person.is_online);
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
    const z = Math.max(1, zoom);
    // Markers shrink as the crowd grows so far more people fit before we have
    // to de-crowd, with a floor that keeps them tappable.
    const size = Math.max(
      14,
      Math.min(40, Math.round(scope / (4.6 + Math.sqrt(Math.max(count, 1)) * 2.1))),
    );
    // Layer-space size: the whole layer is scaled by `zoom`, so divide to keep
    // the rendered marker the same physical size at any zoom level.
    const layerSize = size / z;
    const maxDist = people.reduce((m, p) => Math.max(m, p.distance_m), 0);
    const viewMax = Math.max(25, Math.min(radius, maxDist * 1.15));
    const limit = scope * 0.46 - layerSize / 2;

    const nodes = people
      .filter((p) => p.bearing_deg != null && Number.isFinite(Number(p.bearing_deg)))
      .map((person) => {
        // True geographic placement: north is up, bearing runs clockwise, and
        // the radius is the real distance scaled against the scan range.
        const bearing = Number(person.bearing_deg);
        const rad = (bearing * Math.PI) / 180;
        const rr = Math.max(
          layerSize * 0.6,
          Math.min(1, person.distance_m / viewMax) * limit,
        );
        return { person, bearing, radius: rr, angle: rad };
      });

    return {
      beaconSize: size,
      markerScale: 1 / z,
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
    const z = Math.max(1, zoom);
    const size = Math.max(16, Math.min(34, Math.round(scope / 9))) / z;
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




  // ---- Zoom & pan on the radar scope -------------------------------------
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 6;
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
    <main data-fixed-page className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden px-[var(--app-gutter)] pt-2 min-[390px]:pt-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center">
          <Brand />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <NotificationBell />
          <ThemeToggle />


          <Switch
            checked={visible}
            onCheckedChange={(next) => {
              if (!next && !has(FEATURE.invisibleMode)) {
                toast.error("Going invisible is a Pro feature", {
                  description: "Upgrade to hide your beacon while you scan.",
                  action: { label: "Go Pro", onClick: () => openPro() },
                });
                return;
              }
              setVisible(next);
            }}
            aria-label="Visible on radar"
          />
          <span className="hidden text-xs text-muted-foreground min-[380px]:inline">
            {visible ? "Visible" : "Hidden"}
          </span>
        </div>
      </div>

      <div className="mt-2.5 max-[360px]:mt-2">
        <IntentChip />
      </div>

      <div className="mt-2.5 max-[360px]:mt-2">
        <HelpBeaconList />
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
                ? Capacitor.isNativePlatform()
                  ? "Location is turned off for SKANAROUND. Open your phone Settings, find SKANAROUND, allow Location, then tap Try again."
                  : "Location is blocked for SKANAROUND. Allow location in your device settings, then tap Try again."
                : "SKANAROUND needs your location to show people around you. Only distance is ever shared — never your exact spot."}
            </DialogDescription>
            <Link
              to="/privacy"
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              How we use your location
            </Link>
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
      {!geoError && nearby.isError && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          <span>Radar could not refresh. Check your connection and try again.</span>
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
      {!geoError && !nearby.isError && people.length === 0 && !nearby.isLoading && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {settings.empty_radar_text} Widen your scan range in your profile.
        </p>
      )}


      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-2 min-h-[700px]:gap-3 min-h-[700px]:py-3">
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
        className="relative aspect-square h-auto max-h-full w-full max-w-[min(24rem,100%)] overflow-hidden rounded-full border border-border bg-secondary/20"
      >
        <div
          className="absolute inset-0 origin-center"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rot}deg)`,
            // will-change only while pinching/panning: keeping it on during
            // compass rotation makes the browser reuse a cached bitmap, which
            // is what made the grid and labels look blurry while walking.
            willChange: gesture.current ? "transform" : "auto",
            transition: gesture.current ? "none" : "transform 260ms cubic-bezier(0.22,1,0.36,1)",
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
                        className={custom ? "absolute inset-0 rounded-full blur-md" : `absolute inset-0 rounded-full blur-md ${glowClass}`}
                        style={custom ? { background: custom, opacity: 0.35 } : undefined}
                      />
                      {/* ping for people who signaled you */}
                      {person.they_signaled && !person.match_id && (
                        <span
                          aria-hidden
                          className={custom ? "beacon-ping absolute inset-0 rounded-full border" : `beacon-ping absolute inset-0 rounded-full border ${pingClass}`}
                          style={custom ? { borderColor: custom } : undefined}
                        />
                      )}
                      {/* Pro priority halo */}
                      {priority && (
                        <span
                          aria-hidden
                          className="absolute inset-[-14%] rounded-full border"
                          style={{ borderColor: custom ?? "oklch(0.82 0.16 85)", opacity: 0.7 }}
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
                            className={custom ? "h-[76%] w-[76%]" : `h-[76%] w-[76%] ${iconClass}`}
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
                document
                  .getElementById("help-beacons")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
              }
              else toast.error("Compass access was declined");
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
