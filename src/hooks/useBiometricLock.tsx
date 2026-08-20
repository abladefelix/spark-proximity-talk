import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { BiometricAuth, type CheckBiometryResult } from "@aparajita/capacitor-biometric-auth";

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
    return await BiometricAuth.checkBiometry();
  } catch {
    return null;
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

  const unlock = useCallback(async () => {
    if (!isBiometricPlatform()) {
      setLocked(false);
      return;
    }
    setUnlocking(true);
    setError(null);
    try {
      await runBiometricPrompt("Unlock SKANAROUND");
      setLocked(false);
    } catch {
      setError("Not recognised. Try again.");
    } finally {
      setUnlocking(false);
    }
  }, []);

  // Prompt as soon as the lock screen appears on a cold start.
  useEffect(() => {
    if (locked) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-lock when the app returns from the background.
  useEffect(() => {
    if (!isBiometricPlatform()) return;
    let remove: (() => void) | undefined;
    void CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isBiometricPrefEnabled()) return;
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
