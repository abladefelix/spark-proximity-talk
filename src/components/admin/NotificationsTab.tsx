import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Loader2, Search, Send, Trash2, User as UserIcon, Users } from "lucide-react";

import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Row = {
  id: string;
  title: string;
  body: string;
  audience: string;
  user_id: string | null;
  created_at: string;
};

export function NotificationsTab() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "user">("all");
  const [target, setTarget] = useState("");

  const { data: sent = [], isLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,audience,user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["admin-notify-people"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name")
        .order("username");
      if (error) throw error;
      return data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) throw new Error("Not signed in");
      if (!title.trim() || !body.trim()) throw new Error("Add a title and a message");
      if (audience === "user" && !target) throw new Error("Pick a member");
      const { error } = await supabase.from("notifications").insert({
        title: title.trim(),
        body: body.trim(),
        audience,
        user_id: audience === "user" ? target : null,
        created_by: me,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(audience === "all" ? "Sent to everyone" : "Sent");
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const nameOf = (id: string | null) =>
    people.find((p) => p.id === id)?.username ?? "member";

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border p-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={audience === "all" ? "heat" : "outline"}
            className="gap-1.5 text-xs"
            onClick={() => setAudience("all")}
          >
            <Users className="size-3.5" /> Everyone
          </Button>
          <Button
            type="button"
            size="sm"
            variant={audience === "user" ? "heat" : "outline"}
            className="gap-1.5 text-xs"
            onClick={() => setAudience("user")}
          >
            <UserIcon className="size-3.5" /> One member
          </Button>
        </div>

        {audience === "user" && (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Select a member…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name ? `${p.display_name} (@${p.username})` : `@${p.username}`}
              </option>
            ))}
          </select>
        )}

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={80}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
          rows={3}
          maxLength={500}
        />
        <Button
          variant="heat"
          className="w-full gap-1.5"
          disabled={send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send notification
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {sent.map((n) => (
            <li key={n.id} className="flex items-start gap-2.5 px-2.5 py-2">
              <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{n.title}</p>
                <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{n.body}</p>
                <p className="text-[10px] text-muted-foreground">
                  {n.audience === "all" ? "Everyone" : `@${nameOf(n.user_id)}`} ·{" "}
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => remove.mutate(n.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
          {sent.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">No notifications yet</li>
          )}
        </ul>
      )}
    </div>
  );
}
