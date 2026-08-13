import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Check, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { PersonAvatar } from "@/components/PersonAvatar";

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
  component: RadarPage,
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
};

function formatDistance(m: number) {
  return m < 950 ? `${Math.max(1, Math.round(m))} m away` : `${(m / 1000).toFixed(1)} km away`;
}

function RadarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [radius, setRadius] = useState(500);
  const [visible, setVisible] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [located, setLocated] = useState(false);

  // Keep my location fresh while the radar is open.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("This device can't share location.");
      return;
    }
    let cancelled = false;
    const push = async (pos: GeolocationPosition) => {
      if (cancelled) return;
      const { error } = await supabase.from("locations").upsert({
        user_id: (await supabase.auth.getUser()).data.user?.id as string,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        is_visible: visible,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        setGeoError(error.message);
        return;
      }
      setGeoError(null);
      setLocated(true);
      queryClient.invalidateQueries({ queryKey: ["nearby"] });
    };
    const watch = navigator.geolocation.watchPosition(
      (pos) => void push(pos),
      () => setGeoError("Location permission is off. Turn it on to see who's around."),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watch);
    };
  }, [visible, queryClient]);

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
        toast.success(`Signal sent to @${person.username}`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send signal"),
  });

  const people = nearby.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = people.find((p) => p.id === selectedId) ?? null;

  const beacons = people.map((person) => {
    let hash = 0;
    for (let i = 0; i < person.id.length; i++) hash = (hash * 31 + person.id.charCodeAt(i)) | 0;
    const angle = ((hash >>> 0) % 360) * (Math.PI / 180);
    const r = Math.min(1, person.distance_m / radius) * 0.42;
    return {
      person,
      left: `${50 + Math.cos(angle) * r * 100}%`,
      top: `${50 + Math.sin(angle) * r * 100}%`,
    };
  });

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-5">
      <div className="absolute right-5 top-6">
        <Switch checked={visible} onCheckedChange={setVisible} aria-label="Visible on radar" />
      </div>

      <section
        aria-label="Radar"
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

        {beacons.map(({ person, left, top }) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setSelectedId(person.id)}
            style={{ left, top }}
            aria-label={`${person.display_name ?? person.username}, ${formatDistance(person.distance_m)}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition active:scale-95"
          >
            <PersonAvatar
              path={person.avatar_url}
              name={person.display_name}
              username={person.username}
              className="size-11 ring-2 ring-background"
            />
            {person.they_signaled && !person.match_id && (
              <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary" />
            )}
          </button>
        ))}

        {(!located || nearby.isLoading) && (
          <LoaderCircle className="absolute inset-x-0 bottom-[16%] mx-auto size-5 animate-spin text-muted-foreground" />
        )}
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-xs rounded-3xl text-center">
          {selected && (
            <>
              <DialogHeader className="items-center">
                <PersonAvatar
                  path={selected.avatar_url}
                  name={selected.display_name}
                  username={selected.username}
                  className="size-28"
                />
                <DialogTitle className="mt-4 text-xl">
                  {selected.display_name ?? selected.username}
                </DialogTitle>
                <DialogDescription>
                  @{selected.username} · {formatDistance(selected.distance_m)}
                </DialogDescription>
              </DialogHeader>

              {selected.bio && (
                <p className="text-sm leading-relaxed text-muted-foreground">{selected.bio}</p>
              )}

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
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}


