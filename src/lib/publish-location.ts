import { Geolocation } from "@capacitor/geolocation";

import { supabase } from "@/integrations/supabase/client";

/**
 * Make sure the backend has a recent position for me.
 *
 * The radar screen publishes location continuously, but actions on other
 * screens (help beacons, local questions) need a position too — otherwise the
 * server rejects them with "We need your location first".
 */
export async function publishMyLocation(): Promise<void> {
  const me = (await supabase.auth.getSession()).data.session?.user?.id;
  if (!me) throw new Error("You need to be signed in.");

  let lat: number | null = null;
  let lng: number | null = null;
  let accuracy: number | null = null;

  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = pos.coords.accuracy ?? null;
  } catch {
    // Fall back to the browser API (and, failing that, to whatever the radar
    // last published).
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy ?? null;
      } catch {
        /* ignore — checked below */
      }
    }
  }

  if (lat === null || lng === null) {
    const { data } = await supabase.from("locations").select("lat").eq("user_id", me).maybeSingle();
    if (data) return; // an earlier position is good enough
    throw new Error("Turn on location so people nearby can find you.");
  }

  const { error } = await supabase.from("locations").upsert(
    {
      user_id: me,
      lat,
      lng,
      accuracy_m: accuracy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
