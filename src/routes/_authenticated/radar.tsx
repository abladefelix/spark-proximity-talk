import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Check, LoaderCircle, Ban, Flag, MapPin } from "lucide-react";
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
import { RadarBeacon } from "@/components/RadarBeacon";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { SuspendedGate } from "@/components/SuspendedGate";
import { IncomingSignals } from "@/components/IncomingSignals";
import { ActiveChats } from "@/components/ActiveChats";

import logoAsset from "@/assets/shatta-s.png.asset.json";
import { Brand, useBranding } from "@/components/Brand";

const logoUrl = logoAsset.url;


export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({
    meta: [
      { title: "Radar — Who's around you on SHATTA" },
      {
        name: "description",
        content:
          "See people sharing your spot right now, send a signal and unlock the chat when it's mutual.",
      },
      { property: "og:title", content: "SHATTA Radar" },
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

function RadarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const radius = 500;
  const [visible, setVisible] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [located, setLocated] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [askLocation, setAskLocation] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  // On arrival, if location isn't granted yet, ask for it up front.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!("geolocation" in navigator)) return;
      try {
        const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        if (cancelled || !status) return;
        if (status.state !== "granted") {
          setPermDenied(status.state === "denied");
          setAskLocation(true);
        }
        status.onchange = () => {
          if (status.state === "granted") {
            setAskLocation(false);
            setPermDenied(false);
            setRetryKey((k) => k + 1);
          }
        };
      } catch {
        setAskLocation(true);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);


  // Keep my location fresh while the radar is open.
  useEffect(() => {
    if (askLocation) return;
    if (!("geolocation" in navigator)) {
      setGeoError("This device can't share location.");
      return;
    }

    let cancelled = false;
    const push = async (pos: GeolocationPosition) => {
      if (cancelled) return;
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return;
      const { error } = await supabase.from("locations").upsert(
        {
          user_id: me,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
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
    const fail = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setPermDenied(true);
        setAskLocation(true);
        setGeoError("Location permission is off. Turn it on to see who's around.");
        return;
      }
      setGeoError("Couldn't get your location yet — move somewhere with better signal.");
    };

    // Fast first fix, then keep watching.
    navigator.geolocation.getCurrentPosition((pos) => void push(pos), fail, {
      enableHighAccuracy: false,
      maximumAge: 60000,
      timeout: 15000,
    });
    const watch = navigator.geolocation.watchPosition((pos) => void push(pos), fail, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 30000,
    });
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watch);
    };
  }, [visible, queryClient, retryKey, askLocation]);



  // Drop stale signals that were never returned.
  useEffect(() => {
    void supabase.rpc("purge_expired_signals");
  }, []);

  const nearby = useQuery({
    queryKey: ["nearby", radius],
    enabled: located,
    refetchInterval: 15000,
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
      if (updated?.match_id) {
        toast.success(`It's mutual with @${person.username}! Chat unlocked.`);
        navigate({ to: "/chat/$matchId", params: { matchId: updated.match_id } });
      } else {
        toast.success(`Signal sent to @${person.username} — expires in 6 hours`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send signal"),
  });

  const people = nearby.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: branding } = useBranding();
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
    toast.success("Report sent. Thanks for keeping SHATTA safe.");
  }

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
          const a = nodes[i];
          const b = nodes[j];
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


  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-24 pt-6">
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
                : "SHATTA needs your location to show people around you. Only distance is ever shared — never your exact spot."}
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
      {!geoError && located && people.length === 0 && !nearby.isLoading && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          No one within {radius} m right now.
        </p>
      )}

      <div className="flex flex-1 items-center justify-center py-8">
      <section
        aria-label={geoError ?? "Radar"}
        className="relative aspect-square w-full max-w-sm overflow-hidden rounded-full border border-border bg-secondary/20"
      >
        <div className="radar-grid absolute inset-0" />
        <div className="absolute inset-[16%] rounded-full border border-border/70" />
        <div className="absolute inset-[33%] rounded-full border border-border/50" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/40" />
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border/40" />
        <div className="radar-sweep absolute inset-0 rounded-full" />
        <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        <span className="pulse-ring absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30" />
        <img
          src={branding?.logo ?? logoUrl}
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.08]"
          aria-hidden="true"
        />

        {beacons.map(({ person, left, top }) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setSelectedId(person.id)}
            style={{ left, top, opacity: person.is_online ? 1 : 0.55 }}
            aria-label={`${person.display_name ?? person.username}, ${formatDistance(person.distance_m)}${person.is_online ? ", active now" : ""}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition active:scale-95"
          >
            <RadarBeacon active={person.they_signaled && !person.match_id}>
              <PersonAvatar
                path={person.avatar_url}
                name={person.display_name}
                username={person.username}
                gender={person.gender}
                className="size-full"
              />
            </RadarBeacon>
            {person.is_online && (
              <span className="absolute -bottom-0.5 -left-0.5 size-2.5 rounded-full border border-background bg-emerald-500" />
            )}
          </button>
        ))}

        {(!located || nearby.isLoading) && (
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
                  {selected.match_id ? (
                    <Button
                      variant="heat"
                      className="w-full"
                      onClick={() =>
                        navigate({
                          to: "/chat/$matchId",
                          params: { matchId: selected.match_id as string },
                        })
                      }
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
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5"
                      onClick={() => setReporting(true)}
                    >
                      <Flag className="size-3.5" /> Report
                    </button>
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
