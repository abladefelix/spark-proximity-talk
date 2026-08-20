import { useEffect, useState } from "react";
import { Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBillingInfo, useIsPro } from "@/hooks/useBilling";
import { useProUpgradeSheet } from "@/components/ProUpgradeSheet";
import { BEACON_STYLES } from "@/lib/beacon-styles";
import { cn } from "@/lib/utils";

/** Pro-only: pick the colour other people see your beacon glow in. */
export function BeaconStyleSetting() {
  const { data: billing } = useBillingInfo();
  const isPro = useIsPro();
  const { open: openPro } = useProUpgradeSheet();
  const [style, setStyle] = useState<string>("default");
  const [saving, setSaving] = useState(false);

  const locked = Boolean(billing?.enabled && billing.pro_custom_beacon && !isPro);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("beacon_style")
        .eq("id", uid)
        .maybeSingle();
      if (!cancelled && data?.beacon_style) setStyle(data.beacon_style);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(id: string) {
    if (locked) {
      openPro();
      return;
    }
    setStyle(id);
    setSaving(true);
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (uid) {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ beacon_style: id })
        .eq("id", uid);
      if (error) toast.error("Couldn't save your beacon look");
    }
    setSaving(false);
  }

  if (billing?.enabled === true && billing.pro_custom_beacon === false) return null;

  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" /> Beacon look
        {locked && <Lock className="size-3.5 text-muted-foreground" />}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {locked
          ? "A Pro perk — stand out on nearby radars with your own beacon colour."
          : "The colour your beacon glows in on other people's radars."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {BEACON_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={saving}
            onClick={() => choose(s.id)}
            aria-label={s.label}
            aria-pressed={style === s.id}
            className={cn(
              "flex size-10 items-center justify-center rounded-full ring-2 transition",
              style === s.id && !locked ? "ring-foreground" : "ring-border",
              locked && "opacity-60",
            )}
          >
            <span
              className="size-6 rounded-full"
              style={{
                background: s.color || "var(--muted-foreground)",
                boxShadow: s.color ? `0 0 10px ${s.color}` : undefined,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
