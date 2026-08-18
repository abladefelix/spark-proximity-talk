import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getEmailSettings,
  saveEmailSettings,
  sendTestEmail,
} from "@/lib/email-settings.functions";

type Draft = {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  enabled: boolean;
};

const EMPTY: Draft = {
  smtp_host: "",
  smtp_port: 587,
  smtp_secure: false,
  smtp_user: "",
  smtp_password: "",
  from_name: "SKANAROUND",
  from_email: "",
  reply_to: "",
  enabled: false,
};

export function MailSettingsTab() {
  const queryClient = useQueryClient();
  const load = useServerFn(getEmailSettings);
  const save = useServerFn(saveEmailSettings);
  const test = useServerFn(sendTestEmail);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [testTo, setTestTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["email-settings"],
    queryFn: () => load(),
  });

  useEffect(() => {
    if (!settings) return;
    setDraft({ ...EMPTY, ...settings, smtp_password: "" } as Draft);
  }, [settings]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: draft });
      toast.success("Mail settings saved");
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      await test({ data: { to: testTo } });
      toast.success("Test email sent");
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
    } finally {
      setTesting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Outgoing mail (SMTP)</h3>
          <p className="text-xs text-muted-foreground">
            Credentials from your mail provider. Used for emails the app sends itself.
          </p>
        </div>
        <Switch checked={draft.enabled} onCheckedChange={(v) => set("enabled", v)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="smtp_host">Server host</Label>
          <Input
            id="smtp_host"
            value={draft.smtp_host}
            placeholder="smtp.yourhost.com"
            onChange={(e) => set("smtp_host", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp_port">Port</Label>
          <Input
            id="smtp_port"
            type="number"
            value={draft.smtp_port}
            onChange={(e) => set("smtp_port", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp_user">Username</Label>
          <Input
            id="smtp_user"
            autoComplete="off"
            value={draft.smtp_user}
            onChange={(e) => set("smtp_user", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp_password">Password</Label>
          <Input
            id="smtp_password"
            type="password"
            autoComplete="new-password"
            placeholder={settings?.hasPassword ? "•••••••• (unchanged)" : ""}
            value={draft.smtp_password}
            onChange={(e) => set("smtp_password", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from_name">Sender name</Label>
          <Input
            id="from_name"
            value={draft.from_name}
            onChange={(e) => set("from_name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from_email">Sender address</Label>
          <Input
            id="from_email"
            type="email"
            placeholder="no-reply@yourdomain.com"
            value={draft.from_email}
            onChange={(e) => set("from_email", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reply_to">Reply-to (optional)</Label>
          <Input
            id="reply_to"
            type="email"
            value={draft.reply_to}
            onChange={(e) => set("reply_to", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="smtp_secure"
            checked={draft.smtp_secure}
            onCheckedChange={(v) => set("smtp_secure", v)}
          />
          <Label htmlFor="smtp_secure" className="text-sm">
            Implicit TLS (port 465)
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          Save settings
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor="test_to">Send a test email</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="test_to"
            type="email"
            className="max-w-xs"
            placeholder="you@email.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <Button variant="outline" onClick={handleTest} disabled={testing || !testTo}>
            {testing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Send test
          </Button>
        </div>
        {settings?.last_test_at && (
          <p className="text-xs text-muted-foreground">
            Last test {new Date(settings.last_test_at).toLocaleString()} —{" "}
            {settings.last_test_ok ? "delivered to the mail server" : `failed: ${settings.last_test_error}`}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Note: account emails such as password resets are sent by the built-in auth service and do
        not use these credentials.
      </p>
    </div>
  );
}
