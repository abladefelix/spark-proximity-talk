import { Geolocation } from "@capacitor/geolocation";

import { supabase } from "@/integrations/supabase/client";

/** Refresh a private position for an explicit local action; never check in. */
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
    // Capacitor's Android WebView handles this permission prompt through its
    // bridge, so it is a safe fallback when the native provider times out or
    // has not produced its first fix yet.
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
    throw new Error("Allow location to use this nearby feature. This does not check you in.");
  }

  const { error } = await supabase.from("locations").upsert(
    {
      user_id: me,
      lat,
      lng,
      accuracy_m: accuracy,
      is_visible: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
