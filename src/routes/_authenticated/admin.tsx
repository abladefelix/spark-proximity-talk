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
        .select(
          "id, username, display_name, bio, avatar_url, verified, banned, banned_reason, last_seen, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
      }));
    },
  });

  const { data: appeals = [] } = useQuery({
    queryKey: ["admin-appeals"],
    enabled: isStaff,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("reactivation_requests")
        .select("id, user_id, message, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (!rows?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, display_name")
        .in(
          "id",
          rows.map((r) => r.user_id),
        );
      return rows.map((r) => ({
        ...r,
        person: (profiles ?? []).find((p) => p.id === r.user_id),
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
      "admin-appeals",

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

  async function hideFromRadar(userId: string) {
    const { error } = await supabase
      .from("locations")
      .update({ is_visible: false })
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Hidden from radar");
    refreshAll();
  }

  async function wipeActivity(userId: string) {
    const { error } = await supabase.rpc("admin_wipe_user_activity", { _user_id: userId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signals, matches and chats wiped");
    refreshAll();
  }

  async function purgeSignals() {
    const { error } = await supabase.rpc("purge_expired_signals");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expired signals purged");
    refreshAll();
  }

  async function purgeLocations() {
    const { data, error } = await supabase.rpc("admin_purge_stale_locations");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Cleared ${data ?? 0} stale locations`);
    refreshAll();
  }

  async function setBanned(userId: string, banned: boolean) {
    const reason = banned
      ? (window.prompt("Reason for the ban (shown to them)") ?? "").trim()
      : "";
    if (banned && !reason) return;
    const { error } = banned
      ? await supabase.rpc("admin_set_ban", {
          _user_id: userId,
          _banned: true,
          _reason: reason,
        })
      : await supabase.rpc("admin_set_ban", { _user_id: userId, _banned: false });

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(banned ? "Member banned" : "Member reactivated");
    refreshAll();
  }

  async function reviewAppeal(id: string, approve: boolean) {
    const { error } = await supabase.rpc("admin_review_reactivation", {
      _id: id,
      _approve: approve,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? "Reactivated" : "Appeal rejected");
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
    <div className="px-4 pb-10 pt-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-4 text-primary" /> Control
        </h1>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={refreshAll} aria-label="Refresh">
            <RefreshCw className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="soft">
                Maintenance
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void purgeSignals()}>
                Purge expired signals
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void purgeLocations()}>
                Clear stale locations
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Stat icon={Users} label="people" value={Number(stats?.people ?? 0)} />
        <Stat icon={Radio} label="online" value={Number(stats?.online ?? 0)} />
        <Stat icon={BadgeCheck} label="verified" value={Number(stats?.verified ?? 0)} />
        <Stat icon={Radio} label="signals" value={Number(stats?.signals ?? 0)} />
        <Stat icon={Users} label="matches" value={Number(stats?.matches ?? 0)} />
        <Stat icon={Flag} label="reports" value={Number(stats?.reports ?? 0)} />
      </div>

      <Tabs defaultValue="people" className="mt-4">
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

        <TabsContent value="people" className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              className="h-9 pl-9"
            />
          </div>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {filtered.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 px-2.5 py-2">
                <PersonAvatar
                  path={p.avatar_url}
                  name={p.display_name}
                  username={p.username}
                  className="size-8"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-medium leading-tight">
                    {p.display_name ?? p.username}
                    {p.verified && <VerifiedBadge />}
                    {p.banned && (
                      <span className="rounded bg-destructive/15 px-1 text-[10px] font-semibold uppercase text-destructive">
                        banned
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    @{p.username}
                    {p.roles.length > 0 ? ` · ${p.roles.join(", ")}` : ""}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label={`Actions for @${p.username}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void setVerified(p.id, !p.verified)}>
                      <BadgeCheck className="size-4" /> {p.verified ? "Unverify" : "Verify"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void hideFromRadar(p.id)}>
                      <EyeOff className="size-4" /> Hide from radar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={p.banned ? undefined : "text-destructive"}
                      onSelect={() => void setBanned(p.id, !p.banned)}
                    >
                      <Ban className="size-4" /> {p.banned ? "Unban member" : "Ban member"}
                    </DropdownMenuItem>

                    <DropdownMenuItem onSelect={() => void wipeActivity(p.id)}>
                      <Trash2 className="size-4" /> Wipe signals & chats
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            void toggleRole(p.id, "moderator", p.roles.includes("moderator"))
                          }
                        >
                          {p.roles.includes("moderator") ? "Remove mod" : "Make mod"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            void toggleRole(p.id, "admin", p.roles.includes("admin"))
                          }
                        >
                          {p.roles.includes("admin") ? "Remove admin" : "Make admin"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => void deleteProfile(p.id)}
                        >
                          <Trash2 className="size-4" /> Delete profile
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">No one matches that.</li>
            )}
          </ul>
        </TabsContent>

        <TabsContent value="verify" className="mt-3">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {verifications.map((v) => (
              <li key={v.id} className="flex items-center gap-2.5 px-2.5 py-2">
                {v.selfieUrl ? (
                  <img
                    src={v.selfieUrl}
                    alt={`Verification selfie from @${v.person?.username ?? "user"}`}
                    loading="lazy"
                    width={40}
                    height={40}
                    className="size-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="size-10 rounded-lg bg-muted" />
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  @{v.person?.username ?? "unknown"}
                </p>
                <Button
                  size="sm"
                  variant="heat"
                  onClick={() => void reviewVerification(v.id, v.user_id, true)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void reviewVerification(v.id, v.user_id, false)}
                >
                  Reject
                </Button>
              </li>
            ))}
            {verifications.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">Nothing to review.</li>
            )}
          </ul>
        </TabsContent>

        <TabsContent value="reports" className="mt-3">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    @{r.reportedProfile?.username ?? "unknown"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · by @{r.reporterProfile?.username ?? "unknown"}
                    </span>
                  </p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {r.reason}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label="Report actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void setVerified(r.reported, false)}>
                      Unverify reported
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void hideFromRadar(r.reported)}>
                      <EyeOff className="size-4" /> Hide from radar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void wipeActivity(r.reported)}>
                      <Trash2 className="size-4" /> Wipe their activity
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => void deleteProfile(r.reported)}
                      >
                        Delete profile
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void dismissReport(r.id)}>
                      Dismiss report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
            {reports.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">No reports.</li>
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

