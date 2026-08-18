import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Ban,
  EyeOff,

  Flag,
  Loader2,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Search,
  Eye,
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
import { Brand, useBranding } from "@/components/Brand";
import { useMaxRadius } from "@/hooks/useMaxRadius";
import { useChatTtlDays } from "@/hooks/useChatTtl";


import { UserDetailsDialog } from "@/components/admin/UserDetailsDialog";
import { InsightsTab } from "@/components/admin/InsightsTab";
import { BackupTab } from "@/components/admin/BackupTab";
import { EmailsTab } from "@/components/admin/EmailsTab";
import { MailSettingsTab } from "@/components/admin/MailSettingsTab";

import { AppTab } from "@/components/admin/AppTab";
import {
  ACCENT_PRESETS,
  DEFAULT_HUE,
  accentSwatch,
  useAccentHue,
  parseColorToHue,
  parseColorToRgb,
  toHexColor,
} from "@/hooks/useAccent";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin control — SKANAROUND" },
      {
        name: "description",
        content:
          "Moderation and control panel for SKANAROUND: people, roles, verification, reports and activity.",
      },
      { property: "og:title", content: "Admin control — SKANAROUND" },
      {
        property: "og:description",
        content: "Moderate people, roles, verification and reports on SKANAROUND.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoute,
});

/**
 * The admin console is the one browser-only surface: it opts out of the
 * native fixed-viewport lock so the document scrolls normally on the web.
 */
function AdminRoute() {
  useEffect(() => {
    document.body.setAttribute("data-web-page", "");
    return () => document.body.removeAttribute("data-web-page");
  }, []);
  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPage />
    </div>
  );
}

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
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);
  const { data: accentHue } = useAccentHue();
  const [customColor, setCustomColor] = useState("#ffb020");
  const { data: branding } = useBranding();
  const { data: maxRadius } = useMaxRadius();
  const { data: chatTtl } = useChatTtlDays();
  const [chatTtlDraft, setChatTtlDraft] = useState<string | null>(null);
  const [maxRadiusDraft, setMaxRadiusDraft] = useState<string | null>(null);

  async function saveChatTtl() {
    const value = Math.round(Number(chatTtlDraft ?? chatTtl ?? 30));
    if (!Number.isFinite(value) || value < 1) {
      toast.error("Enter at least 1 day");
      return;
    }
    const { error } = await supabase
      .from("app_settings")
      .update({ chat_ttl_days: value })
      .eq("id", "global");
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["app-chat-ttl"] });
    setChatTtlDraft(null);
    toast.success("Chat history length updated");
  }

  async function purgeOldChats() {
    const { data, error } = await supabase.rpc("purge_old_chats");
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["active-chats"] });
    toast.success(`Removed ${data ?? 0} old messages`);
  }

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);

  async function saveMaxRadius() {
    const value = Math.round(Number(maxRadiusDraft ?? maxRadius ?? 2000));
    if (!Number.isFinite(value) || value < 100) {
      toast.error("Enter a range of at least 100 m");
      return;
    }
    const { error } = await supabase
      .from("app_settings")
      .update({ max_radius_m: value })
      .eq("id", "global");
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["app-max-radius"] });
    setMaxRadiusDraft(null);
    toast.success("Maximum range updated");
  }

  async function setAccent(hue: number) {
    const { error } = await supabase
      .from("app_settings")
      .update({ accent_hue: hue })
      .eq("id", "global");
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["app-accent"] });
    toast.success("Theme colour updated");
  }


  async function saveAppName() {
    const name = (nameDraft ?? "").trim();
    if (!name) return;
    const { error } = await supabase
      .from("app_settings")
      .update({ app_name: name })
      .eq("id", "global");
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["app-branding"] });
    setNameDraft(null);
    toast.success("App name updated");
  }

  async function uploadLogo(file: File) {
    setSavingLogo(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("branding").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      setSavingLogo(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase
      .from("app_settings")
      .update({ logo_url: path })
      .eq("id", "global");
    setSavingLogo(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["app-branding"] });
    toast.success("Logo updated");
  }

  async function resetLogo() {
    const { error } = await supabase
      .from("app_settings")
      .update({ logo_url: null })
      .eq("id", "global");
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["app-branding"] });
    toast.success("Logo reset");
  }



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
    <>
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

      {isAdmin && (
        <div className="mt-3 space-y-3 rounded-xl border border-border px-3 py-2.5">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Branding</p>
            <div className="mt-2 flex items-center gap-2">
              <Brand className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground" size={24} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={nameDraft ?? branding?.name ?? ""}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="App name"
                className="h-8 text-sm"
              />
              <Button size="sm" variant="soft" onClick={() => void saveAppName()}>
                Save
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs">
                {savingLogo ? "Uploading…" : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {branding?.logoPath && (
                <Button size="sm" variant="ghost" onClick={() => void resetLogo()}>
                  Reset logo
                </Button>
              )}
            </div>
          </div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Accent colour</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.hue}
                type="button"
                aria-label={preset.name}
                onClick={() => void setAccent(preset.hue)}
                className={`size-7 rounded-full border transition ${
                  Math.round(accentHue ?? DEFAULT_HUE) === preset.hue
                    ? "border-foreground ring-2 ring-foreground/30"
                    : "border-border"
                }`}
                style={{ background: accentSwatch(preset.hue) }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="color"
              aria-label="Pick custom colour"
              className="size-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
              onChange={(e) => setCustomColor(e.target.value)}
              value={parseColorToRgb(customColor) ? toHexColor(customColor) : "#ffb020"}
            />
            <Input
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              placeholder="rgb(255, 176, 32) or #ffb020"
              className="h-9 w-56"
            />
            <div
              className="size-7 rounded-full border border-border"
              style={{
                background: accentSwatch(parseColorToHue(customColor) ?? DEFAULT_HUE),
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                const hue = parseColorToHue(customColor);
                if (hue === null) {
                  toast.error("Enter a valid colour, e.g. rgb(255, 176, 32) or #ffb020");
                  return;
                }
                void setAccent(hue);
              }}
            >
              Apply
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Accepts hex, rgb() or hsl(). The colour is matched to the closest accent tone.
          </p>

          <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">
            Maximum search range
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={100}
              step={100}
              value={maxRadiusDraft ?? String(maxRadius ?? 2000)}
              onChange={(e) => setMaxRadiusDraft(e.target.value)}
              className="h-9 w-32"
            />
            <span className="text-xs text-muted-foreground">metres</span>
            <Button size="sm" onClick={() => void saveMaxRadius()}>
              Save
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Members can pick any range up to this cap on their radar.
          </p>

          <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">
            Chat history length
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              value={chatTtlDraft ?? String(chatTtl ?? 30)}
              onChange={(e) => setChatTtlDraft(e.target.value)}
              className="h-9 w-32"
            />
            <span className="text-xs text-muted-foreground">days</span>
            <Button size="sm" onClick={() => void saveChatTtl()}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => void purgeOldChats()}>
              Purge now
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Conversations older than this stop showing and can be cleared permanently.
          </p>



        </div>
      )}


      <Tabs defaultValue="people" className="mt-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className="inline-flex w-max min-w-full justify-start gap-1">
          <TabsTrigger value="people"
            className="shrink-0 whitespace-nowrap px-3"
          >
            People
          </TabsTrigger>
          <TabsTrigger value="verify"
            className="shrink-0 whitespace-nowrap px-3"
          >
            Verify
            {verifications.length > 0 ? ` (${verifications.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="reports"
            className="shrink-0 whitespace-nowrap px-3"
          >
            Reports
            {reports.length > 0 ? ` (${reports.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="appeals"
            className="shrink-0 whitespace-nowrap px-3"
          >
            Appeals
            {appeals.length > 0 ? ` (${appeals.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="emails"
            className="shrink-0 whitespace-nowrap px-3"
          >
            Emails
          </TabsTrigger>
          <TabsTrigger value="mail"
            className="shrink-0 whitespace-nowrap px-3"
          >
            Mail
          </TabsTrigger>

          <TabsTrigger value="insights"
            className="shrink-0 whitespace-nowrap px-3"
          >
            Insights
          </TabsTrigger>
          <TabsTrigger value="backup"
            className="shrink-0 whitespace-nowrap px-3"
          >
            Backup
          </TabsTrigger>
          <TabsTrigger value="app"
            className="shrink-0 whitespace-nowrap px-3"
          >
            App
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="app" className="mt-3">
          <AppTab />
        </TabsContent>


        <TabsContent value="emails" className="mt-3">
          <EmailsTab />
        </TabsContent>

        <TabsContent value="mail" className="mt-3">
          <MailSettingsTab />
        </TabsContent>


        <TabsContent value="insights" className="mt-3">
          <InsightsTab />
        </TabsContent>

        <TabsContent value="backup" className="mt-3">
          <BackupTab />
        </TabsContent>



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
                    <DropdownMenuItem onSelect={() => setDetailsUserId(p.id)}>
                      <Eye className="size-4" /> View details
                    </DropdownMenuItem>
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
                    <DropdownMenuItem onSelect={() => setDetailsUserId(r.reported)}>
                      <Eye className="size-4" /> View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void setVerified(r.reported, false)}>
                      Unverify reported
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void hideFromRadar(r.reported)}>
                      <EyeOff className="size-4" /> Hide from radar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => void setBanned(r.reported, true)}
                    >
                      <Ban className="size-4" /> Ban member
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

        <TabsContent value="appeals" className="mt-3">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {appeals.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 px-2.5 py-2">
                <PersonAvatar
                  path={a.person?.avatar_url ?? null}
                  name={a.person?.display_name ?? null}
                  username={a.person?.username ?? "unknown"}
                  className="size-8"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    @{a.person?.username ?? "unknown"}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {a.message}
                  </p>
                </div>
                <Button size="sm" variant="heat" onClick={() => void reviewAppeal(a.id, true)}>
                  Unban
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void reviewAppeal(a.id, false)}>
                  Reject
                </Button>
              </li>
            ))}
            {appeals.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No reactivation requests.
              </li>
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
    <UserDetailsDialog
      userId={detailsUserId}
      onOpenChange={(open) => !open && setDetailsUserId(null)}
    />
    </>
  );
}


