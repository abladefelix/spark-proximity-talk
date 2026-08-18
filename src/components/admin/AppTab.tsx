import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatBackgroundsAdmin } from "@/components/admin/ChatBackgroundsAdmin";
import { RadarTonesAdmin } from "@/components/admin/RadarTonesAdmin";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  VERIFIED_BADGE_STYLES,
  VerifiedBadgeMark,
  type VerifiedBadgeStyle,
} from "@/components/VerifiedBadge";
import {
  APP_SETTINGS_DEFAULTS,
  FONT_OPTIONS,
  useAppSettings,
  useSaveAppSettings,
  type AppSettings,
} from "@/hooks/useAppSettings";

type Draft = Partial<AppSettings>;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
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

export function AppTab() {
  const { data: settings } = useAppSettings();
  const save = useSaveAppSettings();
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({});
  }, [settings?.updated_at]);

  const value = { ...APP_SETTINGS_DEFAULTS, ...(settings ?? {}), ...draft } as AppSettings &
    typeof APP_SETTINGS_DEFAULTS;

  function set<K extends keyof AppSettings>(key: K, v: AppSettings[K]) {
    setDraft((d) => ({ ...d, [key]: v }));
  }

  const dirty = Object.keys(draft).length > 0;

  async function onSave() {
    setSaving(true);
    try {
      await save(draft);
      setDraft({});
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const num = (key: keyof AppSettings, min: number, max: number) => (
    <Input
      type="number"
      min={min}
      max={max}
      value={String(value[key] ?? "")}
      onChange={(e) => set(key, Math.max(min, Math.min(max, Number(e.target.value))) as never)}
    />
  );

  return (
    <div className="space-y-3 pb-24">
      <Section title="App text" hint="Copy shown to members across the app.">
        <Field label="Tagline">
          <Input value={value.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <Field label="Welcome / location prompt">
          <Input value={value.welcome_text} onChange={(e) => set("welcome_text", e.target.value)} />
        </Field>
        <Field label="Empty radar message">
          <Input
            value={value.empty_radar_text}
            onChange={(e) => set("empty_radar_text", e.target.value)}
          />
        </Field>
        <Field label="Chat input placeholder">
          <Input
            value={value.chat_prompt_text}
            onChange={(e) => set("chat_prompt_text", e.target.value)}
          />
        </Field>
        <Field label="Terms text">
          <Textarea
            rows={4}
            value={value.terms_text}
            onChange={(e) => set("terms_text", e.target.value)}
          />
        </Field>
        <Field label="Privacy text">
          <Textarea
            rows={4}
            value={value.privacy_text}
            onChange={(e) => set("privacy_text", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Features" hint="Turn parts of the app on or off for everyone.">
        <Toggle
          label="Chat"
          hint="Matched people can message each other."
          checked={value.chat_enabled}
          onChange={(v) => set("chat_enabled", v)}
        />
        <Toggle
          label="Location sharing in chat"
          hint="Allow sending a live location pin."
          checked={value.location_sharing_enabled}
          onChange={(v) => set("location_sharing_enabled", v)}
        />
        <Toggle
          label="Verification requests"
          checked={value.verification_enabled}
          onChange={(v) => set("verification_enabled", v)}
        />
        <Toggle
          label="Reporting"
          checked={value.reports_enabled}
          onChange={(v) => set("reports_enabled", v)}
        />
        <Toggle
          label="New sign-ups"
          hint="Off means only existing members can sign in."
          checked={value.signups_enabled}
          onChange={(v) => set("signups_enabled", v)}
        />
        <Toggle
          label="Push notifications"
          checked={value.push_enabled}
          onChange={(v) => set("push_enabled", v)}
        />
        <Toggle
          label="Radar sweep animation"
          checked={value.radar_sweep_enabled}
          onChange={(v) => set("radar_sweep_enabled", v)}
        />
      </Section>

      <Section title="Rules & limits">
        <Field label="Signal stays active (hours)">{num("signal_expiry_hours", 1, 168)}</Field>
        <Field label="Counts as online for (minutes)">{num("presence_timeout_min", 1, 120)}</Field>
        <Field label="Default scan range (metres)">{num("default_radius_m", 100, 20000)}</Field>
        <Field label="Maximum scan range (metres)">{num("max_radius_m", 100, 20000)}</Field>
        <Field label="Message length limit">{num("max_message_len", 50, 5000)}</Field>
        <Field label="Signals per person per day (0 = unlimited)">
          {num("daily_signal_limit", 0, 1000)}
        </Field>
        <Field label="Chats kept for (days)">{num("chat_ttl_days", 1, 365)}</Field>
      </Section>

      <Section title="Look & feel" hint="Beacon colours, font and the default theme.">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["color_male", "Male"],
              ["color_female", "Female"],
              ["color_other", "Other"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`${label} beacon colour`}
                  className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                  value={value[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
                <Input value={value[key]} onChange={(e) => set(key, e.target.value)} />
              </div>
            </Field>
          ))}
        </div>

        <Field label="Verified badge icon">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VERIFIED_BADGE_STYLES) as VerifiedBadgeStyle[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("verified_badge_style", s)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs capitalize ${
                  value.verified_badge_style === s
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <VerifiedBadgeMark style={s} color={value.verified_badge_color} className="size-4" />
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Verified badge colour">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Verified badge colour"
              className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
              value={value.verified_badge_color}
              onChange={(e) => set("verified_badge_color", e.target.value)}
            />
            <Input
              value={value.verified_badge_color}
              onChange={(e) => set("verified_badge_color", e.target.value)}
            />
          </div>
        </Field>

        <Field label="Font">
          <div className="flex flex-wrap gap-2">
            {FONT_OPTIONS.map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={value.font_family === f ? "default" : "outline"}
                style={{ fontFamily: `"${f}", sans-serif` }}
                onClick={() => set("font_family", f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </Field>

        <Field label="Default theme for new members">
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={value.default_theme === t ? "default" : "outline"}
                onClick={() => set("default_theme", t)}
                className="capitalize"
              >
                {t}
              </Button>
            ))}
          </div>
        </Field>
      </Section>

      <ChatBackgroundsAdmin />

      <RadarTonesAdmin />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </p>
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
              Reset
            </Button>
          ) : null}
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
