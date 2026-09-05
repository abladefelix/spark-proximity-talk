import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import {
  BiometricAuth,
  BiometryType,
  type CheckBiometryResult,
} from "@aparajita/capacitor-biometric-auth";
import { nativeDebug, nativeDebugError } from "@/lib/native-debug";

const PREF_KEY = "skanaround:biometric-lock";
/** Re-lock only after the app has been away long enough to change hands. */
const RELOCK_AFTER_MS = 20_000;

export function isBiometricPrefEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREF_KEY) === "1";
}

export function setBiometricPref(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
}

export function isBiometricPlatform() {
  return Capacitor.isNativePlatform();
}

export async function checkBiometry(): Promise<CheckBiometryResult | null> {
  if (!isBiometricPlatform()) return null;
  try {
    const res = await BiometricAuth.checkBiometry();
    nativeDebug("biometry:check", {
      isAvailable: res.isAvailable,
      deviceIsSecure: res.deviceIsSecure,
      biometryType: res.biometryType,
      reason: res.reason,
      code: res.code,
    });
    return res;
  } catch (err) {
    nativeDebugError("biometry:check", err);
    return null;
  }
}

/** Friendly name for what the device offers (Android reports numeric types). */
export function biometryLabel(res: CheckBiometryResult | null): string {
  const type = res?.biometryType;
  switch (type) {
    case BiometryType.faceId:
    case BiometryType.faceAuthentication:
      return "Face unlock";
    case BiometryType.touchId:
    case BiometryType.fingerprintAuthentication:
      return "Fingerprint unlock";
    case BiometryType.irisAuthentication:
      return "Iris unlock";
    default:
      return res?.deviceIsSecure ? "Screen lock" : "Biometric unlock";
  }
}

/** Turns a plugin failure into something a member can act on. */
export function describeBiometryError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "userCancel":
    case "systemCancel":
    case "appCancel":
      return "Unlock cancelled. Tap Unlock to try again.";
    case "authenticationFailed":
      return "Not recognised. Try again.";
    case "biometryNotEnrolled":
      return "No fingerprint or face is set up on this phone. Add one in your phone's settings.";
    case "biometryNotAvailable":
      return "This phone's fingerprint or face sensor is unavailable right now.";
    case "biometryLockout":
      return "Too many attempts. Unlock your phone with its PIN or pattern, then try again.";
    case "noDeviceCredential":
    case "passcodeNotSet":
      return "Set a screen lock (PIN, pattern or password) on your phone first.";
    default:
      return (err as { message?: string } | null)?.message || "Verification failed. Try again.";
  }
}

export async function runBiometricPrompt(reason: string) {
  await BiometricAuth.authenticate({
    reason,
    cancelTitle: "Cancel",
    allowDeviceCredential: true,
    iosFallbackTitle: "Use passcode",
    androidTitle: "Unlock SKANAROUND",
    androidSubtitle: reason,
    // Weak biometry (most Android face unlock) otherwise adds a second
    // "Confirm" tap that many people never notice, so unlock looks stuck.
    androidConfirmationRequired: false,
  });
}

type LockState = {
  locked: boolean;
  unlocking: boolean;
  error: string | null;
  unlock: () => Promise<void>;
};

const BiometricLockContext = createContext<LockState | null>(null);

export function useBiometricLock() {
  const ctx = useContext(BiometricLockContext);
  if (!ctx) throw new Error("useBiometricLock must be used inside BiometricLockProvider");
  return ctx;
}

export function BiometricLockProvider({ children }: { children: React.ReactNode }) {
  const enabled = isBiometricPlatform() && isBiometricPrefEnabled();
  const [locked, setLocked] = useState(enabled);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (!isBiometricPlatform()) {
      setLocked(false);
      return;
    }
    // Android fires the app-state listener while the prompt is on screen; a
    // second authenticate() call cancels the first one and nothing happens.
    if (prompting.current) return;
    prompting.current = true;
    setUnlocking(true);
    setError(null);
    try {
      nativeDebug("biometry:prompt");
      await runBiometricPrompt("Unlock SKANAROUND");
      setLocked(false);
    } catch (err) {
      nativeDebugError("biometry:prompt", err);
      setError(describeBiometryError(err));
    } finally {
      prompting.current = false;
      setUnlocking(false);
    }
  }, []);

  // Prompt as soon as the lock screen appears on a cold start. If this phone
  // can't do biometry at all, never trap the member behind the lock screen.
  useEffect(() => {
    if (!locked) return;
    void (async () => {
      const res = await checkBiometry();
      if (res && !res.isAvailable && !res.deviceIsSecure) {
        setLocked(false);
        return;
      }
      await unlock();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-lock when the app returns from the background.
  useEffect(() => {
    if (!isBiometricPlatform()) return;
    let remove: (() => void) | undefined;
    void CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isBiometricPrefEnabled()) return;
      // The system prompt itself backgrounds the app on Android — ignore that.
      if (prompting.current) return;
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since && Date.now() - since > RELOCK_AFTER_MS) {
        setLocked(true);
        void unlock();
      }
    }).then((handle) => {
      remove = () => void handle.remove();
    });
    return () => remove?.();
  }, [unlock]);

  return (
    <BiometricLockContext.Provider value={{ locked, unlocking, error, unlock }}>
      {children}
    </BiometricLockContext.Provider>
  );
}
