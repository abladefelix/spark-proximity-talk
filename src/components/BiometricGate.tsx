import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BiometricLockProvider, useBiometricLock } from "@/hooks/useBiometricLock";

/**
 * Blocks the signed-in app behind Face ID / fingerprint when the member has
 * turned the lock on. Web sessions are unaffected — there is no biometry there.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  return (
    <BiometricLockProvider>
      <GateBody>{children}</GateBody>
    </BiometricLockProvider>
  );
}

function GateBody({ children }: { children: React.ReactNode }) {
  const { locked, unlocking, error, unlock } = useBiometricLock();

  if (!locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center">
      <div className="grid size-20 place-items-center rounded-full border border-primary/30 bg-primary/10">
        <Fingerprint className="size-9 text-primary" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">SKANAROUND is locked</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify it&apos;s you to get back on the radar.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={() => void unlock()} disabled={unlocking} className="rounded-full px-8">
        {unlocking ? "Waiting…" : "Unlock"}
      </Button>
    </div>
  );
}
