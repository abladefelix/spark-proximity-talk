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
import { Pager, paginate } from "@/components/admin/Pager";
import { AdminSearch, FilterChips } from "@/components/admin/FilterBar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PER_PAGE = 10;

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
  const [zoneQuery, setZoneQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<"all" | "active" | "paused">("all");
  const [zonePage, setZonePage] = useState(0);
  const [requestQuery, setRequestQuery] = useState("");
  const [requestFilter, setRequestFilter] = useState<"all" | "new" | "handled">("all");
  const [requestPage, setRequestPage] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<Zone | null>(null);

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

  const zq = zoneQuery.trim().toLowerCase();
  const visibleZones = zones.filter((z) => {
    if (zoneFilter === "active" && !z.active) return false;
    if (zoneFilter === "paused" && z.active) return false;
    if (!zq) return true;
    return (
      z.name.toLowerCase().includes(zq) ||
      (z.description ?? "").toLowerCase().includes(zq) ||
      z.perk_text.toLowerCase().includes(zq) ||
      z.perk_prefix.toLowerCase().includes(zq) ||
      (z.contact_email ?? "").toLowerCase().includes(zq)
    );
  });

  const rq = requestQuery.trim().toLowerCase();
  const visibleRequests = requests.filter((r) => {
    const isNew = (r.status ?? "new") === "new";
    if (requestFilter === "new" && !isNew) return false;
    if (requestFilter === "handled" && isNew) return false;
    if (!rq) return true;
    return (
      r.business_name.toLowerCase().includes(rq) ||
      r.contact_email.toLowerCase().includes(rq) ||
      (r.address ?? "").toLowerCase().includes(rq) ||
      (r.notes ?? "").toLowerCase().includes(rq)
    );
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

        <AdminSearch
          className="mt-3"
          value={zoneQuery}
          onChange={(v) => {
            setZoneQuery(v);
            setZonePage(0);
          }}
          placeholder="Search zones by venue, perk or email"
        />
        <FilterChips
          className="mt-2"
          value={zoneFilter}
          onChange={(v) => {
            setZoneFilter(v);
            setZonePage(0);
          }}
          options={[
            { value: "all", label: "All", count: zones.length },
            { value: "active", label: "Live", count: zones.filter((z) => z.active).length },
            { value: "paused", label: "Paused", count: zones.filter((z) => !z.active).length },
          ]}
        />

        <div className="mt-3 space-y-2">
          {visibleZones.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {zones.length === 0 ? "No zones yet." : "No zones match those filters."}
            </p>
          ) : null}
          {paginate(visibleZones, zonePage, PER_PAGE).map((z) => (
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
                  onClick={() => setPendingRemoval(z)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Pager
          page={zonePage}
          perPage={PER_PAGE}
          total={visibleZones.length}
          onPageChange={setZonePage}
          label="zones"
        />
      </section>

      <section className="rounded-xl border border-border p-3">
        <h3 className="text-sm font-semibold">Zone requests</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Sent from the venue page on the web.
        </p>
        <AdminSearch
          className="mt-3"
          value={requestQuery}
          onChange={(v) => {
            setRequestQuery(v);
            setRequestPage(0);
          }}
          placeholder="Search requests by business, email or note"
        />
        <FilterChips
          className="mt-2"
          value={requestFilter}
          onChange={(v) => {
            setRequestFilter(v);
            setRequestPage(0);
          }}
          options={[
            { value: "all", label: "All", count: requests.length },
            {
              value: "new",
              label: "New",
              count: requests.filter((r) => (r.status ?? "new") === "new").length,
            },
            {
              value: "handled",
              label: "Handled",
              count: requests.filter((r) => (r.status ?? "new") !== "new").length,
            },
          ]}
        />

        <div className="mt-3 space-y-2">
          {visibleRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {requests.length === 0 ? "Nothing yet." : "No requests match those filters."}
            </p>
          ) : null}
          {paginate(visibleRequests, requestPage, PER_PAGE).map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{r.business_name}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.contact_email}
                {r.address ? ` · ${r.address}` : ""}
              </p>
              {r.notes ? <p className="mt-1 text-xs">{r.notes}</p> : null}
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {(r.status ?? "new") === "new" ? "New" : r.status} ·{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
        <Pager
          page={requestPage}
          perPage={PER_PAGE}
          total={visibleRequests.length}
          onPageChange={setRequestPage}
          label="requests"
        />
      </section>

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this zone?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval?.name} stops appearing to members straight away and its perk codes
              can no longer be claimed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep zone</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoval) remove.mutate(pendingRemoval.id);
                setPendingRemoval(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
