import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Renders a suspension screen (with a reactivation appeal form) when the
 * signed-in member is banned. Otherwise renders its children.
 */
export function SuspendedGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data } = useQuery({
    queryKey: ["my-ban-status"],
    queryFn: async () => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return null;
      // Ban status is not readable from the profile table by ordinary members.
      const { data: privateRows } = await supabase.rpc("my_profile_private");
      const profile = (privateRows as any[] | null)?.[0] ?? null;

      const { data: appeal } = await supabase
        .from("reactivation_requests")
        .select("id, status, created_at")
        .eq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { me, profile, appeal };
    },
  });

  if (!data?.profile?.banned) return <>{children}</>;

  const pending = data.appeal?.status === "pending";

  async function submitAppeal() {
    if (!data?.me || message.trim().length < 10) {
      toast.error("Tell us a bit more (10+ characters).");
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from("reactivation_requests")
      .insert({ user_id: data.me, message: message.trim() });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessage("");
    toast.success("Appeal sent — we'll review it soon.");
    queryClient.invalidateQueries({ queryKey: ["my-ban-status"] });
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-4 px-6">
      <ShieldAlert className="size-8 text-destructive" />
      <h1 className="text-xl font-semibold">Your account is suspended</h1>
      <p className="text-sm text-muted-foreground">
        {data.profile.banned_reason ?? "You broke the community rules."} You're hidden from the
        radar and can't signal anyone.
      </p>
      {pending ? (
        <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
          Your reactivation request is pending review.
        </p>
      ) : (
        <>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Why should we reactivate your account?"
            rows={4}
          />
          <Button variant="heat" disabled={sending} onClick={() => void submitAppeal()}>
            Apply for reactivation
          </Button>
        </>
      )}
    </div>
  );
}
