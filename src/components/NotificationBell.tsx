import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Row = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export function NotificationBell() {
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["my-notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: reads = [] } = useQuery({
    queryKey: ["my-notification-reads"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_reads").select("notification_id");
      if (error) throw error;
      return (data ?? []).map((r) => r.notification_id as string);
    },
  });

  const unread = useMemo(
    () => items.filter((n) => !reads.includes(n.id)),
    [items, reads],
  );

  const markAll = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me || unread.length === 0) return;
      const { error } = await supabase
        .from("notification_reads")
        .upsert(unread.map((n) => ({ notification_id: n.id, user_id: me })));
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notification-reads"] }),
  });

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && unread.length > 0) markAll.mutate();
      }}
    >
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative size-9" aria-label="Notifications">
          <Bell className="size-[18px]" />
          {unread.length > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {items.map((n) => (
            <li key={n.id} className="px-3 py-2">
              <p className="text-sm font-medium leading-tight">{n.title}</p>
              <p className="text-xs leading-snug text-muted-foreground">{n.body}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing here yet
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
