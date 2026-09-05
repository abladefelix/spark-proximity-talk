import { useState } from "react";
import { Crown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProUpgradeCard } from "@/components/ProUpgradeCard";
import { useBillingInfo, useMySubscription } from "@/hooks/useBilling";
import { cn } from "@/lib/utils";

type Props = {
  /** "icon" small round, "full" wide button, "nav" bottom-bar tab. */
  variant?: "icon" | "full" | "nav";
  className?: string;
};

/** Opens the membership sheet so anyone can go Pro after signing up. */
export function GoProButton({ variant = "icon", className }: Props) {
  const { data: billing } = useBillingInfo();
  const { data: sub } = useMySubscription();
  const [open, setOpen] = useState(false);

  if (!billing?.enabled) return null;

  const isPro = Boolean(sub?.isPro);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "nav" ? (
          <button
            type="button"
            aria-label={isPro ? billing.pro_label : "Go Pro"}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs transition-colors",
              isPro ? "text-primary" : "text-muted-foreground",
              className,
            )}
          >
            <Crown className={cn("size-5", isPro && "fill-current")} />
            {isPro ? "Pro" : "Go Pro"}
          </button>
        ) : variant === "icon" ? (
          <button
            type="button"
            aria-label={isPro ? billing.pro_label : "Go Pro"}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20",
              className,
            )}
          >
            <Crown className={cn("size-4", isPro && "fill-current")} />
          </button>
        ) : (
          <Button
            variant={isPro ? "outline" : "heat"}
            size="lg"
            className={cn("w-full", className)}
          >
            <Crown className={cn("mr-2 size-4", isPro && "fill-current")} />
            {isPro ? `You're on ${billing.pro_label}` : "Go Pro"}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5 pr-12 text-left">
          <DialogTitle>{billing.pro_label}</DialogTitle>
          <DialogDescription>{billing.pro_pitch}</DialogDescription>
        </DialogHeader>
        <div data-scrollable className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,var(--safe-bottom))]">
          <ProUpgradeCard />
        </div>
      </DialogContent>
    </Dialog>
  );
}
