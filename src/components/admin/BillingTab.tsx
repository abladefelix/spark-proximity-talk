import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Loader2, Save, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/PersonAvatar";
import { BILLING_INFO_KEY, formatAmount } from "@/hooks/useBilling";

type Billing = Record<string, any>;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Payments, plan pricing, free-tier caps and Pro feature switches. */
export function BillingTab() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Billing>({});
  const [search, setSearch] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-billing-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("billing_settings")
        .select("*")
        .eq("id", "global")
        .maybeSingle();
      if (error) throw error;
      return (data ?? {}) as Billing;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-billing-stats"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("admin_billing_stats");
      return (Array.isArray(data) ? data[0] : data) ?? {};
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("subscriptions")
        .select("user_id, status, plan, source, expires_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      const rows = data ?? [];
      if (!rows.length) return rows;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, gender")
        .in(
          "id",
          rows.map((r: any) => r.user_id),
        );
      const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({ ...r, profile: byId.get(r.user_id) }));
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["admin-billing-people", search],
    enabled: search.trim().length > 1,
    queryFn: async () => {
      const q = search.trim();
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, gender")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(10);
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("payments")
        .select("reference, amount, currency, status, plan, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { id, updated_at, ...patch } = draft;
      const { error } = await (supabase as any)
        .from("billing_settings")
        .update(patch)
        .eq("id", "global");
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Billing settings saved");
      await queryClient.invalidateQueries({ queryKey: ["admin-billing-settings"] });
      await queryClient.invalidateQueries({ queryKey: BILLING_INFO_KEY });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const setSub = useMutation({
    mutationFn: async ({
      userId,
      active,
      days,
    }: {
      userId: string;
      active: boolean;
      days: number;
    }) => {
      const { error } = await (supabase as any).rpc("admin_set_subscription", {
        _user_id: userId,
        _active: active,
        _days: days,
        _plan: "admin",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Membership updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-billing-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));
  const num = (key: string, min: number, max: number) => (
    <Input
      type="number"
      min={min}
      max={max}
      value={String(draft[key] ?? "")}
      onChange={(e) => set(key, Number(e.target.value))}
    />
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Active members", stats?.active_subs ?? 0],
          ["Expiring in 30d", stats?.expiring_30d ?? 0],
          ["Paid transactions", stats?.paid_total ?? 0],
          [
            "Revenue",
            formatAmount(Number(stats?.revenue_minor ?? 0), draft.currency ?? "GHS"),
          ],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border px-3 py-2">
            <p className="text-sm font-semibold tabular-nums">{String(value)}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <Section
        title="Paystack"
        hint="Paste the keys from your Paystack dashboard. Nothing is charged until payments are switched on."
      >
        <Toggle
          label="Payments active"
          hint="Turns the upgrade card on for members."
          checked={Boolean(draft.enabled)}
          onChange={(v) => set("enabled", v)}
        />
        <Field label="Public key">
          <Input
            value={draft.paystack_public_key ?? ""}
            placeholder="pk_live_..."
            onChange={(e) => set("paystack_public_key", e.target.value)}
          />
        </Field>
        <Field label="Secret key">
          <Input
            type="password"
            value={draft.paystack_secret_key ?? ""}
            placeholder="sk_live_..."
            onChange={(e) => set("paystack_secret_key", e.target.value)}
          />
        </Field>
        <Field label="Currency code">
          <Input
            value={draft.currency ?? ""}
            placeholder="GHS, NGN, ZAR, USD, KES"
            onChange={(e) => set("currency", e.target.value.toUpperCase())}
          />
        </Field>
        <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
          Webhook URL for Paystack: <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/public/paystack/webhook</code>
        </p>
      </Section>

      <Section title="Plan & pricing" hint="Amounts are in the smallest unit (e.g. pesewas / kobo / cents).">
        <Field label="Plan name">
          <Input value={draft.pro_label ?? ""} onChange={(e) => set("pro_label", e.target.value)} />
        </Field>
        <Field label="Pitch shown to members">
          <Textarea
            rows={2}
            value={draft.pro_pitch ?? ""}
            onChange={(e) => set("pro_pitch", e.target.value)}
          />
        </Field>
        <Field label={`Monthly price (${formatAmount(Number(draft.monthly_amount ?? 0), draft.currency ?? "GHS")})`}>
          {num("monthly_amount", 0, 100000000)}
        </Field>
        <Field label={`Yearly price (${formatAmount(Number(draft.yearly_amount ?? 0), draft.currency ?? "GHS")})`}>
          {num("yearly_amount", 0, 100000000)}
        </Field>
      </Section>

      <Section title="Free tier limits" hint="What members get without paying. Set 0 for no limit.">
        <Field label="Signals per day">{num("free_daily_signals", 0, 1000)}</Field>
        <Field label="Maximum scan range (metres)">{num("free_max_radius_m", 100, 20000)}</Field>
        <Field label="Messages per chat">{num("free_messages_per_match", 0, 10000)}</Field>
      </Section>

      <Section title="Pro features" hint="Switch off anything you don't want included in the paid plan.">
        <Toggle
          label="Unlimited signals"
          checked={Boolean(draft.pro_unlimited_signals)}
          onChange={(v) => set("pro_unlimited_signals", v)}
        />
        <Toggle
          label="Full scan range"
          checked={Boolean(draft.pro_extended_radius)}
          onChange={(v) => set("pro_extended_radius", v)}
        />
        <Toggle
          label="Unlimited messages"
          checked={Boolean(draft.pro_unlimited_messages)}
          onChange={(v) => set("pro_unlimited_messages", v)}
        />
        <Toggle
          label="See everyone who signalled"
          checked={Boolean(draft.pro_see_who_signaled)}
          onChange={(v) => set("pro_see_who_signaled", v)}
        />
        <Toggle
          label="Priority beacon"
          checked={Boolean(draft.pro_priority_beacon)}
          onChange={(v) => set("pro_priority_beacon", v)}
        />
        <Toggle
          label="Custom beacon look"
          checked={Boolean(draft.pro_custom_beacon)}
          onChange={(v) => set("pro_custom_beacon", v)}
        />
      </Section>

      <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Save className="mr-2 size-4" />
        )}
        Save billing settings
      </Button>

      <Section title="Grant membership" hint="Give someone Pro without a payment, or take it back.">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people"
            className="pl-9"
          />
        </div>
        <div className="space-y-2">
          {people.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <PersonAvatar
                path={p.avatar_url}
                name={p.display_name ?? p.username}
                username={p.username}
                gender={p.gender}
                className="size-8"
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.display_name ?? p.username}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSub.mutate({ userId: p.id, active: true, days: 30 })}
              >
                <Crown className="mr-1 size-3.5" /> 30 days
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSub.mutate({ userId: p.id, active: false, days: 0 })}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Members with Pro">
        {subs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No memberships yet.</p>
        ) : (
          <div className="space-y-2">
            {subs.map((s: any) => (
              <div
                key={s.user_id}
                className="flex items-center gap-2 rounded-lg border border-border p-2"
              >
                <PersonAvatar
                  path={s.profile?.avatar_url}
                  name={s.profile?.display_name ?? s.profile?.username ?? "Member"}
                  username={s.profile?.username}
                  gender={s.profile?.gender}
                  className="size-8"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {s.profile?.display_name ?? s.profile?.username ?? s.user_id}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.status} · {s.plan} · {s.source}
                    {s.expires_at ? ` · until ${new Date(s.expires_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSub.mutate({ userId: s.user_id, active: false, days: 0 })}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent payments">
        {payments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="space-y-1.5">
            {payments.map((p: any) => (
              <div
                key={p.reference}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-xs"
              >
                <span className="truncate font-mono">{p.reference}</span>
                <span className="shrink-0 tabular-nums">
                  {formatAmount(p.amount, p.currency)} · {p.plan} · {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
