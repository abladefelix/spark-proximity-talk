import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";

import { INTENTS, intentFor } from "@/lib/intents";
import { errorMessage } from "@/lib/errors";
import { useMyIntent, useSetIntent, useSetMood } from "@/hooks/useIntent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DURATIONS = [30, 60, 120, 240] as const;

/**
 * The chip that sits on the radar showing what you're up to, plus the sheet
 * for changing it. An intent turns a cold ping into "lunch buddy in 20 mins".
 */
export function IntentChip() {
  const [open, setOpen] = useState(false);
  const { data } = useMyIntent();
  const def = intentFor(data?.intent);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 text-left"
      >
        <span className="text-base leading-none">{def ? def.emoji : "✨"}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {def ? def.label : "What are you up to?"}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {def
              ? (data?.intent_note ?? "Tap to change or clear")
              : "Set an intent so signals make sense"}
          </span>
        </span>
        {data?.mood ? (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px]">
            {data.mood}
          </span>
        ) : null}
      </button>
      <IntentSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function IntentSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data } = useMyIntent();
  const setIntent = useSetIntent();
  const setMood = useSetMood();
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState<number>(60);
  const [mood, setMoodText] = useState("");

  const current = picked ?? data?.intent ?? null;
  const def = intentFor(current);

  async function save() {
    try {
      await setIntent.mutateAsync({ intent: current, note: note.trim(), minutes });
      const nextMood = mood.trim();
      if (nextMood !== (data?.mood ?? "")) await setMood.mutateAsync(nextMood);
      toast.success(def ? `You're set: ${def.label}` : "Intent cleared");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e, "Could not save"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setPicked(data?.intent ?? null);
          setNote(data?.intent_note ?? "");
          setMoodText(data?.mood ?? "");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> What are you up to?
          </DialogTitle>
          <DialogDescription>
            People nearby see this on your beacon. It clears itself when the time runs out.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {INTENTS.map((i) => (
            <button
              key={i.key}
              type="button"
              onClick={() => {
                setPicked(i.key);
                if (!note.trim()) setNote("");
              }}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs ${
                current === i.key ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <span className="text-base leading-none">{i.emoji}</span>
              <span className="truncate">{i.label}</span>
            </button>
          ))}
        </div>

        <Input
          value={note}
          maxLength={80}
          placeholder={def ? def.hint : "Add a short note (optional)"}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">For</span>
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                minutes === m ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
        </div>

        <Input
          value={mood}
          maxLength={24}
          placeholder="Mood — e.g. 🎧 heads down, 😄 up for anything"
          onChange={(e) => setMoodText(e.target.value)}
        />

        <div className="flex gap-2">
          {data?.intent ? (
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setPicked(null);
                setNote("");
              }}
            >
              <X className="size-4" /> Clear
            </Button>
          ) : null}
          <Button
            variant="heat"
            className="flex-1"
            disabled={setIntent.isPending || setMood.isPending}
            onClick={() => void save()}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
