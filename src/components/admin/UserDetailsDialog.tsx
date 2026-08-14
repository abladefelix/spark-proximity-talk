import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getUserDetails } from "@/lib/admin-users.functions";

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm" data-selectable>
        {value}
      </p>
    </div>
  );
}

/** Staff-only account inspector: identity, profile and activity counters. */
export function UserDetailsDialog({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchDetails = useServerFn(getUserDetails);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-user-details", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchDetails({ data: { userId: userId! } }),
  });

  return (
    <Dialog open={Boolean(userId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data ? (
              <>
                <PersonAvatar
                  path={null}
                  name={data.displayName}
                  username={data.username}
                  className="size-8"
                />
                <span className="truncate">{data.displayName ?? data.username}</span>
                {data.verified && <VerifiedBadge />}
              </>
            ) : (
              "Account details"
            )}
          </DialogTitle>
          <DialogDescription>
            {data ? `@${data.username}` : "Full account record for this member."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <p className="py-6 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load this account"}
          </p>
        )}

        {data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Email" value={data.email ?? "—"} />
              <Field label="Email confirmed" value={data.emailConfirmed ? "Yes" : "No"} />
              <Field label="Phone" value={data.phone ?? "—"} />
              <Field label="Gender" value={data.gender ?? "—"} />
              <Field label="Joined" value={when(data.createdAt)} />
              <Field label="Last sign-in" value={when(data.lastSignInAt)} />
              <Field label="Last seen" value={when(data.lastSeen)} />
              <Field label="Sign-in methods" value={data.providers.join(", ") || "email"} />
              <Field label="Roles" value={data.roles.join(", ") || "user"} />
              <Field
                label="Status"
                value={data.banned ? `Banned${data.bannedReason ? ` — ${data.bannedReason}` : ""}` : "Active"}
              />
            </div>

            {data.bio && <Field label="Bio" value={data.bio} />}

            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                Activity
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <Field label="Signals sent" value={String(data.counts.signalsSent)} />
                <Field label="Signals got" value={String(data.counts.signalsReceived)} />
                <Field label="Matches" value={String(data.counts.matches)} />
                <Field label="Messages" value={String(data.counts.messages)} />
                <Field label="Reports" value={String(data.counts.reportsAgainst)} />
                <Field
                  label="Location"
                  value={
                    data.location
                      ? `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`
                      : "—"
                  }
                />
              </div>
            </div>

            <Field label="User ID" value={data.id} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
