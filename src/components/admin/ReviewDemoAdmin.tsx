import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { setReviewDemoAccess } from "@/lib/review-demo.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReviewDemoAdmin() {
  const [username, setUsername] = useState("");
  const update = useMutation({
    mutationFn: (enabled: boolean) =>
      setReviewDemoAccess({ data: { username: username.trim(), enabled } }),
  });
  return (
    <section className="space-y-3 rounded-xl border p-3">
      <h3 className="font-semibold">Review demo data</h3>
      <p className="text-sm text-muted-foreground">
        Enable fictional sample people, chats and questions for one account. Demo actions stay on
        that device and never contact real members. Pro membership is managed separately in Billing.
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
          Enable demo data
        </Button>
        <Button
          variant="outline"
          disabled={!username.trim() || update.isPending}
          onClick={() => update.mutate(false)}
        >
          Disable demo data
        </Button>
      </div>
      {update.error && <p role="alert">{update.error.message}</p>}
      {update.data && (
        <p role="status">
          Demo data {update.data.enabled ? "enabled" : "disabled"} for @{update.data.username}.{" "}
          {update.data.enabled
            ? "Open Chats → Open review demo in the app."
            : "An open demo closes on its next access check (within 15 seconds while online)."}
        </p>
      )}
    </section>
  );
}
