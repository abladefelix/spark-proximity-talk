import { useCallback, useEffect, useState } from "react";

export type DistanceUnit = "metric" | "imperial";

const KEY = "skanaround-distance-unit";
const EVENT = "skanaround-distance-unit-change";

function read(): DistanceUnit {
  if (typeof window === "undefined") return "metric";
  try {
    return localStorage.getItem(KEY) === "imperial" ? "imperial" : "metric";
  } catch {
    return "metric";
  }
}

/** Formats a metre distance in the user's chosen unit, keeping fine precision up close. */
export function formatDistance(m: number, unit: DistanceUnit = "metric") {
  const metres = Math.max(0, m);
  if (unit === "imperial") {
    const ft = metres * 3.28084;
    if (ft < 100) return `${(Math.round(ft * 10) / 10).toFixed(1)} ft`;
    if (ft < 1000) return `${Math.round(ft)} ft`;
    const mi = metres / 1609.344;
    return `${mi.toFixed(mi < 10 ? 2 : 1)} mi`;
  }
  if (metres < 100) return `${(Math.round(metres * 10) / 10).toFixed(1)} m`;
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 2 : 1)} km`;
}

/** Short unit-aware label for accuracy radii (±X m / ±X ft). */
export function formatAccuracy(m: number, unit: DistanceUnit = "metric") {
  return unit === "imperial"
    ? `${Math.round(m * 3.28084)} ft`
    : `${Math.round(m)} m`;
}

/** Distance unit preference, shared across the app and persisted locally. */
export function useDistanceUnit() {
  const [unit, setUnitState] = useState<DistanceUnit>("metric");

  useEffect(() => {
    setUnitState(read());
    const sync = () => setUnitState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setUnit = useCallback((next: DistanceUnit) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable */
    }
    setUnitState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggleUnit = useCallback(() => {
    setUnit(read() === "imperial" ? "metric" : "imperial");
  }, [setUnit]);

  return { unit, setUnit, toggleUnit };
}
