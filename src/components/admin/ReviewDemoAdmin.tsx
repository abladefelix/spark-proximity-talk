import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { setReviewActivity } from "@/lib/review-activity.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReviewDemoAdmin() {
  const [username, setUsername] = useState("ogyamwilson");
  const update = useMutation({
    mutationFn: (enabled: boolean) =>
      setReviewActivity({ data: { username: username.trim(), enabled } }),
  });
  return (
    <section className="space-y-3 rounded-xl border p-3">
      <h3 className="font-semibold">Review account activity</h3>
      <p className="text-sm text-muted-foreground">
        Populate the normal Chats and Local screens with four sample conversations and four
        questions. Removing samples also deletes messages exchanged with these sample accounts.
        Real-member conversations and Pro membership are unchanged.
      </p>
      <label className="block text-sm">
        Exact account username
        <Input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            update.reset();
          }}
          placeholder="ogyamwilson"
        />
      </label>
      <div className="flex gap-2">
        <Button disabled={!username.trim() || update.isPending} onClick={() => update.mutate(true)}>
          Populate / refresh samples
        </Button>
        <Button
          variant="outline"
          disabled={!username.trim() || update.isPending}
          onClick={() => {
            if (
              window.confirm(
                "Remove sample conversations, their messages, signals and questions? Real-member conversations are preserved.",
              )
            )
              update.mutate(false);
          }}
        >
          Remove sample activity
        </Button>
      </div>
      {update.error && <p role="alert">{update.error.message}</p>}
      {update.data && (
        <p role="status">
          {update.data.enabled
            ? `Saved ${update.data.chats} sample chats and ${update.data.questions} questions. Open Chats and Local in the app.`
            : "Sample conversations, signals and questions removed."}
        </p>
      )}
    </section>
  );
}
