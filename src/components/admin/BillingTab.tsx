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
import { ProPlansSection } from "@/components/admin/ProPlansSection";

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

  const d = draft as any;
  const siteBase = (
    (d.web_site_url as string | undefined)?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "")
  ).replace(/\/+$/, "");
  const set = (key: string, value: unknown) => setDraft((cur) => ({ ...cur, [key]: value }));
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
            formatAmount(Number(stats?.revenue_minor ?? 0), d.currency ?? "USD"),
          ],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border px-3 py-2">
            <p className="text-sm font-semibold tabular-nums">{String(value)}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <Section
        title="Website address"
        hint="Used to build payment redirects and webhook URLs. Change it here when you move the site to a new domain — nothing else needs updating."
      >
        <Field label="Public website address">
          <Input
            value={d.web_site_url ?? ""}
            placeholder="https://skanaround.com"
            onChange={(e) => set("web_site_url", e.target.value.trim())}
          />
        </Field>
        <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
          Leave blank to use whatever address this page is open on
          {typeof window !== "undefined" ? ` (${window.location.origin})` : ""}. After
          changing it, re-copy the webhook URLs below into Paystack and RevenueCat.
        </p>
      </Section>

      <Section
        title="App Store & Google Play billing"
        hint="Memberships are sold through Apple and Google only, as their stores require. Paste the keys from your RevenueCat project."
      >
        <StoreSetupChecklist d={d} />

        <Toggle
          label="Memberships active"
          hint="Turns the upgrade card on for members."
          checked={Boolean(d.enabled)}
          onChange={(v) => set("enabled", v)}
        />
        <Field label="iOS public SDK key">
          <Input
            value={d.rc_ios_api_key ?? ""}
            placeholder="appl_..."
            onChange={(e) => set("rc_ios_api_key", e.target.value)}
          />
        </Field>
        <Field label="Android public SDK key">
          <Input
            value={d.rc_android_api_key ?? ""}
            placeholder="goog_..."
            onChange={(e) => set("rc_android_api_key", e.target.value)}
          />
        </Field>
        <Field label="Secret API key (server only)">
          <Input
            type="password"
            value={d.rc_secret_api_key ?? ""}
            placeholder="sk_..."
            onChange={(e) => set("rc_secret_api_key", e.target.value)}
          />
        </Field>
        <Field label="Entitlement name">
          <Input
            value={d.rc_entitlement_id ?? ""}
            placeholder="pro"
            onChange={(e) => set("rc_entitlement_id", e.target.value)}
          />
        </Field>
        <Field label="Monthly product id">
          <Input
            value={d.rc_monthly_product_id ?? ""}
            placeholder="skanaround_pro_monthly"
            onChange={(e) => set("rc_monthly_product_id", e.target.value)}
          />
        </Field>
        <Field label="Yearly product id">
          <Input
            value={d.rc_yearly_product_id ?? ""}
            placeholder="skanaround_pro_yearly"
            onChange={(e) => set("rc_yearly_product_id", e.target.value)}
          />
        </Field>
        <Field label="Webhook authorization value">
          <Input
            type="password"
            value={d.rc_webhook_secret ?? ""}
            placeholder="a long random value"
            onChange={(e) => set("rc_webhook_secret", e.target.value)}
          />
        </Field>
        <Field label="Webhook URL">
          <div className="flex gap-2">
            <Input
              value={d.rc_webhook_url ?? ""}
              placeholder={`${siteBase}/api/public/revenuecat/webhook`}
              onChange={(e) => set("rc_webhook_url", e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const url =
                  (d.rc_webhook_url as string) ||
                  `${siteBase}/api/public/revenuecat/webhook`;
                void navigator.clipboard?.writeText(url);
                toast.success("Webhook URL copied");
              }}
            >
              Copy
            </Button>
          </div>
        </Field>
        <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
          Paste this URL into RevenueCat → Integrations → Webhooks and set the same
          authorization value. Leave it blank to use the default{" "}
          <code>/api/public/revenuecat/webhook</code> on this site.
        </p>

      </Section>

      <Section
        title="Website checkout (Paystack)"
        hint="For members who cannot pay Apple or Google — mobile money and local cards on the website only. The mobile apps must never link to or mention this page, so keep it off your in-app screens."
      >
        <Toggle
          label="Website checkout active"
          hint="Opens /upgrade on this website."
          checked={Boolean(d.web_checkout_enabled)}
          onChange={(v) => set("web_checkout_enabled", v)}
        />
        <Field label="Paystack public key">
          <Input
            value={d.paystack_public_key ?? ""}
            placeholder="pk_live_..."
            onChange={(e) => set("paystack_public_key", e.target.value)}
          />
        </Field>
        <Field label="Paystack secret key (server only)">
          <Input
            type="password"
            value={d.paystack_secret_key ?? ""}
            placeholder="sk_live_..."
            onChange={(e) => set("paystack_secret_key", e.target.value)}
          />
        </Field>
        <Field label="Currency code">
          <Input
            value={d.web_currency ?? ""}
            placeholder="GHS"
            onChange={(e) => set("web_currency", e.target.value.toUpperCase())}
          />
        </Field>
        <Field
          label={`Monthly price (${formatAmount(Number(d.web_monthly_amount ?? 0), d.web_currency ?? "GHS")})`}
        >
          {num("web_monthly_amount", 0, 100000000)}
        </Field>
        <Field
          label={`Yearly price (${formatAmount(Number(d.web_yearly_amount ?? 0), d.web_currency ?? "GHS")})`}
        >
          {num("web_yearly_amount", 0, 100000000)}
        </Field>
        <Field label="Paystack webhook URL">
          <div className="flex gap-2">
            <Input readOnly value={`${siteBase}/api/public/paystack/webhook`} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(
                  `${siteBase}/api/public/paystack/webhook`,
                );
                toast.success("Webhook URL copied");
              }}
            >
              Copy
            </Button>
          </div>
        </Field>
        <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
          Paste that URL into Paystack → Settings → API Keys & Webhooks. Prices are in the
          smallest unit, so 5000 means GH₵50.00. A successful payment unlocks Pro
          instantly — no admin approval needed.
        </p>
      </Section>

      <Section
        title="Plan wording & reference prices"
        hint="Members are always charged the price you set in App Store Connect and Google Play. These amounts are only used for admin revenue reporting."
      >
        <Field label="Plan name">
          <Input value={d.pro_label ?? ""} onChange={(e) => set("pro_label", e.target.value)} />
        </Field>
        <Field label="Pitch shown to members">
          <Textarea
            rows={2}
            value={d.pro_pitch ?? ""}
            onChange={(e) => set("pro_pitch", e.target.value)}
          />
        </Field>
        <Field label="Reporting currency code">
          <Input
            value={d.currency ?? ""}
            placeholder="USD"
            onChange={(e) => set("currency", e.target.value.toUpperCase())}
          />
        </Field>
        <Field label={`Monthly price (${formatAmount(Number(d.monthly_amount ?? 0), d.currency ?? "USD")})`}>
          {num("monthly_amount", 0, 100000000)}
        </Field>
        <Field label={`Yearly price (${formatAmount(Number(d.yearly_amount ?? 0), d.currency ?? "USD")})`}>
          {num("yearly_amount", 0, 100000000)}
        </Field>
      </Section>


      <Section title="Free tier limits" hint="What members get without paying. Set 0 for no limit.">
        <Field label="Signals per day">{num("free_daily_signals", 0, 1000)}</Field>
        <Field label="Maximum scan range (metres)">{num("free_max_radius_m", 100, 20000)}</Field>
        <Field label="Messages per chat">{num("free_messages_per_match", 0, 10000)}</Field>
      </Section>

      <Section
        title="Longer chat history"
        hint="Free members keep chats for the number of days set in the App tab. Pro members can keep them longer."
      >
        <Toggle
          label="Pro keeps chats longer"
          checked={Boolean(d.pro_extended_chat_history)}
          onChange={(v) => set("pro_extended_chat_history", v)}
        />
        <Field label="Chats kept for Pro members (days)">{num("pro_chat_ttl_days", 1, 3650)}</Field>
      </Section>

      <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Save className="mr-2 size-4" />
        )}
        Save billing settings
      </Button>

      <ProPlansSection />

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
