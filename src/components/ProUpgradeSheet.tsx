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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{billing?.pro_label ?? "Go Pro"}</DialogTitle>
            <DialogDescription>
              {billing?.pro_pitch ?? "Unlock the full radar experience."}
            </DialogDescription>
          </DialogHeader>
          <ProUpgradeCard />
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
