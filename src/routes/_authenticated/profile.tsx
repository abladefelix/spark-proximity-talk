import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Bell, Camera, Ban, ShieldCheck, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteMyAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useSettings } from "@/hooks/useAppSettings";
import { ScanRangeSetting } from "@/components/ScanRangeSetting";
import { ChatBackgroundSetting } from "@/components/ChatBackgroundSetting";
import { RadarSoundSetting } from "@/components/RadarSoundSetting";
import { BiometricSetting } from "@/components/BiometricSetting";
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/hooks/useNotifications";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your SKANAROUND profile" },
      {
        name: "description",
        content: "Set the name, photo and line people see when you signal them on SKANAROUND.",
      },
      { property: "og:title", content: "Your SKANAROUND profile" },
      { property: "og:description", content: "The face people see when you signal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const settings = useSettings();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<string>("unset");
  const [saving, setSaving] = useState(false);
  const [notifState, setNotifState] = useState<string>("default");

  useEffect(() => {
    setNotifState(notificationPermission());
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", me).maybeSingle();
      return data;
    },
  });

  const { data: verification } = useQuery({
    queryKey: ["verification"],
    queryFn: async () => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return null;
      const { data } = await supabase
        .from("verification_requests")
        .select("status")
        .eq("user_id", me)
        .maybeSingle();
      return data;
    },
  });

  const { data: isStaff = false } = useQuery({
    queryKey: ["is-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role");
      return (data ?? []).some((r) => r.role === "admin" || r.role === "moderator");
    },
  });

  const { data: blocked = [] } = useQuery({
    queryKey: ["blocked"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("blocks").select("id, blocked");
      if (!rows?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in(
          "id",
          rows.map((r) => r.blocked),
        );
      return rows.map((r) => ({
        blockId: r.id,
        person: profiles?.find((p) => p.id === r.blocked),
      }));
    },
  });

  async function unblock(blockId: string) {
    const { error } = await supabase.from("blocks").delete().eq("id", blockId);
    if (error) {
      toast.error("Couldn't unblock");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["blocked"] });
    queryClient.invalidateQueries({ queryKey: ["nearby"] });
  }

  async function submitVerification(file: File) {
    const me = profile?.id;
    if (!me) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${me}/selfie-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("verifications").upload(path, file);
    if (upErr) {
      toast.error("Upload failed");
      return;
    }
    const { error } = await supabase
      .from("verification_requests")
      .upsert(
        { user_id: me, selfie_path: path, status: "pending", reviewed_at: null },
        { onConflict: "user_id" },
      );
    if (error) {
      toast.error("Couldn't submit for verification");
      return;
    }
    toast.success("Selfie sent — we'll review it shortly");
    queryClient.invalidateQueries({ queryKey: ["verification"] });
  }

  async function enableNotifications() {
    const result = await requestNotificationPermission();
    setNotifState(result);
    if (result === "granted") toast.success("Notifications on");
    else if (result === "denied") toast.error("Notifications blocked in your browser settings");
  }

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setGender(profile.gender ?? "unset");
    }
  }, [profile]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        gender: gender === "unset" ? null : gender,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save");
      return;
    }
    toast.success("Profile updated");
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
  }

  async function uploadPhoto(file: File) {
    if (!profile) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Upload failed");
      return;
    }
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", profile.id);
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    toast.success("Photo updated");
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="px-5 pt-8">
      <h1 className="text-2xl font-semibold">You</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This is what people see when your signal lands.
      </p>

      <section className="mt-6 flex items-center gap-4">
        <div className="relative">
          <PersonAvatar
            path={profile?.avatar_url}
            name={profile?.display_name}
            gender={gender === "unset" ? null : (gender as "male" | "female" | "other")}
            username={profile?.username ?? "?"}
            className="size-24 rounded-full"
          />
          <label className="absolute -bottom-2 -right-2 flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary">
            <Camera className="size-4 text-primary-foreground" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadPhoto(file);
              }}
            />
          </label>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-base font-semibold">
            @{profile?.username ?? "…"}
            {profile?.verified && <VerifiedBadge />}
          </p>
          <p className="text-xs text-muted-foreground">Username can't be changed</p>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">One line about you</Label>
          <Textarea
            id="bio"
            value={bio}
            maxLength={160}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Here for good vibes and better playlists."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">I identify as</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger id="gender">
              <SelectValue placeholder="Prefer not to say" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="unset">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Shown as your beacon icon on the radar when you have no photo.
          </p>
        </div>
        <Button variant="heat" size="lg" className="w-full" disabled={saving} onClick={save}>
          Save profile
        </Button>
      </section>

      <section className="mt-8 space-y-4">
        <ScanRangeSetting />
        <RadarSoundSetting />
        <BiometricSetting />
        <ChatBackgroundSetting />
        <div className="rounded-2xl border border-border p-4" hidden={!settings.verification_enabled}>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BadgeCheck className="size-4 text-primary" /> Verification
          </p>
          {profile?.verified ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Your profile is verified. People see the badge on your beacon.
            </p>
          ) : verification?.status === "pending" ? (
            <p className="mt-1 text-xs text-muted-foreground">Selfie under review.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                {verification?.status === "rejected"
                  ? "Your last selfie didn't match. Try again."
                  : "Send a quick selfie to get the verified badge and more signals back."}
              </p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold">
                <Camera className="size-3.5" /> Take a selfie
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void submitVerification(file);
                  }}
                />
              </label>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="size-4 text-primary" /> Notifications
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {notifState === "granted"
              ? "You'll be alerted when someone signals you or replies."
              : notifState === "denied"
                ? "Blocked in your browser settings."
                : notifState === "unsupported"
                  ? "Not supported on this device — you'll still see in-app alerts."
                  : "Get alerted when someone signals you or replies."}
          </p>
          {notifState === "default" && (
            <Button
              variant="soft"
              size="sm"
              className="mt-3"
              onClick={() => void enableNotifications()}
            >
              Turn on
            </Button>
          )}
        </div>

        {blocked.length > 0 && (
          <div className="rounded-2xl border border-border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Ban className="size-4" /> Blocked
            </p>
            <ul className="mt-3 space-y-2">
              {blocked.map(({ blockId, person }) => (
                <li key={blockId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">@{person?.username ?? "someone"}</span>
                  <button
                    type="button"
                    className="text-xs text-primary"
                    onClick={() => void unblock(blockId)}
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isStaff && (
          <Link
            to="/admin"
            className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Admin control
            </span>
            <span className="text-muted-foreground">›</span>
          </Link>
        )}

        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold">Legal & support</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link to="/terms" className="text-muted-foreground underline-offset-4 hover:underline">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-muted-foreground underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            {settings.support_email?.trim() ? (
              <a
                href={`mailto:${settings.support_email.trim()}`}
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                Contact support — {settings.support_email.trim()}
              </a>
            ) : null}
          </div>
        </div>

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
          Sign out
        </Button>

        <DeleteAccountSection />
      </section>
    </main>
  );
}

/**
 * Self-service, permanent account deletion. Required by Apple (5.1.1(v)) and
 * Google Play; the typed confirmation keeps it from being a one-tap accident.
 */
function DeleteAccountSection() {
  const navigate = useNavigate();
  const runDelete = useServerFn(deleteMyAccount);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await runDelete({ data: undefined });
      await supabase.auth.signOut();
      toast.success("Your account and data have been deleted.");
      navigate({ to: "/auth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete your account");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-destructive/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <Trash2 className="size-4" /> Delete account
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Permanently removes your profile, photos, chats, matches and login. This cannot be undone.
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirm("");
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="mt-3">
            Delete my account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything goes: your profile, photos, messages, matches and signals. There is no way
              to restore it. Type DELETE below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoCapitalize="characters"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirm.trim().toUpperCase() !== "DELETE" || busy}
              onClick={() => void submit()}
            >
              {busy ? "Deleting…" : "Delete forever"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
