import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Bell, Camera, Ban, ShieldCheck } from "lucide-react";
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
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/hooks/useNotifications";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your SkanAround profile" },
      {
        name: "description",
        content: "Set the name, photo and line people see when you signal them on SkanAround.",
      },
      { property: "og:title", content: "Your SkanAround profile" },
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

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
          Sign out
        </Button>
      </section>
    </main>
  );
}
