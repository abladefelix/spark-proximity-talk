import { Link } from "@tanstack/react-router";
import { Radar, MessagesSquare, UserRound, Sparkles } from "lucide-react";

import { GoProButton } from "@/components/GoProButton";

const items = [
  { to: "/radar", label: "Radar", icon: Radar },
  { to: "/local", label: "Local", icon: Sparkles },
  { to: "/chats", label: "Chats", icon: MessagesSquare },
  { to: "/profile", label: "You", icon: UserRound },
] as const;

export function BottomNav() {
  return (
    <nav className="relative z-40 h-[var(--nav-height)] shrink-0 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto grid h-full max-w-lg grid-cols-5 items-stretch px-1.5">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] leading-none text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="size-5 shrink-0" />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
        <GoProButton variant="nav" />
      </div>
    </nav>
  );
}

