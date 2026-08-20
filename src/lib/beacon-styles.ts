/**
 * Pro "custom beacon" looks. Each style maps to the colours used for the
 * beacon ring, glow pool and ping on the radar. `null`/unknown falls back to
 * the member's gender colour.
 */
export type BeaconStyleId = "default" | "gold" | "aqua" | "violet" | "rose" | "emerald";

export type BeaconStyle = {
  id: BeaconStyleId;
  label: string;
  /** Raw colour used for ring / glow / ping so it works at any opacity. */
  color: string;
};

export const BEACON_STYLES: BeaconStyle[] = [
  { id: "default", label: "Classic", color: "" },
  { id: "gold", label: "Gold", color: "oklch(0.82 0.16 85)" },
  { id: "aqua", label: "Aqua", color: "oklch(0.78 0.14 190)" },
  { id: "violet", label: "Violet", color: "oklch(0.68 0.19 300)" },
  { id: "rose", label: "Rose", color: "oklch(0.72 0.19 15)" },
  { id: "emerald", label: "Emerald", color: "oklch(0.74 0.15 155)" },
];

export function beaconColor(style?: string | null): string | null {
  if (!style || style === "default") return null;
  return BEACON_STYLES.find((s) => s.id === style)?.color ?? null;
}
