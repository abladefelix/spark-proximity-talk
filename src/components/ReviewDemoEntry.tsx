import { useQuery } from "@tanstack/react-query";
import { getReviewDemoAccess } from "@/lib/review-demo.functions";

export function ReviewDemoEntry({ userId }: { userId: string }) {
  const access = useQuery({
    queryKey: ["review-demo-access", userId],
    queryFn: () => getReviewDemoAccess(),
    refetchInterval: (query) => (query.state.data?.enabled ? 15000 : 60000),
    retry: false,
  });
  if (!access.data?.enabled || access.isError) return null;
  return (
    <aside className="m-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <strong>Review demo available</strong>
      <p>Explore fictional sample chats and questions, independent of your location.</p>
      <a className="font-semibold underline" href="/review-demo">
        Open review demo
      </a>
    </aside>
  );
}
