/** The "why" behind a signal. Keep this list short and instantly readable. */
export type IntentDef = {
  key: string;
  emoji: string;
  label: string;
  /** Prefilled example so people know a note makes the signal land better. */
  hint: string;
};

export const INTENTS: IntentDef[] = [
  { key: "lunch", emoji: "🍜", label: "Lunch buddy", hint: "Grabbing lunch in 20 mins" },
  { key: "coffee", emoji: "☕", label: "Coffee run", hint: "Doing a coffee run — want one?" },
  { key: "networking", emoji: "💼", label: "Networking", hint: "Here for the conference" },
  { key: "gym", emoji: "🏋️", label: "Gym spot", hint: "Need a spotter on bench" },
  { key: "ride", emoji: "🚕", label: "Split a ride", hint: "Splitting a taxi to the airport" },
  { key: "help", emoji: "🆘", label: "Need quick help", hint: "Need a hand for two minutes" },
  { key: "work", emoji: "💻", label: "Co-working", hint: "Working here for a couple of hours" },
  { key: "explore", emoji: "🧭", label: "Exploring", hint: "New in town, showing myself around" },
];

const BY_KEY = new Map(INTENTS.map((i) => [i.key, i]));

export function intentFor(key: string | null | undefined): IntentDef | null {
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

/** "🍜 Lunch buddy · Grabbing lunch in 20 mins" */
export function intentSummary(key: string | null | undefined, note?: string | null) {
  const def = intentFor(key);
  if (!def) return null;
  return note ? `${def.emoji} ${def.label} · ${note}` : `${def.emoji} ${def.label}`;
}

/** Bat-Signal reasons: a real cry for help, not a social ping. */
export const HELP_KINDS = [
  { key: "jump-start", emoji: "🔋", label: "Emergency jump-start" },
  { key: "lost", emoji: "👛", label: "Lost something" },
  { key: "medical", emoji: "🚑", label: "Medical help" },
  { key: "unsafe", emoji: "🛡️", label: "I feel unsafe" },
  { key: "hands", emoji: "🤝", label: "Need an extra pair of hands" },
  { key: "directions", emoji: "🗺️", label: "Lost — need directions" },
] as const;

export function helpKindFor(key: string | null | undefined) {
  return HELP_KINDS.find((k) => k.key === key) ?? null;
}
