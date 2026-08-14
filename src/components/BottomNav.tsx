import { Link } from "@tanstack/react-router";
import { Radar, MessagesSquare, UserRound } from "lucide-react";

const items = [
  { to: "/radar", label: "Radar", icon: Radar },
  { to: "/chats", label: "Chats", icon: MessagesSquare },
  { to: "/profile", label: "You", icon: UserRound },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
