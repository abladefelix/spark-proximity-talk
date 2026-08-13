import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      aria-label="Verified profile"
      className={cn("inline-block size-4 shrink-0 text-primary", className)}
    />
  );
}
