import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  EyeOff,
  Flag,
  Loader2,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PersonAvatar } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin control — SHATTA" },
      {
        name: "description",
        content:
          "Moderation and control panel for SHATTA: people, roles, verification, reports and activity.",
      },
      { property: "og:title", content: "Admin control — SHATTA" },
      {
        property: "og:description",
        content: "Moderate people, roles, verification and reports on SHATTA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Role = "admin" | "moderator" | "user";

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5">
      <Icon className="size-3.5 shrink-0 text-primary" />
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}


function AdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ["admin-access"],
    queryFn: async () => {
      const me = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { data: roles } = await supabase.from("user_roles").select("role");
      const { data: adminExists } = await supabase.rpc("admin_exists");
      const list = (roles ?? []).map((r) => r.role as Role);
      return {
        me,
        roles: list,
        isStaff: list.includes("admin") || list.includes("moderator"),
        isAdmin: list.includes("admin"),
        adminExists: Boolean(adminExists),
      };
    },
  });

  const isStaff = access?.isStaff ?? false;
  const isAdmin = access?.isAdmin ?? false;

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["admin-people"],
    enabled: isStaff,
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, verified, last_seen, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
      }));
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["admin-reports"],
    enabled: isStaff,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("reports")
        .select("id, reason, created_at, reporter, reported")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!rows?.length) return [];
      const ids = [...new Set(rows.flatMap((r) => [r.reporter, r.reported]))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        reporterProfile: byId.get(r.reporter),
        reportedProfile: byId.get(r.reported),
      }));
    },
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ["admin-verifications"],
    enabled: isStaff,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("verification_requests")
        .select("id, user_id, selfie_path, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (!rows?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in(
          "id",
          rows.map((r) => r.user_id),
        );
      const signed = await Promise.all(
        rows.map(async (r) => {
          const { data } = await supabase.storage
            .from("verifications")
            .createSignedUrl(r.selfie_path, 300);
          return {
            ...r,
            selfieUrl: data?.signedUrl ?? null,
            person: (profiles ?? []).find((p) => p.id === r.user_id),
          };
        }),
      );
      return signed;
    },
  });

  function refreshAll() {
    for (const key of [
      "admin-stats",
      "admin-people",
      "admin-reports",
      "admin-verifications",
      "admin-access",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const claimAdmin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_first_admin");
      if (error) throw error;
      if (!data) throw new Error("An admin already exists");
      return data;
    },
    onSuccess: () => {
      toast.success("You're the admin now");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function setVerified(userId: string, verified: boolean) {
    const { error } = await supabase.from("profiles").update({ verified }).eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(verified ? "Verified" : "Verification removed");
    refreshAll();
  }

  async function reviewVerification(id: string, userId: string, approve: boolean) {
    const { error } = await supabase
      .from("verification_requests")
      .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (approve) await supabase.from("profiles").update({ verified: true }).eq("id", userId);
    toast.success(approve ? "Approved" : "Rejected");
    refreshAll();
  }

  async function toggleRole(userId: string, role: Role, has: boolean) {
    const { error } = has
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(has ? `Removed ${role}` : `Granted ${role}`);
    refreshAll();
  }

  async function deleteProfile(userId: string) {
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile removed");
    refreshAll();
  }

  async function dismissReport(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshAll();
  }

  if (accessLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldCheck className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {access?.adminExists
            ? "This area is for admins only."
            : "No admin exists yet. Claim the control panel for this app."}
        </p>
        {!access?.adminExists && (
          <Button
            variant="heat"
            disabled={claimAdmin.isPending}
            onClick={() => claimAdmin.mutate()}
          >
            Claim admin
          </Button>
        )}
      </div>
    );
  }

  const filtered = people.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.username.toLowerCase().includes(q) ||
      (p.display_name ?? "").toLowerCase().includes(q) ||
      p.id.includes(q)
    );
  });

  return (
    <div className="px-5 pt-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <ShieldCheck className="size-5 text-primary" /> Control
      </h1>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="People" value={Number(stats?.people ?? 0)} />
        <StatCard icon={Radio} label="Online now" value={Number(stats?.online ?? 0)} />
        <StatCard icon={BadgeCheck} label="Verified" value={Number(stats?.verified ?? 0)} />
        <StatCard icon={Flag} label="Reports" value={Number(stats?.reports ?? 0)} />
        <StatCard icon={Radio} label="Signals" value={Number(stats?.signals ?? 0)} />
        <StatCard icon={Users} label="Matches" value={Number(stats?.matches ?? 0)} />
      </div>

      <Tabs defaultValue="people" className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="people" className="flex-1">
            People
          </TabsTrigger>
          <TabsTrigger value="verify" className="flex-1">
            Verify
            {verifications.length > 0 ? ` (${verifications.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">
            Reports
            {reports.length > 0 ? ` (${reports.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              className="pl-9"
            />
          </div>
          {filtered.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border p-3">
              <div className="flex items-center gap-3">
                <PersonAvatar
                  path={p.avatar_url}
                  name={p.display_name}
                  username={p.username}
                  className="size-11"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {p.display_name ?? p.username}
                    {p.verified && <VerifiedBadge />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{p.username}
                    {p.roles.length > 0 ? ` · ${p.roles.join(", ")}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => void setVerified(p.id, !p.verified)}
                >
                  {p.verified ? "Unverify" : "Verify"}
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() =>
                        void toggleRole(p.id, "moderator", p.roles.includes("moderator"))
                      }
                    >
                      {p.roles.includes("moderator") ? "Remove mod" : "Make mod"}
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => void toggleRole(p.id, "admin", p.roles.includes("admin"))}
                    >
                      {p.roles.includes("admin") ? "Remove admin" : "Make admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void deleteProfile(p.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No one matches that.</p>
          )}
        </TabsContent>

        <TabsContent value="verify" className="mt-4 space-y-3">
          {verifications.map((v) => (
            <div key={v.id} className="rounded-2xl border border-border p-3">
              <div className="flex items-center gap-3">
                {v.selfieUrl ? (
                  <img
                    src={v.selfieUrl}
                    alt={`Verification selfie from @${v.person?.username ?? "user"}`}
                    loading="lazy"
                    width={64}
                    height={64}
                    className="size-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="size-16 rounded-xl bg-muted" />
                )}
                <p className="flex-1 truncate text-sm font-semibold">
                  @{v.person?.username ?? "unknown"}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="heat"
                  onClick={() => void reviewVerification(v.id, v.user_id, true)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => void reviewVerification(v.id, v.user_id, false)}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
          {verifications.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing to review.</p>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border p-3">
              <p className="text-sm">
                <span className="font-semibold">@{r.reportedProfile?.username ?? "unknown"}</span>{" "}
                <span className="text-muted-foreground">
                  reported by @{r.reporterProfile?.username ?? "unknown"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => void setVerified(r.reported, false)}
                >
                  <Ban className="mr-1 size-3.5" /> Unverify
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void dismissReport(r.id)}>
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No reports.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
