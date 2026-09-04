import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ChatPanel } from "@/components/ChatPanel";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({
    meta: [
      { title: "Chat — SKANAROUND" },
      { name: "description", content: "Your private SKANAROUND conversation after a mutual signal." },
      { property: "og:title", content: "SKANAROUND chat" },
      { property: "og:description", content: "A conversation that started with a signal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

  const goBack = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: "/chats" });
  };

  return <ChatPanel matchId={matchId} onBack={goBack} />;
}
