import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CheckinDurationSetting({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const key = ["checkin-duration", userId];
  const preference = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("checkin_duration_minutes")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data.checkin_duration_minutes;
    },
  });
  const save = useMutation({
    mutationFn: async (minutes: number) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ checkin_duration_minutes: minutes })
        .eq("id", userId)
        .select("checkin_duration_minutes")
        .single();
      if (error) throw error;
      return data.checkin_duration_minutes;
    },
    onSuccess: (minutes) => {
      qc.setQueryData(key, minutes);
      toast.success("Duration saved for your next check-in");
    },
    onError: () => toast.error("Could not save the duration. Please try again."),
  });
  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Clock className="size-4 text-primary" />
        Check-in duration
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Choose how long your next manual check-in can last. Sharing never renews automatically. Stop
        sharing, leaving Radar or backgrounding the app ends it earlier.
      </p>
      <div className="mt-3">
        <Select
          value={String(preference.data ?? 15)}
          disabled={preference.isPending || preference.isError || save.isPending}
          onValueChange={(value) => save.mutate(Number(value))}
        >
          <SelectTrigger aria-label="Check-in duration">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 minutes (default)</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="120">2 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {preference.isError && (
        <p className="mt-2 text-xs text-destructive">
          Could not load your preference.{" "}
          <button className="underline" onClick={() => void preference.refetch()}>
            Retry
          </button>
        </p>
      )}
    </section>
  );
}
