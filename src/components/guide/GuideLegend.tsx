import type { ReactNode } from "react";
import {
  Bell,
  Crown,
  MessagesSquare,
  Radar as RadarIcon,
  Compass,
  UserRound,
  EyeOff,
} from "lucide-react";

import { GenderAvatarIcon } from "@/components/GenderAvatarIcon";
import { RadarBeacon } from "@/components/RadarBeacon";
import { VerifiedBadgeMark } from "@/components/VerifiedBadge";
import { BEACON_STYLES } from "@/lib/beacon-styles";
import { useSettings } from "@/hooks/useAppSettings";

function Row({
  visual,
  term,
  body,
}: {
  visual: ReactNode;
  term: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-secondary/60">
        {visual}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{term}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="mt-1 divide-y divide-border/60">{children}</div>
    </section>
  );
}

/**
 * Live legend of every symbol the app draws, rendered with the real
 * components so the guide can never drift from the UI.
 */
export function GuideLegend() {
  const settings = useSettings();
  const badgeStyle = (settings.verified_badge_style as never) ?? "check";
  const badgeColor = settings.verified_badge_color ?? "#22c55e";

  return (
    <div className="space-y-4">
      <Group title="Avatars on a beacon">
        <Row
          visual={
            <RadarBeacon sizePx={40}>
              <GenderAvatarIcon gender="male" className="h-3/5 w-3/5 text-sky-500" />
            </RadarBeacon>
          }
          term="Male avatar (Mars symbol)"
          body="A circle with an arrow pointing to the top-right. This person registered as male and has not uploaded a photo yet."
        />
        <Row
          visual={
            <RadarBeacon sizePx={40}>
              <GenderAvatarIcon gender="female" className="h-3/5 w-3/5 text-pink-500" />
            </RadarBeacon>
          }
          term="Female avatar (Venus symbol)"
          body="A circle with a small cross below it. This person registered as female and has not uploaded a photo yet."
        />
        <Row
          visual={
            <RadarBeacon sizePx={40}>
              <UserRound className="size-5 opacity-70" />
            </RadarBeacon>
          }
          term="Neutral avatar"
          body="A plain person outline: no photo and gender set to something other than male or female."
        />
        <Row
          visual={
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary">
              AK
            </span>
          }
          term="Profile photo"
          body="When someone has uploaded a photo, the beacon shows it instead of an avatar symbol. That is the fastest way to recognise a person around you."
        />
      </Group>

      <Group title="Beacon states">
        <Row
          visual={<RadarBeacon sizePx={36} active><GenderAvatarIcon gender="female" className="h-3/5 w-3/5" /></RadarBeacon>}
          term="Active beacon"
          body="Pulsing ring and a bright dot in the corner: the person is on the app right now and their position is fresh."
        />
        <Row
          visual={<RadarBeacon sizePx={36}><GenderAvatarIcon gender="male" className="h-3/5 w-3/5" /></RadarBeacon>}
          term="Idle beacon"
          body="No pulse and a soft grey ring: their last known position is a little older. They may not respond immediately."
        />
        <Row
          visual={<RadarBeacon sizePx={36} active verified><GenderAvatarIcon gender="male" className="h-3/5 w-3/5" /></RadarBeacon>}
          term="Verified beacon"
          body="A distinct cyan ring marks a member whose identity has been checked by the team."
        />
      </Group>

      <Group title="Badges and markers">
        <Row
          visual={<VerifiedBadgeMark style={badgeStyle} color={badgeColor} className="size-6" />}
          term="Verified badge"
          body="Shown next to a name on the profile card and in chat. It means the account passed verification — it is not a safety guarantee."
        />
        <Row
          visual={<Crown className="size-6 text-amber-500" />}
          term="Pro member"
          body="A Pro member has unlocked extras such as a custom beacon colour, a wider scan range and unlimited signals."
        />
        <Row
          visual={<EyeOff className="size-6 text-muted-foreground" />}
          term="Invisible"
          body="When you turn visibility off you disappear from everyone's radar while still being able to browse. Your existing chats keep working."
        />
      </Group>

      <Group title="Pro beacon colours">
        <div className="flex flex-wrap gap-3 py-3">
          {BEACON_STYLES.map((style) => (
            <div key={style.id} className="flex w-16 flex-col items-center gap-1.5">
              <span
                className="size-8 rounded-full border-2 bg-card"
                style={{
                  borderColor: style.color || "var(--primary)",
                  boxShadow: `0 0 12px ${style.color || "var(--primary)"}`,
                }}
              />
              <span className="text-[11px] text-muted-foreground">{style.label}</span>
            </div>
          ))}
        </div>
        <p className="pb-1 text-sm leading-relaxed text-muted-foreground">
          Pro members choose one of these ring colours from their profile, so their beacon stands
          out on a busy radar.
        </p>
      </Group>

      <Group title="Tab bar">
        <Row
          visual={<RadarIcon className="size-6 text-primary" />}
          term="Radar"
          body="The scope with everyone near you. Your home screen."
        />
        <Row
          visual={<MessagesSquare className="size-6 text-primary" />}
          term="Chats"
          body="Your matched conversations, stacked with the newest on top."
        />
        <Row
          visual={<UserRound className="size-6 text-primary" />}
          term="You"
          body="Photo, name, bio, scan range, visibility, sound, app lock, theme and account controls."
        />
        <Row
          visual={<Crown className="size-6 text-primary" />}
          term="Go Pro"
          body="Appears when upgrades are available. Shows what each plan unlocks."
        />
      </Group>

      <Group title="Controls around the scope">
        <Row
          visual={<Compass className="size-6 text-primary" />}
          term="Compass button"
          body="Below the scope. On (heading-up) the radar rotates with you, so straight up is wherever you are facing. Off (north-up) keeps north at the top."
        />
        <Row
          visual={<Bell className="size-6 text-primary" />}
          term="Notification bell"
          body="Announcements from the team plus activity alerts. A dot means something unread."
        />
        <Row
          visual={
            <span className="text-xs font-semibold text-muted-foreground">
              +/&minus;
            </span>
          }
          term="Pinch to zoom"
          body="Pinch or scroll on the scope to zoom. Zooming in spreads people who are standing almost on top of each other so you can tap each one."
        />
      </Group>
    </div>
  );
}
