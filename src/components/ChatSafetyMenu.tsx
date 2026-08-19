import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Flag, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useAppSettings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/**
 * Report/block from inside a conversation. Both stores require these actions
 * to be reachable wherever user-generated content is shown — not only on the
 * discovery screen.
 */
export function ChatSafetyMenu({
  otherId,
  otherName,
  onBlocked,
}: {
  otherId: string | undefined;
  otherName: string;
  onBlocked?: () => void;
}) {
  const settings = useSettings();
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function block() {
    if (!otherId) return;
    setBusy(true);
    const me = (await supabase.auth.getUser()).data.user?.id;
    if (!me) return setBusy(false);
    const { error } = await supabase.from("blocks").insert({ blocker: me, blocked: otherId });
    setBusy(false);
    if (error) {
      toast.error("Couldn't block");
      return;
    }
    toast.success(`${otherName} blocked`);
    queryClient.invalidateQueries({ queryKey: ["nearby"] });
    queryClient.invalidateQueries({ queryKey: ["blocked"] });
    queryClient.invalidateQueries({ queryKey: ["active-chats"] });
    onBlocked?.();
  }

  async function report() {
    if (!otherId || !reason.trim()) return;
    setBusy(true);
    const me = (await supabase.auth.getUser()).data.user?.id;
    if (!me) return setBusy(false);
    const { error } = await supabase
      .from("reports")
      .insert({ reporter: me, reported: otherId, reason: reason.trim() });
    setBusy(false);
    if (error) {
      toast.error("Couldn't send report");
      return;
    }
    setReason("");
    setReporting(false);
    toast.success("Report sent. We review reports within 24 hours.");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Safety options"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:scale-90"
          >
            <MoreVertical className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {settings.reports_enabled && (
            <DropdownMenuItem onSelect={() => setReporting(true)}>
              <Flag className="size-4" /> Report conversation
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setConfirmBlock(true)}
          >
            <Ban className="size-4" /> Block {otherName}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reporting} onOpenChange={setReporting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {otherName}</DialogTitle>
            <DialogDescription>
              Tell us what happened. Abusive content and behaviour are removed and the account is
              actioned — usually within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What's the problem?"
            rows={4}
          />
          <Button
            variant="heat"
            disabled={!reason.trim() || busy}
            onClick={() => void report()}
          >
            Send report
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {otherName}?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't see each other on the radar and neither of you can message the other. You
              can unblock from your profile later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void block()}>Block</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
