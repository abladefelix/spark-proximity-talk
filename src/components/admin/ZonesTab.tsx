import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Zone = {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  perk_text: string;
  perk_prefix: string;
  active: boolean;
  contact_email: string | null;
};

type ZoneRequest = {
  id: string;
  business_name: string;
  contact_email: string;
  address: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

const BLANK = {
  name: "",
  description: "",
  lat: "",
  lng: "",
  radius_m: "80",
  perk_text: "Buy 1 get 1 free coffee",
  perk_prefix: "SKAN",
  contact_email: "",
};

/** Business Zones are sold and configured here — never inside the mobile app. */
export function ZonesTab() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ ...BLANK });
  const [creating, setCreating] = useState(false);

  const { data: zones = [] } = useQuery({
    queryKey: ["admin-zones"],
    queryFn: async (): Promise<Zone[]> => {
      const { data } = await (supabase as any)
        .from("zones")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Zone[];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["admin-zone-requests"],
    queryFn: async (): Promise<ZoneRequest[]> => {
      const { data } = await (supabase as any)
        .from("zone_requests")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as ZoneRequest[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("zones").insert({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        lat: Number(draft.lat),
        lng: Number(draft.lng),
        radius_m: Math.max(20, Math.min(2000, Number(draft.radius_m) || 80)),
        perk_text: draft.perk_text.trim(),
        perk_prefix: (draft.perk_prefix.trim() || "SKAN").toUpperCase().slice(0, 6),
        contact_email: draft.contact_email.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-zones"] });
      setDraft({ ...BLANK });
      setCreating(false);
      toast.success("Zone created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create zone"),
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Partial<Zone> }) => {
      const { error } = await (supabase as any).from("zones").update(v.patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-zones"] }),
    onError: () => toast.error("Could not update zone"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-zones"] });
      toast.success("Zone removed");
    },
    onError: () => toast.error("Could not remove zone"),
  });

  const field = (key: keyof typeof BLANK, label: string, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={draft[key]}
        placeholder={placeholder ?? ""}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="space-y-4 pb-24">
      <section className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Business Zones</h3>
          <Button size="sm" variant="outline" onClick={() => setCreating((v) => !v)}>
            <Plus className="size-4" /> New zone
          </Button>
        </div>

        {creating ? (
          <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
            {field("name", "Venue name", "Kwame's Coffee")}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {field("lat", "Latitude", "5.6037")}
              {field("lng", "Longitude", "-0.1870")}
              {field("radius_m", "Radius (m)")}
            </div>
            {field("perk_text", "Perk shown to members")}
            <div className="grid grid-cols-2 gap-2">
              {field("perk_prefix", "Code prefix", "SKAN")}
              {field("contact_email", "Contact email")}
            </div>
            <Button
              size="sm"
              variant="heat"
              disabled={create.isPending || !draft.name.trim() || !draft.lat || !draft.lng}
              onClick={() => create.mutate()}
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Create zone
            </Button>
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {zones.length === 0 ? (
            <p className="text-xs text-muted-foreground">No zones yet.</p>
          ) : null}
          {zones.map((z) => (
            <div key={z.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{z.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {z.perk_text} · {z.radius_m} m · {z.lat.toFixed(4)}, {z.lng.toFixed(4)}
                  </p>
                </div>
                <Switch
                  checked={z.active}
                  onCheckedChange={(v) => update.mutate({ id: z.id, patch: { active: v } })}
                />
                <button
                  type="button"
                  aria-label={`Remove ${z.name}`}
                  className="text-destructive"
                  onClick={() => remove.mutate(z.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border p-3">
        <h3 className="text-sm font-semibold">Zone requests</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Sent from the venue page on the web.
        </p>
        <div className="mt-3 space-y-2">
          {requests.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing yet.</p>
          ) : null}
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{r.business_name}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.contact_email}
                {r.address ? ` · ${r.address}` : ""}
              </p>
              {r.notes ? <p className="mt-1 text-xs">{r.notes}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
