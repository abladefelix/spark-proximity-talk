import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PRO_FEATURES_KEY,
  PRO_PACKAGES_KEY,
  useProFeatures,
  useProPackages,
  type ProFeature,
  type ProPackage,
} from "@/hooks/useProFeatures";

function Box({
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

/** Admin control over which features are paid, and over Pro packages. */
export function ProPlansSection() {
  const queryClient = useQueryClient();
  const { data: features = [], isLoading } = useProFeatures();
  const { data: packages = [] } = useProPackages(true);

  const [featureDraft, setFeatureDraft] = useState<ProFeature[]>([]);
  const [packDraft, setPackDraft] = useState<ProPackage[]>([]);

  useEffect(() => setFeatureDraft(features), [features]);
  useEffect(() => setPackDraft(packages), [packages]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: PRO_FEATURES_KEY });
    await queryClient.invalidateQueries({ queryKey: PRO_PACKAGES_KEY });
  };

  const saveFeatures = useMutation({
    mutationFn: async () => {
      for (const f of featureDraft) {
        const { error } = await (supabase as any)
          .from("pro_features")
          .update({ label: f.label, description: f.description, pro_only: f.pro_only })
          .eq("key", f.key);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Pro features saved");
      await refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const savePackage = useMutation({
    mutationFn: async (p: ProPackage) => {
      const { id, created_at, updated_at, ...patch } = p as any;
      const { error } = await (supabase as any).from("pro_packages").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Package saved");
      await refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const addPackage = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("pro_packages").insert({
        name: "New package",
        description: "",
        entitlement_id: "pro",
        features: [],
        active: false,
        sort_order: (packDraft.at(-1)?.sort_order ?? 0) + 10,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  const removePackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pro_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const patchPack = (id: string, patch: Partial<ProPackage>) =>
    setPackDraft((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paidKeys = featureDraft.filter((f) => f.pro_only).map((f) => f.key);

  return (
    <>
      <Box
        title="Feature control"
        hint="Decide which features are part of Pro. Anything switched off here is free for everyone."
      >
        {featureDraft.map((f, i) => (
          <div key={f.key} className="rounded-lg border border-border p-2">
            <div className="flex items-center justify-between gap-3">
              <Input
                value={f.label}
                className="h-8 border-0 px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                onChange={(e) =>
                  setFeatureDraft((cur) =>
                    cur.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)),
                  )
                }
              />
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {f.pro_only ? "Pro" : "Free"}
                </span>
                <Switch
                  checked={f.pro_only}
                  onCheckedChange={(v) =>
                    setFeatureDraft((cur) =>
                      cur.map((x, j) => (i === j ? { ...x, pro_only: v } : x)),
                    )
                  }
                />
              </div>
            </div>
            <Textarea
              rows={1}
              value={f.description}
              placeholder="Short description shown to members"
              className="mt-1 min-h-0 resize-none border-0 px-0 text-[11px] text-muted-foreground shadow-none focus-visible:ring-0"
              onChange={(e) =>
                setFeatureDraft((cur) =>
                  cur.map((x, j) => (i === j ? { ...x, description: e.target.value } : x)),
                )
              }
            />
          </div>
        ))}
        <Button
          className="w-full"
          disabled={saveFeatures.isPending}
          onClick={() => saveFeatures.mutate()}
        >
          {saveFeatures.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save feature control
        </Button>
      </Box>

      <Box
        title="Pro packages"
        hint="Build as many packages as you like and tick the features each one unlocks. Product ids must match App Store Connect and Google Play."
      >
        {packDraft.length === 0 ? (
          <p className="text-xs text-muted-foreground">No packages yet.</p>
        ) : null}

        {packDraft.map((p) => (
          <div key={p.id} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Crown className="size-4 text-primary" />
                {p.name || "Untitled"}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {p.active ? "Live" : "Draft"}
                </span>
                <Switch
                  checked={p.active}
                  onCheckedChange={(v) => patchPack(p.id, { active: v })}
                />
              </div>
            </div>

            <Field label="Package name">
              <Input value={p.name} onChange={(e) => patchPack(p.id, { name: e.target.value })} />
            </Field>
            <Field label="Pitch shown to members">
              <Textarea
                rows={2}
                value={p.description}
                onChange={(e) => patchPack(p.id, { description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Entitlement name">
                <Input
                  value={p.entitlement_id}
                  placeholder="pro"
                  onChange={(e) => patchPack(p.id, { entitlement_id: e.target.value })}
                />
              </Field>
              <Field label="Order">
                <Input
                  type="number"
                  value={String(p.sort_order)}
                  onChange={(e) => patchPack(p.id, { sort_order: Number(e.target.value) })}
                />
              </Field>
              <Field label="Monthly product id">
                <Input
                  value={p.monthly_product_id ?? ""}
                  onChange={(e) => patchPack(p.id, { monthly_product_id: e.target.value })}
                />
              </Field>
              <Field label="Yearly product id">
                <Input
                  value={p.yearly_product_id ?? ""}
                  onChange={(e) => patchPack(p.id, { yearly_product_id: e.target.value })}
                />
              </Field>
              <Field label="Monthly price (minor units)">
                <Input
                  type="number"
                  value={String(p.monthly_amount)}
                  onChange={(e) => patchPack(p.id, { monthly_amount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Yearly price (minor units)">
                <Input
                  type="number"
                  value={String(p.yearly_amount)}
                  onChange={(e) => patchPack(p.id, { yearly_amount: Number(e.target.value) })}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Features in this package</Label>
              {featureDraft.map((f) => {
                const checked = p.features.includes(f.key);
                const free = !f.pro_only;
                return (
                  <label
                    key={f.key}
                    className="flex items-start gap-2 text-sm"
                    data-disabled={free ? "" : undefined}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={free}
                      onCheckedChange={(v) =>
                        patchPack(p.id, {
                          features: v
                            ? [...p.features, f.key]
                            : p.features.filter((k) => k !== f.key),
                        })
                      }
                    />
                    <span className={free ? "text-muted-foreground" : ""}>
                      {f.label}
                      {free ? " · free for everyone" : ""}
                    </span>
                  </label>
                );
              })}
              <Button
                size="sm"
                variant="outline"
                onClick={() => patchPack(p.id, { features: paidKeys })}
              >
                Select all Pro features
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={savePackage.isPending}
                onClick={() => savePackage.mutate(p)}
              >
                <Save className="mr-2 size-4" /> Save package
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removePackage.mutate(p.id)}
                aria-label="Delete package"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}

        <Button variant="outline" className="w-full" onClick={() => addPackage.mutate()}>
          <Plus className="mr-2 size-4" /> Add package
        </Button>
      </Box>
    </>
  );
}
