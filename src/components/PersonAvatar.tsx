import { useQuery } from "@tanstack/react-query";
import { getAvatarUrl } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { GenderAvatarIcon } from "@/components/GenderAvatarIcon";

export type Gender = "male" | "female" | "other" | null | undefined;

type Props = {
  path: string | null | undefined;
  name: string | null | undefined;
  username: string;
  gender?: Gender;
  className?: string;
};

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
      ) : (
        <GenderAvatarIcon gender={gender ?? "other"} className="h-3/4 w-3/4" />
      )}
    </div>
  );
}
