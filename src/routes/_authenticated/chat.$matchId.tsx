import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({
    meta: [
      { title: "Chat — SkanAround" },
      { name: "description", content: "Your private SkanAround conversation after a mutual signal." },
      { property: "og:title", content: "SkanAround chat" },
      { property: "og:description", content: "A conversation that started with a signal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { matchId } = Route.useParams();
  return (
    <ChatPanel
      matchId={matchId}
      leading={
        <Link to="/chats" className="text-muted-foreground">
          <ChevronLeft className="size-6" />
        </Link>
      }
    />
  );
}
