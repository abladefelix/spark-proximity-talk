import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProUpgradeCard } from "@/components/ProUpgradeCard";
import { useBillingInfo } from "@/hooks/useBilling";

type ProUpgradeSheetContextValue = {
  open: () => void;
  close: () => void;
};

const ProUpgradeSheetContext = createContext<ProUpgradeSheetContextValue | null>(null);

export function ProUpgradeSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: billing } = useBillingInfo();

  return (
    <ProUpgradeSheetContext.Provider value={{ open: () => setOpen(true), close: () => setOpen(false) }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5 pr-12 text-left">
            <DialogTitle>{billing?.pro_label ?? "Go Pro"}</DialogTitle>
            <DialogDescription>
              {billing?.pro_pitch ?? "Unlock the full radar experience."}
            </DialogDescription>
          </DialogHeader>
          <div data-scrollable className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,var(--safe-bottom))]">
            <ProUpgradeCard />
          </div>
        </DialogContent>
      </Dialog>
    </ProUpgradeSheetContext.Provider>
  );
}

export function useProUpgradeSheet() {
  const ctx = useContext(ProUpgradeSheetContext);
  if (!ctx) throw new Error("useProUpgradeSheet must be used within ProUpgradeSheetProvider");
  return ctx;
}
