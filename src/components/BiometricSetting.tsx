import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  biometryLabel,
  checkBiometry,
  describeBiometryError,
  isBiometricPlatform,
  isBiometricPrefEnabled,
  runBiometricPrompt,
  setBiometricPref,
} from "@/hooks/useBiometricLock";

/** Member control: require Face ID / fingerprint to open the app. */
export function BiometricSetting() {
  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState("Biometric unlock");
  const [reason, setReason] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(isBiometricPrefEnabled());
    void checkBiometry().then((res) => {
      if (!res) {
        // The availability check itself failed (e.g. plugin not ready). Keep
        // the switch usable so the member can try — the prompt surfaces the
        // real error — instead of leaving a dead, disabled toggle.
        setAvailable(true);
        return;
      }
      const ok = res.isAvailable || res.deviceIsSecure;
      setAvailable(ok);
      setLabel(biometryLabel(res));
      setReason(ok ? null : (res.reason ?? null));
    });
  }, []);

  if (!isBiometricPlatform()) return null;

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        await runBiometricPrompt("Turn on app lock");
        setBiometricPref(true);
        setEnabled(true);
        toast.success("App lock on");
      } else {
        await runBiometricPrompt("Turn off app lock");
        setBiometricPref(false);
        setEnabled(false);
        toast.success("App lock off");
      }
    } catch (err) {
      toast.error(describeBiometryError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Fingerprint className="size-4 text-primary" /> App lock
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {available
              ? `Require ${label.toLowerCase()} each time you open SKANAROUND.`
              : (reason ??
                "Set up Face ID, fingerprint or a device passcode to use app lock.")}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={!available || busy}
          onCheckedChange={(v) => void toggle(v)}
        />
      </div>
    </div>
  );
}
