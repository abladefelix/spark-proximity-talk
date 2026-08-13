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
    <main className="px-5 pt-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Radar</h1>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{visible ? "Visible" : "Hidden"}</span>
          <Switch checked={visible} onCheckedChange={setVisible} aria-label="Visible on radar" />
        </div>
      </header>

      <section className="relative mx-auto mt-8 aspect-square w-full max-w-sm">
        <div className="absolute inset-0 rounded-full border border-border" />
        <div className="absolute inset-[16%] rounded-full border border-border/70" />
        <div className="absolute inset-[33%] rounded-full border border-border/50" />
        <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        <span className="pulse-ring absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30" />

        {beacons.map(({ person, left, top }) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setSelectedId(person.id === selectedId ? null : person.id)}
            style={{ left, top }}
            aria-label={`${person.display_name ?? person.username}, ${formatDistance(person.distance_m)}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition ${
              selectedId === person.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
            }`}
          >
            <PersonAvatar
              path={person.avatar_url}
              name={person.display_name}
              username={person.username}
              className="size-11"
            />
            {person.they_signaled && !person.match_id && (
              <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary" />
            )}
          </button>
        ))}

        {located && !nearby.isLoading && people.length === 0 && (
          <p className="absolute inset-x-0 bottom-[18%] text-center text-sm text-muted-foreground">
            Nobody in range yet
          </p>
        )}
        {(!located || nearby.isLoading) && (
          <p className="absolute inset-x-0 bottom-[18%] flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {geoError ?? "Scanning…"}
          </p>
        )}
      </section>

      <div className="mx-auto mt-6 w-full max-w-sm">
        <Slider
          value={[radius]}
          onValueChange={([v]) => setRadius(v ?? 500)}
          min={100}
          max={5000}
          step={100}
        />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>100 m</span>
          <span>{radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}</span>
          <span>5 km</span>
        </div>
      </div>

      {selected && (
        <section className="mx-auto mt-6 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-card/60 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{selected.display_name ?? selected.username}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{selected.username} · {formatDistance(selected.distance_m)}
            </p>
          </div>
          {selected.match_id ? (
            <Button
              size="sm"
              variant="soft"
              onClick={() =>
                navigate({ to: "/chat/$matchId", params: { matchId: selected.match_id as string } })
              }
            >
              Chat
            </Button>
          ) : selected.i_signaled ? (
            <Button size="sm" variant="ghost" disabled>
              <Check className="size-4" /> Sent
            </Button>
          ) : (
            <Button
              size="sm"
              variant="heat"
              disabled={signal.isPending}
              onClick={() => signal.mutate(selected)}
            >
              <Zap className="size-4" /> Signal
            </Button>
          )}
        </section>
      )}
    </main>
  );
}

