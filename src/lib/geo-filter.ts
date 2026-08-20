/**
 * Kalman smoothing for GPS fixes.
 *
 * Phone GPS reports jitter of several metres even while standing still, which
 * makes radar distances jump around. This is the standard 1-D constant-position
 * Kalman filter used by mapping apps: each new fix is blended with the current
 * estimate weighted by the reported horizontal accuracy, and the estimate's own
 * uncertainty grows with time so real movement is still tracked promptly.
 */

export type Fix = {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in metres. */
  accuracy: number;
  /** Fix timestamp in ms. */
  at: number;
};

/** Metres of drift assumed per second while walking; tunes responsiveness. */
const PROCESS_NOISE_MPS = 1.4;
/** Fixes worse than this are ignored once a decent estimate exists. */
const MAX_USABLE_ACCURACY_M = 120;

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

    if (this.variance < 0) {
      this.lat = raw.latitude;
      this.lng = raw.longitude;
      this.variance = accuracy * accuracy;
      this.at = now;
      return { latitude: this.lat, longitude: this.lng, accuracy, at: now };
    }

    // Predict: uncertainty grows with elapsed time.
    const dt = Math.max(0, (now - this.at) / 1000);
    this.variance += dt * PROCESS_NOISE_MPS * PROCESS_NOISE_MPS;
    this.at = now;

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
