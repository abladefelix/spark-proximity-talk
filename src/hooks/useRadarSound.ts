import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TONE_ID, playRadarTone, useRadarTones } from "@/lib/radarTones";

export const RADAR_SOUND_KEY = ["my-radar-sound"] as const;

export type RadarSoundPrefs = { enabled: boolean; toneId: string };

/** The member's radar alert preference (sound on/off + chosen tone). */
export function useRadarSoundPrefs() {
  return useQuery({
    queryKey: RADAR_SOUND_KEY,
    staleTime: 60_000,
    queryFn: async (): Promise<RadarSoundPrefs> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { enabled: false, toneId: DEFAULT_TONE_ID };
      const { data } = await supabase
        .from("profiles")
        .select("radar_sound, radar_tone")
        .eq("id", auth.user.id)
        .maybeSingle();
      return {
        enabled: Boolean(data?.radar_sound),
        toneId: data?.radar_tone ?? DEFAULT_TONE_ID,
      };
    },
  });
}

/** Returns a callback that plays the member's tone when the alert is enabled. */
export function useRadarAlert() {
  const { data: prefs } = useRadarSoundPrefs();
  const tones = useRadarTones();
  return () => {
    if (!prefs?.enabled) return;
    playRadarTone(tones.find((t) => t.id === prefs.toneId) ?? tones[0]);
  };
}
