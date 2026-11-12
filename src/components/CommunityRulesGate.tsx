import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const COMMUNITY_VERSION = "2026-11-11";
export function CommunityRulesGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [agreed, setAgreed] = useState(false);
  const qc = useQueryClient();
  const acceptance = useQuery({
    queryKey: ["community-acceptance", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_acceptances")
        .select("version")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.version === COMMUNITY_VERSION;
    },
  });
  const accept = useMutation({
    mutationFn: async () => {
      if (!agreed) throw new Error("Please read and accept the rules");
      const { error } = await supabase.rpc("accept_community_rules", {
        _version: COMMUNITY_VERSION,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-acceptance", userId] }),
  });
  if (acceptance.data === true) return <>{children}</>;
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center space-y-5 px-6 py-10">
      <h1 className="text-2xl font-semibold">Community rules · 18+</h1>
      <p>
        There is zero tolerance for objectionable content or abusive users. Do not post harassment,
        threats, hate speech, sexual content, scams or illegal material.
      </p>
      <p>
        Report content using its safety menu. You can block users, remove posts from your feed and
        delete your own questions immediately. Confirmed offending content is removed and abusive
        accounts are suspended or banned within 24 hours.
      </p>
      <p>
        Your location is hidden until you manually check in. Each check-in lasts for your chosen duration (15 minutes by default, up to 2 hours),
        with a free Stop sharing control.
      </p>
      <div className="flex flex-wrap gap-4 underline">
        <Link to="/terms">Terms & EULA</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/support">Safety & contact</Link>
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-5"
        />
        I am 18 or older and agree to the Terms & EULA, Privacy Policy and zero-tolerance community
        rules.
      </label>
      {acceptance.isError && (
        <p role="alert">
          Could not load your agreement.{" "}
          <button className="underline" onClick={() => void acceptance.refetch()}>
            Retry
          </button>
        </p>
      )}
      {accept.error && <p role="alert">Could not save your agreement. Please try again.</p>}
      <Button
        disabled={!agreed || acceptance.isPending || acceptance.isError || accept.isPending}
        onClick={() => accept.mutate()}
      >
        Agree and continue
      </Button>
      <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>
        Sign out
      </Button>
    </main>
  );
}
