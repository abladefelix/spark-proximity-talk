import { useQuery } from "@tanstack/react-query";
import { getAvatarUrl, initials } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export type Gender = "male" | "female" | "other" | null | undefined;

type Props = {
  path: string | null | undefined;
  name: string | null | undefined;
  username: string;
  gender?: Gender;
  className?: string;
};

function GenderGlyph({ gender, className }: { gender: Gender; className?: string }) {
  if (gender === "male") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="10" cy="14" r="5.2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M14.8 9.2 20 4m0 0h-4.6M20 4v4.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (gender === "female") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="12" cy="9" r="5.2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 14.2V21M9 18.2h6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const genderTint: Record<string, string> = {
  male: "bg-sky-500/15 text-sky-500 dark:text-sky-400",
  female: "bg-pink-500/15 text-pink-500 dark:text-pink-400",
};

export function PersonAvatar({ path, name, username, gender, className }: Props) {
  const { data: url } = useQuery({
    queryKey: ["avatar", path],
    queryFn: () => getAvatarUrl(path),
    enabled: Boolean(path),
    staleTime: 1000 * 60 * 30,
  });

  const tint = (gender && genderTint[gender]) || "bg-secondary text-secondary-foreground";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        url ? "bg-secondary text-secondary-foreground" : tint,
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name ?? username} className="h-full w-full object-cover" />
      ) : gender ? (
        <GenderGlyph gender={gender} className="h-1/2 w-1/2" />
      ) : (
        <span className="text-sm">{initials(name, username)}</span>
      )}
    </div>
  );
}
