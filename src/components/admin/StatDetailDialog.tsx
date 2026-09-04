import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonAvatar, type Gender } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { supabase } from "@/integrations/supabase/client";
import { Pager, paginate } from "@/components/admin/Pager";
import { AdminSearch, FilterChips } from "@/components/admin/FilterBar";

export type StatMetric = "people" | "online" | "verified" | "signals" | "matches" | "reports";

const TITLES: Record<StatMetric, { title: string; description: string }> = {
  people: { title: "People", description: "Everyone registered on the app." },
  online: { title: "Online now", description: "Seen within the last 5 minutes." },
  verified: { title: "Verified members", description: "Profiles carrying the verified badge." },
  signals: { title: "Signals", description: "Chat requests sent between members." },
  matches: { title: "Matches", description: "Mutual connections that opened a chat." },
  reports: { title: "Reports", description: "Reports filed by members." },
};

type Row = {
  key: string;
  primary: string;
  secondary: string;
  avatar?: { path: string | null; name: string | null; username: string; gender: Gender };
  verified?: boolean;
  banned?: boolean;
  userId?: string;
};

type PeopleFilter = "all" | "verified" | "unverified" | "banned";

const PER_PAGE = 10;

export function StatDetailDialog({
  metric,
  onOpenChange,
  onViewUser,
}: {
  metric: StatMetric | null;
  onOpenChange: (open: boolean) => void;
  onViewUser?: (userId: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PeopleFilter>("all");
  useEffect(() => {
    setPage(0);
    setQuery("");
    setFilter("all");
  }, [metric]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-stat-detail", metric],
    enabled: metric !== null,
    queryFn: async (): Promise<Row[]> => loadRows(metric as StatMetric),
  });

  const meta = metric ? TITLES[metric] : null;
  const isPeople = metric === "people" || metric === "online" || metric === "verified";
  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (q && !`${r.primary} ${r.secondary}`.toLowerCase().includes(q)) return false;
    if (!isPeople || filter === "all") return true;
    if (filter === "verified") return Boolean(r.verified);
    if (filter === "unverified") return !r.verified;
    return Boolean(r.banned);
  });

  return (
    <Dialog open={metric !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta?.title ?? ""}</DialogTitle>
          <DialogDescription>{meta?.description ?? ""}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <AdminSearch
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(0);
                }}
                placeholder="Search this list"
              />
              {isPeople && (
                <FilterChips<PeopleFilter>
                  value={filter}
                  onChange={(v) => {
                    setFilter(v);
                    setPage(0);
                  }}
                  options={[
                    { value: "all", label: "All", count: rows.length },
                    { value: "verified", label: "Verified", count: rows.filter((r) => r.verified).length },
                    { value: "unverified", label: "Unverified", count: rows.filter((r) => !r.verified).length },
                    { value: "banned", label: "Suspended", count: rows.filter((r) => r.banned).length },
                  ]}
                />
              )}
            </div>
            <ul className="max-h-[55vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {paginate(visible, page, PER_PAGE).map((r) => (
                <li key={r.key} className="flex items-center gap-2.5 px-2.5 py-2">
                  {r.avatar && (
                    <PersonAvatar
                      path={r.avatar.path}
                      name={r.avatar.name}
                      username={r.avatar.username}
                      gender={r.avatar.gender}
                      className="size-8"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-medium leading-tight">
                      {r.primary}
                      {r.verified && <VerifiedBadge />}
                    </p>
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">
                      {r.secondary}
                    </p>
                  </div>
                  {r.userId && onViewUser && (
                    <button
                      type="button"
                      className="shrink-0 text-[11px] font-semibold text-primary"
                      onClick={() => onViewUser(r.userId as string)}
                    >
                      Details
                    </button>
                  )}
                </li>
              ))}
              {visible.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</li>
              )}
            </ul>
            <Pager page={page} perPage={PER_PAGE} total={visible.length} onPageChange={setPage} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

async function loadRows(metric: StatMetric): Promise<Row[]> {
  if (metric === "people" || metric === "online" || metric === "verified") {
    const { data } = await supabase.rpc("staff_profiles", { _limit: 500 });
    const cutoff = Date.now() - 5 * 60 * 1000;
    const people = (data ?? []).filter((p) => {
      if (metric === "verified") return p.verified;
      if (metric === "online") return p.last_seen ? new Date(p.last_seen).getTime() > cutoff : false;
      return true;
    });
    return people.map((p) => ({
      key: p.id,
      primary: p.display_name ?? p.username,
      secondary: `@${p.username}${p.banned ? " · banned" : ""} · joined ${new Date(p.created_at).toLocaleDateString()}`,
      avatar: {
        path: p.avatar_url,
        name: p.display_name,
        username: p.username,
        gender: p.gender as Gender,
      },
      verified: p.verified,
      banned: p.banned,
      userId: p.id,
    }));
  }

  if (metric === "signals") {
    const { data: rows } = await supabase
      .from("signals")
      .select("id, from_user, to_user, created_at, expires_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const names = await usernames((rows ?? []).flatMap((r) => [r.from_user, r.to_user]));
    return (rows ?? []).map((r) => ({
      key: r.id,
      primary: `@${names.get(r.from_user) ?? "unknown"} → @${names.get(r.to_user) ?? "unknown"}`,
      secondary: `sent ${new Date(r.created_at).toLocaleString()}`,
      userId: r.from_user,
    }));
  }

  if (metric === "matches") {
    const { data: rows } = await supabase
      .from("matches")
      .select("id, user_a, user_b, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const names = await usernames((rows ?? []).flatMap((r) => [r.user_a, r.user_b]));
    return (rows ?? []).map((r) => ({
      key: r.id,
      primary: `@${names.get(r.user_a) ?? "unknown"} ↔ @${names.get(r.user_b) ?? "unknown"}`,
      secondary: `matched ${new Date(r.created_at).toLocaleString()}`,
      userId: r.user_a,
    }));
  }

  const { data: rows } = await supabase
    .from("reports")
    .select("id, reason, created_at, reporter, reported")
    .order("created_at", { ascending: false })
    .limit(200);
  const names = await usernames((rows ?? []).flatMap((r) => [r.reporter, r.reported]));
  return (rows ?? []).map((r) => ({
    key: r.id,
    primary: `@${names.get(r.reported) ?? "unknown"} · by @${names.get(r.reporter) ?? "unknown"}`,
    secondary: `${r.reason} · ${new Date(r.created_at).toLocaleString()}`,
    userId: r.reported,
  }));
}

async function usernames(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("profiles").select("id, username").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.username]));
}
