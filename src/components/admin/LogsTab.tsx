import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarIcon,
  Download,
  FileJson,
  Loader2,
  RefreshCw,
  Search,
  Sheet,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pager } from "@/components/admin/Pager";
import { exportCsv, exportJson, type Row } from "@/lib/exporters";
import { cn } from "@/lib/utils";

type LogRow = {
  id: string;
  created_at: string;
  category: string;
  action: string;
  severity: string;
  actor_id: string | null;
  actor_label: string | null;
  target_id: string | null;
  target_label: string | null;
  summary: string;
  meta: Record<string, unknown> | null;
  total_count: number;
};

type SummaryRow = { category: string; events: number; last_at: string };

const CATEGORIES = [
  { key: "all", label: "Everything" },
  { key: "people", label: "People" },
  { key: "access", label: "Sign-ins" },
  { key: "signals", label: "Signals" },
  { key: "chats", label: "Chats" },
  { key: "moderation", label: "Safety" },
  { key: "verification", label: "Verify" },
  { key: "billing", label: "Billing" },
  { key: "admin", label: "Admin" },
] as const;

const PER_PAGE = 50;

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metaLine(meta: Record<string, unknown> | null) {
  if (!meta) return "";
  return Object.entries(meta)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

function severityClass(severity: string) {
  if (severity === "warning") return "border-destructive/40 bg-destructive/10 text-destructive";
  return "border-border bg-secondary text-muted-foreground";
}

function DatePicker({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date) => void;
  max?: Date;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("justify-start gap-1.5 text-left font-normal", !value && "text-muted-foreground")}
          aria-label={label}
        >
          <CalendarIcon className="size-3.5" />
          <span className="text-muted-foreground">{label}:</span>
          {value ? format(value, "d MMM yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            if (d) onChange(d);
            setOpen(false);
          }}
          disabled={max ? { after: max } : undefined}
          initialFocus
          className="pointer-events-auto p-3"
        />
      </PopoverContent>
    </Popover>
  );
}

export function LogsTab() {
  const [category, setCategory] = useState<string>("all");
  const [from, setFrom] = useState<Date>(() => defaultFrom());
  const [to, setTo] = useState<Date>(() => new Date());
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const fromIso = startOfDay(from).toISOString();
  const toIso = endOfDay(to).toISOString();
  const rangeLabel = `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`;

  const logs = useQuery({
    queryKey: ["admin-activity-log", category, fromIso, toIso, search, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_activity_log", {
        _category: category,
        _search: search,
        _from: fromIso,
        _to: toIso,
        _limit: PER_PAGE,
        _offset: page * PER_PAGE,
      });
      if (error) throw error;
      return (data ?? []) as unknown as LogRow[];
    },
  });

  const summary = useQuery({
    queryKey: ["admin-activity-log-summary", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_activity_log_summary", {
        _from: fromIso,
        _to: toIso,
      });
      if (error) throw error;
      return (data ?? []) as unknown as SummaryRow[];
    },
  });

  const rows = logs.data ?? [];
  const total = rows[0]?.total_count ?? 0;

  function exportRows(kind: "csv" | "json") {
    const flat: Row[] = rows.map((r) => ({
      time: new Date(r.created_at).toISOString(),
      category: r.category,
      action: r.action,
      severity: r.severity,
      who: r.actor_label ?? "",
      affected: r.target_label ?? "",
      summary: r.summary,
      details: metaLine(r.meta),
    }));
    const name = `activity-log-${category}-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}`;
    if (kind === "csv") exportCsv(`${name}.csv`, flat);
    else exportJson(`${name}.json`, flat);
  }

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(term.trim());
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Activity log</h3>
            <p className="text-[11px] text-muted-foreground">
              Everything that happens in the app, newest first. Message text is never stored — only
              who messaged whom, and when.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Refresh"
            onClick={() => {
              void logs.refetch();
              void summary.refetch();
            }}
          >
            <RefreshCw className={`size-4 ${logs.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <DatePicker
            label="From"
            value={from}
            max={to}
            onChange={(d) => {
              setFrom(d);
              if (d > to) setTo(d);
              setPage(0);
            }}
          />
          <DatePicker
            label="To"
            value={to}
            onChange={(d) => {
              setTo(d);
              if (d < from) setFrom(d);
              setPage(0);
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFrom(defaultFrom());
              setTo(new Date());
              setPage(0);
            }}
          >
            Last 30 days
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant={category === c.key ? "default" : "outline"}
              onClick={() => {
                setCategory(c.key);
                setPage(0);
              }}
            >
              {c.label}
            </Button>
          ))}
        </div>

        <form className="mt-2 flex gap-2" onSubmit={applySearch}>
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search person, action or details"
          />
          <Button type="submit" size="icon" variant="outline" aria-label="Search">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportRows("csv")} disabled={!rows.length}>
            <Sheet className="size-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportRows("json")} disabled={!rows.length}>
            <FileJson className="size-4" /> JSON
          </Button>
          <span className="ml-auto flex items-center text-[11px] text-muted-foreground">
            <Download className="mr-1 size-3" /> exports this page
          </span>
        </div>
      </div>

      {summary.data && summary.data.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {summary.data.map((s) => (
            <button
              key={s.category}
              type="button"
              onClick={() => {
                setCategory(s.category);
                setPage(0);
              }}
              className={`rounded-xl border p-2 text-left ${
                category === s.category ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <p className="text-[11px] capitalize text-muted-foreground">{s.category}</p>
              <p className="text-lg font-semibold tabular-nums">{s.events}</p>
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-border">
        {logs.isLoading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : logs.error ? (
          <p className="p-4 text-sm text-destructive">
            {logs.error instanceof Error ? logs.error.message : "Could not load the log"}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nothing recorded for {rangeLabel} with these filters.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const details = metaLine(r.meta);
              return (
                <li key={r.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-[2px] text-[10px] capitalize ${severityClass(r.severity)}`}
                    >
                      {r.category}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{r.action.replace(/_/g, " ")}</span>
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {when(r.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{r.summary}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.actor_label ? <>By {r.actor_label}</> : "System"}
                    {r.target_label && r.target_label !== r.actor_label ? <> → {r.target_label}</> : null}
                  </p>
                  {details ? (
                    <p className="mt-0.5 break-words text-[11px] text-muted-foreground">{details}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Pager
        page={page}
        perPage={PER_PAGE}
        total={Number(total)}
        onPageChange={setPage}
        label="events"
      />
    </div>
  );
}
