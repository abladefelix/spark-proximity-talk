import { Link } from "@tanstack/react-router";
import { Radar, MessagesSquare, UserRound, Sparkles } from "lucide-react";

import { GoProButton } from "@/components/GoProButton";
import { useChatNotificationsCount } from "@/hooks/useChatNotificationsCount";
import { useLocalNotificationsCount } from "@/hooks/useLocalNotifications";
import { useRadarNotificationsCount } from "@/hooks/useRadarNotificationsCount";

const items = [
  { to: "/radar", label: "Radar", icon: Radar },
  { to: "/local", label: "Local", icon: Sparkles },
  { to: "/chats", label: "Chats", icon: MessagesSquare },
  { to: "/profile", label: "You", icon: UserRound },
] as const;

export function BottomNav() {
  const { count: localCount } = useLocalNotificationsCount();
  const { count: chatCount } = useChatNotificationsCount();
  const { count: radarCount } = useRadarNotificationsCount();

  return (
    <nav className="relative z-40 h-[var(--nav-height)] shrink-0 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto grid h-full max-w-lg grid-cols-5 items-stretch px-1.5">
        {items.map(({ to, label, icon: Icon }) => {
          const badgeCount =
            to === "/local"
              ? localCount
              : to === "/chats"
                ? chatCount
                : to === "/radar"
                  ? radarCount
                  : 0;

          return (
            <Link
              key={to}
              to={to}
              className="relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] leading-none text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <span className="relative">
                <Icon className="size-5 shrink-0" />
                {badgeCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
        <GoProButton variant="nav" />
      </div>
    </nav>
  );
}


