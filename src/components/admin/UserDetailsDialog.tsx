import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Trash2, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonAvatar } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  adminDeleteUser,
  adminSendPasswordReset,
  adminUpdateUser,
  getUserDetails,
  type AdminUserPatch,
} from "@/lib/admin-users.functions";

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm" data-selectable>
        {value}
      </p>
    </div>
  );
}

type FormState = {
  username: string;
  displayName: string;
  bio: string;
  gender: string;
  email: string;
  phone: string;
  password: string;
  verified: boolean;
  banned: boolean;
  bannedReason: string;
  role: string;
};

/** Staff-only account inspector with full admin editing controls. */
export function UserDetailsDialog({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchDetails = useServerFn(getUserDetails);
  const updateUser = useServerFn(adminUpdateUser);
  const deleteUser = useServerFn(adminDeleteUser);
  const sendReset = useServerFn(adminSendPasswordReset);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-user-details", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchDetails({ data: { userId: userId! } }),
  });

  useEffect(() => {
    if (!userId) {
      setEditing(false);
      setForm(null);
    }
  }, [userId]);

  useEffect(() => {
    if (!data) return;
    setForm({
      username: data.username,
      displayName: data.displayName ?? "",
      bio: data.bio ?? "",
      gender: data.gender ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      password: "",
      verified: data.verified,
      banned: data.banned,
      bannedReason: data.bannedReason ?? "",
      role: data.roles[0] ?? "user",
    });
  }, [data]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-people"] });
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!data || !form) return;
      const patch: AdminUserPatch = { userId: data.id };
      if (form.username !== data.username) patch.username = form.username.trim();
      if (form.displayName !== (data.displayName ?? "")) patch.displayName = form.displayName.trim();
      if (form.bio !== (data.bio ?? "")) patch.bio = form.bio.trim();
      if (form.gender !== (data.gender ?? "")) patch.gender = form.gender;
      if (form.email.trim() && form.email.trim() !== (data.email ?? "")) patch.email = form.email.trim();
      if (form.phone !== (data.phone ?? "")) patch.phone = form.phone.trim();
      if (form.password) patch.password = form.password;
      if (form.verified !== data.verified) patch.verified = form.verified;
      if (form.banned !== data.banned || form.bannedReason !== (data.bannedReason ?? "")) {
        patch.banned = form.banned;
        patch.bannedReason = form.banned ? form.bannedReason.trim() || null : null;
      }
      if (form.role !== (data.roles[0] ?? "user")) {
        patch.role = form.role as "admin" | "moderator" | "user";
      }
      if (Object.keys(patch).length === 1) return;
      await updateUser({ data: patch });
    },
    onSuccess: () => {
      toast.success("Account updated");
      setEditing(false);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update account"),
  });

  const reset = useMutation({
    mutationFn: async () => {
      if (!data) return null;
      return await sendReset({
        data: {
          userId: data.id,
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined,
        },
      });
    },
    onSuccess: (res) => toast.success(res ? `Reset link sent to ${res.email}` : "Reset link sent"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send reset link"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!data) return;
      await deleteUser({ data: { userId: data.id } });
    },
    onSuccess: () => {
      toast.success("Account deleted");
      onOpenChange(false);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete account"),
  });

  return (
    <Dialog open={Boolean(userId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data ? (
              <>
                <PersonAvatar
                  path={data.avatarUrl}
                  name={data.displayName}
                  username={data.username}
                  gender={data.gender as import("@/components/PersonAvatar").Gender}
                  className="size-8"
                />
                <span className="truncate">{data.displayName ?? data.username}</span>
                {data.verified && <VerifiedBadge />}
              </>
            ) : (
              "Account details"
            )}
          </DialogTitle>
          <DialogDescription>
            {data ? `@${data.username}` : "Full account record for this member."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <p className="py-6 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load this account"}
          </p>
        )}

        {data && !editing && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit account
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={reset.isPending}
                onClick={() => reset.mutate()}
              >
                <KeyRound className="size-4" /> Send reset link
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm("Permanently delete this account? This cannot be undone."))
                    remove.mutate();
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Email" value={data.email ?? "—"} />
              <Field label="Email confirmed" value={data.emailConfirmed ? "Yes" : "No"} />
              <Field label="Phone" value={data.phone ?? "—"} />
              <Field label="Gender" value={data.gender ?? "—"} />
              <Field label="Joined" value={when(data.createdAt)} />
              <Field label="Last sign-in" value={when(data.lastSignInAt)} />
              <Field label="Last seen" value={when(data.lastSeen)} />
              <Field label="Sign-in methods" value={data.providers.join(", ") || "email"} />
              <Field label="Roles" value={data.roles.join(", ") || "user"} />
              <Field
                label="Status"
                value={
                  data.banned
                    ? `Banned${data.bannedReason ? ` — ${data.bannedReason}` : ""}`
                    : "Active"
                }
              />
            </div>

            {data.bio && <Field label="Bio" value={data.bio} />}

            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                Activity
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <Field label="Signals sent" value={String(data.counts.signalsSent)} />
                <Field label="Signals got" value={String(data.counts.signalsReceived)} />
                <Field label="Matches" value={String(data.counts.matches)} />
                <Field label="Messages" value={String(data.counts.messages)} />
                <Field label="Reports" value={String(data.counts.reportsAgainst)} />
                <Field
                  label="Location"
                  value={
                    data.location
                      ? `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`
                      : "—"
                  }
                />
              </div>
            </div>

            <Field label="User ID" value={data.id} />
          </div>
        )}

        {data && editing && form && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="au-username">Username</Label>
                <Input
                  id="au-username"
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-display">Display name</Label>
                <Input
                  id="au-display"
                  value={form.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-email">Email</Label>
                <Input
                  id="au-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-phone">Phone</Label>
                <Input
                  id="au-phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-password">New password</Label>
                <Input
                  id="au-password"
                  type="text"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender || "unset"} onValueChange={(v) => set("gender", v === "unset" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not set</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => set("role", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="au-bio">Bio</Label>
              <Textarea
                id="au-bio"
                rows={3}
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="au-verified">Verified</Label>
              <Switch
                id="au-verified"
                checked={form.verified}
                onCheckedChange={(v) => set("verified", v)}
              />
            </div>

            <div className="space-y-2 rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="au-banned">Banned</Label>
                <Switch
                  id="au-banned"
                  checked={form.banned}
                  onCheckedChange={(v) => set("banned", v)}
                />
              </div>
              {form.banned && (
                <Input
                  placeholder="Reason"
                  value={form.bannedReason}
                  onChange={(e) => set("bannedReason", e.target.value)}
                />
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="size-4 animate-spin" />} Save changes
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                <X className="size-4" /> Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
