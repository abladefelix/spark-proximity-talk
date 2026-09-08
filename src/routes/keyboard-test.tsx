import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ImagePlus, ArrowUp } from "lucide-react";

export const Route = createFileRoute("/keyboard-test")({
  component: KeyboardTestPage,
});

function KeyboardTestPage() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (keyboardOpen) {
      html.style.setProperty("--keyboard-inset", "330px");
      html.setAttribute("data-keyboard-open", "");
    } else {
      html.style.setProperty("--keyboard-inset", "0px");
      html.removeAttribute("data-keyboard-open");
    }
    return () => {
      html.style.setProperty("--keyboard-inset", "0px");
      html.removeAttribute("data-keyboard-open");
    };
  }, [keyboardOpen]);

  const messages = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    text: `Message ${i + 1} — this is a test message to make the transcript scrollable.`,
    mine: i % 3 === 0,
  }));

  return (
    <div
      data-app-shell
      className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden overscroll-none"
    >
      <div
        data-chat-route
        className="relative mx-auto flex h-full min-h-0 w-full max-w-lg flex-col"
        style={{
          height: "min(100%, calc(100% - var(--keyboard-inset) + var(--chat-keyboard-compensation, 0px)))",
        }}
      >
        <header
          className="relative z-20 flex shrink-0 items-center gap-1 border-b border-border/60 bg-background px-1.5 pb-2"
          style={{
            paddingTop: "calc(var(--chat-safe-top) + 0.25rem)",
            backgroundImage: "var(--gradient-night)",
            backgroundAttachment: "fixed",
          }}
        >
          <button
            type="button"
            aria-label="Back"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground/80"
          >
            <ChevronLeft className="size-6" strokeWidth={2.25} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="size-9 rounded-full bg-primary/20" />
            <div className="min-w-0">
              <p className="truncate text-[15.5px] font-semibold leading-tight tracking-[-0.01em]">
                Test Chat
              </p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">Active now</p>
            </div>
          </div>
        </header>

        <div
          data-scrollable
          className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain [transform:translateZ(0)]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="px-3.5 pb-3 pt-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`mb-2 flex ${m.mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-[20px] px-4 py-2.5 text-[14px] leading-snug ${
                    m.mine
                      ? "rounded-tr-[8px] bg-primary text-primary-foreground"
                      : "rounded-tl-[8px] bg-card text-foreground ring-1 ring-border/50"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          className="relative z-20 flex shrink-0 items-center gap-2 border-t border-border/60 bg-background px-2.5 pt-3"
          style={{
            paddingBottom: "calc(0.5rem + max(var(--safe-bottom) - var(--keyboard-inset), 0px))",
          }}
          onSubmit={(e) => e.preventDefault()}
        >
          <button
            type="button"
            aria-label="Upload"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border/50"
          >
            <ImagePlus className="size-[19px]" />
          </button>
          <div className="flex min-w-0 flex-1 items-center rounded-[24px] bg-card px-3 py-[7px] ring-1 ring-border/50">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder="Type a message..."
              className="max-h-28 min-h-[22px] w-full resize-none bg-transparent py-1.5 text-[15px] leading-snug outline-none placeholder:text-muted-foreground/60"
              style={{ height: "auto" }}
            />
          </div>
          <button
            type="submit"
            aria-label="Send"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_var(--primary)]"
          >
            <ArrowUp className="size-[19px]" />
          </button>
        </form>
      </div>

      <nav
        aria-hidden={keyboardOpen || undefined}
        className={`relative z-40 shrink-0 border-t border-border bg-card ${keyboardOpen ? "invisible pointer-events-none" : ""}`}
        style={{ height: "calc(var(--nav-height) + var(--safe-bottom))", paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Bottom nav
        </div>
      </nav>
    </div>
  );
}
