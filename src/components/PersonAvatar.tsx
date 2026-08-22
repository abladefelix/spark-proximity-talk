import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
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

  // A stored photo can 404 or its signed link can expire — never leave a broken image.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  const showImage = Boolean(url) && !broken;
  const tint = (gender && genderTint[gender]) || "bg-secondary text-secondary-foreground";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        showImage ? "bg-secondary text-secondary-foreground" : tint,
        className,
      )}
    >
      {showImage ? (
        <img
          src={url!}
          alt={name ?? username}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : gender === "male" || gender === "female" ? (
        <GenderAvatarIcon gender={gender} className="h-3/5 w-3/5" />
      ) : (
        <User className="h-3/5 w-3/5 opacity-70" aria-hidden="true" />
      )}
    </div>
  );
}


