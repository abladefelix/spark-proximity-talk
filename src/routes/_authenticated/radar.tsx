import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Zap, Check, LoaderCircle } from "lucide-react";
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

  return (
    <main className="px-5 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Radar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Who's around you right now</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Switch checked={visible} onCheckedChange={setVisible} aria-label="Visible on radar" />
          <span className="text-[11px] text-muted-foreground">
            {visible ? "Visible" : "Hidden"}
          </span>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex items-center gap-3">
          <span className="relative flex size-10 items-center justify-center rounded-full bg-secondary/70">
            <span className="absolute inset-0 rounded-full bg-primary/20 pulse-ring" />
            <MapPin className="relative size-4 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {geoError ? "Location off" : located ? "Radar live" : "Finding you…"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {geoError ?? `Scanning within ${radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}`}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <Slider
            value={[radius]}
            onValueChange={([v]) => setRadius(v ?? 500)}
            min={100}
            max={5000}
            step={100}
          />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>100 m</span>
            <span>5 km</span>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        {nearby.isLoading && located && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Scanning…
          </div>
        )}

        {located && !nearby.isLoading && people.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center">
            <p className="font-display text-lg">Quiet spot</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Nobody on SHATTA within range yet. Widen the radius or check back when the place fills
              up.
            </p>
          </div>
        )}

        {people.map((person) => (
          <article
            key={person.id}
            className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-card"
          >
            <PersonAvatar
              path={person.avatar_url}
              name={person.display_name}
              username={person.username}
              className="size-14"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{person.display_name ?? person.username}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{person.username} · {formatDistance(person.distance_m)}
              </p>
              {person.they_signaled && !person.match_id && (
                <p className="mt-1 text-xs font-semibold text-accent">
                  Signalled you — signal back to chat
                </p>
              )}
            </div>
            {person.match_id ? (
              <Button
                size="sm"
                variant="soft"
                onClick={() =>
                  navigate({ to: "/chat/$matchId", params: { matchId: person.match_id as string } })
                }
              >
                Chat
              </Button>
            ) : person.i_signaled ? (
              <Button size="sm" variant="ghost" disabled>
                <Check className="size-4" /> Sent
              </Button>
            ) : (
              <Button
                size="sm"
                variant="heat"
                disabled={signal.isPending}
                onClick={() => signal.mutate(person)}
              >
                <Zap className="size-4" /> Signal
              </Button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
