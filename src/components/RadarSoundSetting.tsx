import { useQueryClient } from "@tanstack/react-query";
import { Play, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { RADAR_SOUND_KEY, useRadarSoundPrefs } from "@/hooks/useRadarSound";
import { DEFAULT_TONE_ID, playRadarTone, useRadarTones } from "@/lib/radarTones";

/** Member control: play a tone when new people appear on the radar. */
export function RadarSoundSetting() {
  const tones = useRadarTones();
  const { data: prefs } = useRadarSoundPrefs();
  const queryClient = useQueryClient();

  const enabled = prefs?.enabled ?? false;
  const toneId = prefs?.toneId ?? DEFAULT_TONE_ID;

  async function patch(values: { radar_sound?: boolean; radar_tone?: string }) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("profiles").update(values).eq("id", auth.user.id);
    if (error) {
      toast.error("Could not save sound setting");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: RADAR_SOUND_KEY });
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Volume2 className="size-4 text-primary" /> Radar sound
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Play a tone when someone new appears around you.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            if (v) playRadarTone(tones.find((t) => t.id === toneId) ?? tones[0]);
            void patch({ radar_sound: v });
          }}
        />
      </div>

      {enabled ? (
        <div className="mt-4 space-y-2">
          {tones.map((tone) => {
            const selected = tone.id === toneId;
            return (
              <div
                key={tone.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                  selected ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void patch({ radar_tone: tone.id })}
                  aria-pressed={selected}
                  className="min-w-0 flex-1 truncate text-left text-sm"
                >
                  {tone.name}
                </button>
                <button
                  type="button"
                  aria-label={`Preview ${tone.name}`}
                  onClick={() => playRadarTone(tone)}
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
                >
                  <Play className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
