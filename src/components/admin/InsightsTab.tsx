import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileJson, FileText, Loader2, Sheet } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { exportCsv, exportJson, exportPdf, type Row } from "@/lib/exporters";

type ReportRow = {
  day: string;
  signups: number;
  signals: number;
  matches: number;
  messages: number;
  active_people: number;
  reports: number;
};

const RANGES = [7, 30, 90] as const;

const METRICS: { key: keyof ReportRow; label: string }[] = [
  { key: "signups", label: "Signups" },
  { key: "active_people", label: "Active" },
  { key: "signals", label: "Signals" },
  { key: "matches", label: "Matches" },
  { key: "messages", label: "Messages" },
  { key: "reports", label: "Reports" },
];

export function InsightsTab() {
  const [days, setDays] = useState<number>(30);
  const [metric, setMetric] = useState<keyof ReportRow>("active_people");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-activity", days],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_activity_report", {
        _days: days,
      });
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const totals = METRICS.reduce<Record<string, number>>((acc, m) => {
    acc[m.label] = data.reduce((s, r) => s + Number(r[m.key] ?? 0), 0);
    return acc;
  }, {});

  const rows: Row[] = data.map((r) => ({
    day: r.day,
    signups: r.signups,
    active_people: r.active_people,
    signals: r.signals,
    matches: r.matches,
    messages: r.messages,
    reports: r.reports,
  }));

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {RANGES.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={days === r ? "default" : "outline"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setDays(r)}
          >
            {r}d
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => exportCsv(`skanaround-activity-${stamp}.csv`, rows)}
          >
            <Sheet className="mr-1 size-3.5" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => exportJson(`skanaround-activity-${stamp}.json`, { days, rows })}
          >
            <FileJson className="mr-1 size-3.5" /> JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() =>
              exportPdf(
                `skanaround-activity-${stamp}.pdf`,
                `Activity report — last ${days} days`,
                rows,
                totals as Row,
              )
            }
          >
            <FileText className="mr-1 size-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded-lg border px-2 py-1.5 text-left transition ${
              metric === m.key ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="text-sm font-semibold tabular-nums">{totals[m.label] ?? 0}</div>
            <div className="truncate text-[11px] text-muted-foreground">{m.label}</div>
          </button>
        ))}
      </div>

      <div className="h-56 rounded-xl border border-border p-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5)}
                minTickGap={16}
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={32} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#metricFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Download className="size-3" />
        Exports contain aggregated daily counts only — no message content.
      </p>
    </div>
  );
}
