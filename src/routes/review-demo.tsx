import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useReducer, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getReviewDemoAccess } from "@/lib/review-demo.functions";
import { DEMO_PEOPLE, demoReducer, seedDemo } from "@/lib/review-demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/review-demo")({ ssr: false, component: ReviewDemo });
function ReviewDemo() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUserId(session?.user.id ?? null),
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const access = useQuery({
    queryKey: ["review-demo-page-access", userId],
    enabled: Boolean(userId),
    queryFn: () => getReviewDemoAccess(),
    refetchInterval: 15000,
    retry: false,
    staleTime: 0,
  });
  return (
    <main
      data-scrollable
      className="mx-auto h-full max-w-lg overflow-y-auto p-4 pb-24 pt-[max(1rem,var(--safe-top))]"
    >
      <h1 className="text-2xl font-bold">SkanAround review demo</h1>
      <p className="my-3 text-sm">
        Fictional people, sample conversations and questions. No real location is used and nothing
        here is sent to real members. Reports and replies are simulated. Purchases and live
        moderation must be tested in the main app.
      </p>
      <a href="/chats" className="underline">
        Return to the app
      </a>
      {!userId ? (
        <p>Sign in through the app to use review demo data.</p>
      ) : access.isPending ? (
        <p role="status">Checking demo access…</p>
      ) : access.isError ? (
        <p role="alert">
          Demo access could not be verified. Sign in through the app, then return here. If you are
          already signed in, check your connection and retry.
        </p>
      ) : !access.data.enabled ? (
        <p role="status">Demo data is disabled for this account.</p>
      ) : (
        <DemoWorkspace key={access.data.userId} />
      )}
      {access.isError && (
        <Button variant="outline" onClick={() => access.refetch()}>
          Retry
        </Button>
      )}
    </main>
  );
}
function DemoWorkspace() {
  const [state, dispatch] = useReducer(demoReducer, undefined, seedDemo);
  const [person, setPerson] = useState("alex");
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState("");
  const blocked = state.blocked.includes(person);
  return (
    <div className="mt-5 space-y-6">
      <p className="rounded-lg bg-muted p-3 text-sm">
        Demo data stays available while enabled. Reload this page to reset sample interactions. Demo
        actions are not saved to your real account.
      </p>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sample people</h2>
        {DEMO_PEOPLE.map((p) => (
          <article key={p.id} className="space-y-2 rounded-xl border p-3">
            <h3 className="font-semibold">{p.name}</h3>
            <p className="text-sm">{p.bio}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={state.blocked.includes(p.id)}
                onClick={() => dispatch({ type: "signal", person: p.id })}
              >
                {state.signals.includes(p.id) ? "Demo signal sent · matched" : "Send demo signal"}
              </Button>
              <Button variant="outline" onClick={() => setPerson(p.id)}>
                Open sample chat
              </Button>
              <Button
                variant="outline"
                disabled={state.blocked.includes(p.id)}
                onClick={() => dispatch({ type: "block", person: p.id })}
              >
                {state.blocked.includes(p.id) ? "Blocked in demo" : "Block in demo"}
              </Button>
            </div>
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Chat with {DEMO_PEOPLE.find((p) => p.id === person)?.name}
        </h2>
        <div aria-live="polite" className="space-y-2">
          {state.messages
            .filter((m) => m.person === person)
            .map((m, i) => (
              <p
                key={i}
                className={`rounded-xl p-3 text-sm ${m.from === "me" ? "ml-8 bg-primary/10" : "mr-8 bg-muted"}`}
              >
                <strong>{m.from === "me" ? "You" : "Demo member"}: </strong>
                {m.text}
              </p>
            ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: "send", person, text: message });
            setMessage("");
          }}
        >
          <Input
            aria-label="Demo message"
            maxLength={500}
            value={message}
            disabled={blocked}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={blocked ? "Blocked in demo" : "Write a demo message"}
          />
          <Button disabled={blocked || !message.trim()}>Send</Button>
        </form>
        <Button
          variant="outline"
          onClick={() => dispatch({ type: "report", target: `chat-${person}` })}
        >
          Report sample chat
        </Button>
        {state.reports.includes(`chat-${person}`) && (
          <p role="status">Demo report recorded locally. No moderation report was sent.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sample questions</h2>
        {state.questions.map((q) => (
          <article key={q.id} className="space-y-2 rounded-xl border p-3">
            <p className="text-xs">{q.author === "me" ? "Your demo question" : "Demo member"}</p>
            <h3>{q.text}</h3>
            <div className="flex flex-wrap gap-2">
              {q.answers.map((a, i) => (
                <Button
                  key={a}
                  variant={q.vote === i ? "default" : "outline"}
                  onClick={() => dispatch({ type: "vote", id: q.id, option: i })}
                >
                  {a}
                  {q.vote === i ? " · selected" : ""}
                </Button>
              ))}
            </div>
            {q.author === "me" ? (
              <Button variant="outline" onClick={() => dispatch({ type: "delete", id: q.id })}>
                Delete my demo question
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => dispatch({ type: "report", target: `question-${q.id}` })}
              >
                Report sample question
              </Button>
            )}
            {state.reports.includes(`question-${q.id}`) && (
              <p role="status">Demo report recorded locally. No moderation report was sent.</p>
            )}
          </article>
        ))}
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: "question", text: question });
            setQuestion("");
          }}
        >
          <label className="block text-sm">
            Ask a demo yes/no question
            <Input maxLength={200} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </label>
          <Button disabled={!question.trim() || state.questions.length >= 12}>
            Post demo question
          </Button>
        </form>
      </section>
    </div>
  );
}
