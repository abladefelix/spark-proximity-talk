import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useAppSettings";

export type RadarTone = {
  id: string;
  name: string;
  /** Synth recipe for built-in tones: note frequencies in Hz. */
  notes?: number[] | undefined;
  /** Storage path in the `radar-tones` bucket for admin uploads. */
  path?: string | undefined;
  /** Resolved signed URL (filled in at runtime for uploads). */
  url?: string | undefined;
};

/** Built-in synthesised tones — always available, no assets needed. */
export const BUILTIN_TONES: RadarTone[] = [
  { id: "ping", name: "Ping", notes: [880] },
  { id: "chime", name: "Chime", notes: [660, 990] },
  { id: "blip", name: "Blip", notes: [520, 700, 940] },
  { id: "sonar", name: "Sonar", notes: [420, 320] },
];

export const DEFAULT_TONE_ID = "ping";

function parseCustom(value: unknown): RadarTone[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (typeof item["id"] !== "string" || typeof item["path"] !== "string") return [];
    return [
      {
        id: item["id"],
        name: typeof item["name"] === "string" ? item["name"] : "Tone",
        path: item["path"],
      },
    ];
  });
}

/** All tones: built-in synths plus admin uploads with signed URLs. */
export function useRadarTones() {
  const settings = useSettings();
  const custom = parseCustom((settings as { radar_tones?: unknown }).radar_tones);
  const paths = custom.map((c) => c.path!).sort();

  const { data: signed } = useQuery({
    queryKey: ["radar-tone-urls", paths],
    enabled: paths.length > 0,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("radar-tones").createSignedUrls(paths, 60 * 60);
      const map: Record<string, string> = {};
      (data ?? []).forEach((entry) => {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      });
      return map;
    },
  });

  const uploads = custom.map((c) => ({ ...c, url: signed?.[c.path!] }));
  return [...BUILTIN_TONES, ...uploads];
}

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function playNotes(notes: number[]) {
  const ac = audioContext();
  if (!ac) return;
  notes.forEach((freq, i) => {
    const start = ac.currentTime + i * 0.14;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

/** Plays a tone; safe to call when nothing is resolvable. */
export function playRadarTone(tone: RadarTone | undefined) {
  if (!tone) return;
  try {
    if (tone.notes?.length) {
      playNotes(tone.notes);
      return;
    }
    if (tone.url) {
      const audio = new Audio(tone.url);
      audio.volume = 0.6;
      void audio.play().catch(() => undefined);
    }
  } catch {
    /* audio unavailable */
  }
}
