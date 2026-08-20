import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Slice helper so lists share one pagination convention. */
export function paginate<T>(items: T[], page: number, perPage: number) {
  const start = page * perPage;
  return items.slice(start, start + perPage);
}

export function Pager({
  page,
  perPage,
  total,
  onPageChange,
  label = "items",
}: {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return null;
  const from = page * perPage + 1;
  const to = Math.min(total, (page + 1) * perPage);

  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <p className="text-[11px] text-muted-foreground">
        {from}–{to} of {total} {label}
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {page + 1}/{pages}
        </span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Next page"
          disabled={page + 1 >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
