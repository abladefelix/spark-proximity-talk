import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { nativeDebug, nativeDebugError } from "@/lib/native-debug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/Brand";
import { useSettings } from "@/hooks/useAppSettings";
import {
  signInSingleDevice,
  revokeOtherDeviceAndSignIn,
  requestPasswordResetFor,
  claimThisDevice,
} from "@/lib/device-session.functions";
import { getDeviceId, getDeviceLabel } from "@/lib/device-id";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to SKANAROUND — Chat with people around you" },
      {
        name: "description",
        content:
          "Create your SKANAROUND account or sign in to see who is nearby, send a signal and start chatting.",
      },
      { property: "og:title", content: "Sign in to SKANAROUND" },
      {
        property: "og:description",
        content: "Join SKANAROUND and meet the people sharing your spot right now.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

/** Whole years between a YYYY-MM-DD date and today; null when unparseable. */
function ageFrom(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const before =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (before) years -= 1;
  return years;
}

function AuthPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // Sign-in accepts either an email address or a username.
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Set when the account is already signed in on another device.
  const [otherDevice, setOtherDevice] = useState<{ label: string; lastSeen: string } | null>(null);
  // Set when a sign-in is refused because the email is not confirmed yet —
  // shows the "resend activation email" card.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // While a sign-up is completing we must not auto-redirect on a transient session.
  const signingUp = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown > 0]);

  async function resendActivation(target: string) {
    const addr = target.trim();
    if (!addr.includes("@")) {
      toast.error("Enter your email address (not your username) to resend the activation email");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: addr,
        options: { emailRedirectTo: `${window.location.origin}/verified` },
      });
      if (error) throw error;
      toast.success(`Activation email resent to ${addr}`);
      setResendCooldown(60);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the email — try again shortly");
    } finally {
      setResending(false);
    }
  }

  async function takeOverDevice() {
    setBusy(true);
    try {
      const id = identifier.trim();
      if (id.includes("@")) {
        const { error } = await supabase.auth.signInWithPassword({ email: id, password });
        if (error) throw error;
        await claimThisDevice({
          data: { deviceId: getDeviceId(), deviceLabel: getDeviceLabel(), force: true },
        });
      } else {
        const res = await revokeOtherDeviceAndSignIn({
          data: {
            identifier: id,
            password,
            deviceId: getDeviceId(),
            deviceLabel: getDeviceLabel(),
          },
        });
        const { error } = await supabase.auth.setSession({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        if (error) throw error;
      }
      setOtherDevice(null);
      navigate({ to: "/radar" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign the other device out");
    } finally {
      setBusy(false);
    }
  }


  async function resetFromDeviceBlock() {
    setBusy(true);
    try {
      await requestPasswordResetFor({
        data: {
          identifier: identifier.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      setOtherDevice(null);
      toast.success("Check your email for the password reset link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the reset link");
    } finally {
      setBusy(false);
    }
  }


  // A restored email session can land here when the native shell resumes.
  useEffect(() => {
    let active = true;
    const check = () => {
      supabase.auth.getSession().then(({ data }) => {
        if (active && data.session && !signingUp.current) navigate({ to: "/radar" });
      });
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && !signingUp.current) navigate({ to: "/radar" });
    });
    window.addEventListener("focus", check);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", check);
    };
  }, [navigate]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    nativeDebug("sign-in submit", { mode, identifierType: identifier.includes("@") ? "email" : "username" });
    try {
      if (mode === "reset") {
        // Accepts a username or an email — the server resolves it to the
        // account's address, so people who signed up with a username can
        // still recover their password.
        await requestPasswordResetFor({
          data: {
            identifier: identifier.trim(),
            redirectTo: `${window.location.origin}/reset-password`,
          },
        });
        toast.success("If that account exists, a reset link is on its way");
        return;
      }

      if (mode === "signup") {
        signingUp.current = true;
        if (!settings.signups_enabled) {
          toast.error("New sign-ups are closed right now");
          return;
        }
        const clean = username.trim().toLowerCase().replace(/\s+/g, "_");
        if (clean.length < 3) {
          toast.error("Pick a username with at least 3 characters");
          return;
        }
        // Age gate — both stores require an age check on a dating/discovery app.
        const minAge = settings.min_age || 18;
        const age = ageFrom(dob);
        if (age === null) {
          toast.error("Enter your date of birth");
          return;
        }
        if (age < minAge) {
          toast.error(`You must be ${minAge} or older to use SKANAROUND`);
          return;
        }
        if (!gender) {
          toast.error("Choose your gender");
          return;
        }
        if (!acceptedTerms) {
          toast.error("Please accept the Terms and Privacy Policy");
          return;
        }
        // Catch a taken username before sign-up so people get a clear message
        // instead of a generic account-creation failure.
        const { data: free, error: nameErr } = await supabase.rpc("username_available", {
          _username: clean,
        });
        if (!nameErr && free === false) {
          toast.error("That username is already taken — try another one");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/verified`,
            data: {
              username: clean,
              display_name: username.trim(),
              date_of_birth: dob,
              gender,
            },
          },
        });
        if (error) throw error;
        // With email confirmation on, signUp returns no session — the account
        // is not usable until the link in the email is clicked.
        const needsConfirmation = !data.session;
        // Send them to the sign-in form instead of assuming a session exists.
        await supabase.auth.signOut();
        setPassword("");
        setUsername("");
        setDob("");
        setGender("");
        setAcceptedTerms(false);
        setMode("signin");
        toast.success(
          needsConfirmation
            ? `Almost there — check ${email} and tap the confirmation link to activate your account.`
            : "Account created. Sign in to continue.",
        );
        return;
      } else {
        const id = identifier.trim();
        if (id.includes("@")) {
          // Email sign-in is checked straight with the auth service from the
          // app, so it cannot be broken by the app server's own backend
          // settings. The device claim happens afterwards with the session.
          const { error } = await supabase.auth.signInWithPassword({ email: id, password });
          if (error) throw error;
          nativeDebug("email authentication succeeded");
          try {
            const claim = await claimThisDevice({
              data: { deviceId: getDeviceId(), deviceLabel: getDeviceLabel() },
            });
            if (claim.status === "other_device") {
              nativeDebug("device claim blocked by another device");
              setOtherDevice({ label: claim.device_label, lastSeen: claim.last_seen });
              await supabase.auth.signOut();
              return;
            }
          } catch {
            // The device check is a safety net, not a gate — never block a
            // person who just proved their password.
          }
        } else {
          let res: Awaited<ReturnType<typeof signInSingleDevice>> | null = null;
          res = await signInSingleDevice({
            data: {
              identifier: id,
              password,
              deviceId: getDeviceId(),
              deviceLabel: getDeviceLabel(),
            },
          });
          if (res.status === "other_device") {
            setOtherDevice({ label: res.device_label, lastSeen: res.last_seen });
            return;
          }
          const { error } = await supabase.auth.setSession({
            access_token: res.access_token,
            refresh_token: res.refresh_token,
          });
          if (error) throw error;
          nativeDebug("username authentication session stored");
        }
      }

      nativeDebug("navigating to radar");
      navigate({ to: "/radar" });


    } catch (err) {
      nativeDebugError("sign-in flow failed", err);
      const raw = err instanceof Error ? err.message : "Something went wrong";
      if (mode !== "signup" && /email not confirmed|not confirmed/i.test(raw)) {
        // Offer to send a fresh activation link — the first one may have been
        // delayed or landed in spam.
        if (identifier.trim().includes("@")) setUnconfirmedEmail(identifier.trim());
        toast.error("Confirm your email first — tap the link we sent you, then sign in.");
        return;
      }
      toast.error(
        /username_already_taken|username.*(already|taken)|duplicate key/i.test(raw)
          ? "That username is already taken — try another one."
          : // A trigger rejection during sign-up surfaces as a generic database
            // error from auth; on the sign-up form that almost always means the
            // username check raced with another registration.
            mode === "signup" && /database error saving new user/i.test(raw)
            ? "That username is already taken — try another one."
            : raw,
      );
    } finally {
      signingUp.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-md flex-col justify-center overflow-y-auto overscroll-none px-6 py-12">
      <Link
        to="/"
        className="flex items-center gap-2 text-sm font-semibold tracking-[0.28em] text-muted-foreground"
      >
        <Brand className="flex items-center gap-2 text-sm font-semibold tracking-[0.28em] text-muted-foreground" />
      </Link>
      <h1 className="mt-6 text-3xl leading-tight">
        {mode === "signup" ? "Join the block" : mode === "reset" ? "Reset password" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "reset"
          ? "Enter your email and we'll send you a link to set a new password."
          : settings.tagline}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kofi_vibes"
              required
            />
          </div>
        )}
        {mode !== "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="identifier">Username or email</Label>
            <Input
              id="identifier"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="kofi_vibes or you@email.com"
              required
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}
        {mode !== "reset" && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        )}
        {mode === "signup" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDob(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                You must be {settings.min_age || 18} or older. We only use this to verify your age.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["male", "female", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`rounded-xl border px-3 py-2 text-sm capitalize transition ${
                      gender === g
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                This sets your beacon avatar on the radar.
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <Link to="/terms" className="text-foreground underline underline-offset-4">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-foreground underline underline-offset-4">
                  Privacy Policy
                </Link>
                , and I understand there is zero tolerance for abusive content or behaviour.
              </span>
            </label>
          </>
        )}
        <Button type="submit" variant="heat" size="lg" className="w-full" disabled={busy}>
          {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
        </Button>
        {mode === "signin" && (
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode("reset")}
          >
            Forgot your password?
          </button>
        )}
        {mode === "signin" && unconfirmedEmail && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center">
            <p className="text-sm">
              <span className="font-medium">{unconfirmedEmail}</span>{" "}
              <span className="text-muted-foreground">isn’t activated yet.</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Email slow to arrive? Check spam, or request a fresh link.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              disabled={resending || resendCooldown > 0}
              onClick={() => resendActivation(unconfirmedEmail)}
            >
              {resending
                ? "Sending…"
                : resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : "Resend activation email"}
            </Button>
          </div>
        )}
        {mode === "signin" && !unconfirmedEmail && identifier.trim().includes("@") && (
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            disabled={resending || resendCooldown > 0}
            onClick={() => resendActivation(identifier)}
          >
            {resendCooldown > 0
              ? `Activation email resent — available again in ${resendCooldown}s`
              : "Signed up but never got the activation email? Resend it"}
          </button>
        )}
      </form>

      {(settings.signups_enabled || mode === "signup") && (
        <button
          type="button"
          className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      )}

      <Dialog open={otherDevice !== null} onOpenChange={(open) => !open && setOtherDevice(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] min-w-0 max-w-sm gap-5 rounded-2xl p-5">
          <DialogHeader className="min-w-0 pr-7 text-left">
            <DialogTitle className="leading-snug">Already signed in elsewhere</DialogTitle>
            <DialogDescription className="break-words leading-relaxed">
              Your account is active on {otherDevice?.label ?? "another device"}
              {otherDevice?.lastSeen
                ? ` (last used ${new Date(otherDevice.lastSeen).toLocaleString()})`
                : ""}
              . SKANAROUND allows one device at a time — sign out there, or sign that device out
              from here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="heat"
              size="lg"
              className="h-auto min-h-11 w-full whitespace-normal px-4 py-3 text-center leading-snug"
              disabled={busy}
              onClick={takeOverDevice}
            >
              Sign out the other device
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-auto min-h-11 w-full whitespace-normal px-4 py-3 text-center leading-snug"
              disabled={busy}
              onClick={resetFromDeviceBlock}
            >
              That wasn't me — reset my password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </main>
  );
}
