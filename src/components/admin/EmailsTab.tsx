import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { approveUserEmail, listPendingEmails } from "@/lib/emails.functions";
import { Pager, paginate } from "@/components/admin/Pager";

const PER_PAGE = 10;

export function EmailsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const fetchPending = useServerFn(listPendingEmails);
  const approve = useServerFn(approveUserEmail);

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["admin-pending-emails"],
    queryFn: () => fetchPending(),
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => approve({ data: { userId } }),
    onSuccess: () => {
      toast.success("Email approved");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-emails"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <>
    <ul className="divide-y divide-border rounded-xl border border-border">
      {paginate(pending, page, PER_PAGE).map((u) => (
        <li key={u.id} className="flex items-center gap-2.5 px-2.5 py-2">
          <MailCheck className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{u.email}</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              signed up {new Date(u.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button
            size="sm"
            variant="heat"
            className="gap-1 text-xs"
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate(u.id)}
          >
            <Check className="size-3.5" />
            Approve
          </Button>
        </li>
      ))}
      {pending.length === 0 && (
        <li className="py-6 text-center text-sm text-muted-foreground">
          No unconfirmed emails.
        </li>
      )}
    </ul>
    <Pager page={page} perPage={PER_PAGE} total={pending.length} onPageChange={setPage} label="emails" />
    </>
  );
}
