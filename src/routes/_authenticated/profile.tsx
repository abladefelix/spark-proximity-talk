import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/PersonAvatar";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your SHATTA profile" },
      {
        name: "description",
        content: "Set the name, photo and line people see when you signal them on SHATTA.",
      },
      { property: "og:title", content: "Your SHATTA profile" },
      { property: "og:description", content: "The face people see when you signal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", me).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
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
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
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
            username={profile?.username ?? "?"}
            className="size-24 rounded-2xl"
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
          <p className="truncate text-base font-semibold">@{profile?.username ?? "…"}</p>
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
        <Button variant="heat" size="lg" className="w-full" disabled={saving} onClick={save}>
          Save profile
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
          Sign out
        </Button>
      </section>
    </main>
  );
}
