/**
 * Adaptive smoothing for GPS fixes.
 *
 * Phone GPS reports jitter of several metres even while standing still, which
 * makes radar distances jump around. This is a 1-D constant-position Kalman
 * filter: each new fix is blended with the current estimate weighted by the
 * reported horizontal accuracy, and the estimate's own uncertainty grows with
 * time so real movement is still tracked promptly.
 *
 * Two things keep it honest while walking, where a plain filter lags behind:
 *  - process noise follows the device's reported speed, so the estimate opens
 *    up as fast as the user actually moves;
 *  - a fix that lands far outside the current uncertainty (a genuine jump, or
 *    the first good fix after a drive) resets the estimate instead of being
 *    dragged towards slowly.
 *
 * Distances between points use GeographicLib (Karney's exact geodesic
 * algorithm) on the WGS84 ellipsoid — accurate to nanometres and always
 * convergent, unlike Vincenty — matching the ellipsoidal distance the server
 * reports via PostGIS.
 */
import { Geodesic } from "geographiclib-geodesic";

const geod = Geodesic.WGS84;

export type Fix = {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in metres. */
  accuracy: number;
  /** Fix timestamp in ms. */
  at: number;
};

/** Metres of drift assumed per second when the device reports no speed. */
const IDLE_PROCESS_NOISE_MPS = 1.4;
/** Fixes worse than this are ignored once a decent estimate exists. */
const MAX_USABLE_ACCURACY_M = 120;
/** A fix this many sigmas away is real movement, not noise: re-anchor on it. */
const JUMP_SIGMAS = 4;

/** Exact WGS84 ellipsoidal distance in metres between two coordinates. */
export function preciseDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  // 0.01 m resolution keeps close-quarters readings meaningful.
  return getPreciseDistance(a, b, 0.01);
}

export class GeoKalman {
  private lat = 0;
  private lng = 0;
  private variance = -1; // metres^2; negative means "uninitialised"
  private at = 0;

  /** Feeds a raw fix and returns the smoothed position, or null if rejected. */
  process(raw: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    /** Ground speed in m/s, when the platform reports it. */
    speed?: number | null;
    at?: number;
  }): Fix | null {
    const now = raw.at ?? Date.now();
    if (!Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude)) return null;

    const accuracy =
      typeof raw.accuracy === "number" && Number.isFinite(raw.accuracy) && raw.accuracy > 0
        ? raw.accuracy
        : 50;

    // Drop clearly coarse (wifi / cell tower) fixes once we hold a good one.
    if (this.variance >= 0 && accuracy > MAX_USABLE_ACCURACY_M && this.variance < 900) {
      return null;
    }

    const anchor = () => {
      this.lat = raw.latitude;
      this.lng = raw.longitude;
      this.variance = accuracy * accuracy;
      this.at = now;
      return { latitude: this.lat, longitude: this.lng, accuracy, at: now };
    };

    if (this.variance < 0) return anchor();

    const gap = preciseDistance(
      { latitude: this.lat, longitude: this.lng },
      { latitude: raw.latitude, longitude: raw.longitude },
    );

    // Predict: uncertainty grows with elapsed time, faster while moving.
    const dt = Math.max(0, (now - this.at) / 1000);
    const speed =
      typeof raw.speed === "number" && Number.isFinite(raw.speed) && raw.speed > 0
        ? raw.speed
        : dt > 0
          ? gap / dt
          : 0;
    const drift = Math.max(IDLE_PROCESS_NOISE_MPS, speed * 1.5);
    this.variance += dt * drift * drift;
    this.at = now;

    // A fix well outside the combined uncertainty is real displacement, so
    // follow it immediately rather than easing towards it over many updates.
    if (gap > JUMP_SIGMAS * Math.sqrt(this.variance + accuracy * accuracy)) return anchor();

    // Update: blend by Kalman gain.
    const gain = this.variance / (this.variance + accuracy * accuracy);
    this.lat += gain * (raw.latitude - this.lat);
    this.lng += gain * (raw.longitude - this.lng);
    this.variance = (1 - gain) * this.variance;

    return {
      latitude: this.lat,
      longitude: this.lng,
      accuracy: Math.max(1, Math.sqrt(this.variance)),
      at: now,
    };
  }

  /** Current smoothed uncertainty in metres, or null before the first fix. */
  get accuracy(): number | null {
    return this.variance < 0 ? null : Math.max(1, Math.sqrt(this.variance));
  }

  reset() {
    this.variance = -1;
  }
}

