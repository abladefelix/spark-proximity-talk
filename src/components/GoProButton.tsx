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
  /** "icon" for the radar header, "full" for a wide button in the profile. */
  variant?: "icon" | "full";
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
        {variant === "icon" ? (
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

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{billing.pro_label}</DialogTitle>
          <DialogDescription>{billing.pro_pitch}</DialogDescription>
        </DialogHeader>
        <ProUpgradeCard />
      </DialogContent>
    </Dialog>
  );
}
