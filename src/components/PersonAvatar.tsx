import { useQuery } from "@tanstack/react-query";
import { getAvatarUrl, initials } from "@/lib/avatars";
import { cn } from "@/lib/utils";

type Props = {
  path: string | null | undefined;
  name: string | null | undefined;
  username: string;
  className?: string;
};

export function PersonAvatar({ path, name, username, className }: Props) {
  const { data: url } = useQuery({
    queryKey: ["avatar", path],
    queryFn: () => getAvatarUrl(path),
    enabled: Boolean(path),
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary font-display text-secondary-foreground",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name ?? username} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm">{initials(name, username)}</span>
      )}
    </div>
  );
}
