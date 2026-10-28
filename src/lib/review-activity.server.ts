import type { SupabaseClient } from "@supabase/supabase-js";

export const REVIEW_USERNAME = "ogyamwilson";
const names = ["Alex", "Sam", "Jordan", "Taylor"] as const;

/** Server only. Dedicated non-login identities; never reuse an unmarked account. */
export async function populateReviewActivity(
  admin: SupabaseClient,
  owner: string,
  enabled: boolean,
) {
  const peers: string[] = [];
  for (const name of names) {
    const username = `sample_${name.toLowerCase()}_${owner.slice(0, 6)}`;
    const { data: existing, error } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (error) throw new Error("Could not look up sample accounts");
    let peer = existing?.id;
    if (peer) {
      const { data, error: authError } = await admin.auth.admin.getUserById(peer);
      if (
        authError ||
        data.user?.app_metadata?.["review_fixture_owner"] !== owner ||
        data.user?.app_metadata?.["review_fixture_version"] !== "1"
      ) {
        throw new Error("Sample username belongs to an unmanaged account; nothing was overwritten");
      }
    } else if (enabled) {
      const { data, error: createError } = await admin.auth.admin.createUser({
        email: `${username}@review.skanaround.invalid`,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        ban_duration: "876000h",
        app_metadata: { review_fixture_owner: owner, review_fixture_version: "1" },
        user_metadata: {
          username,
          display_name: `${name} (Sample)`,
          date_of_birth: "1995-01-01",
          gender: "other",
        },
      });
      if (createError || !data.user)
        throw new Error("Could not create sample account; retry safely after checking server logs");
      peer = data.user.id;
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          bio: "Fictional sample account for testing SkanAround. No real person is contacted.",
        })
        .eq("id", peer);
      if (profileError) throw new Error("Could not label sample profile");
    }
    if (peer) peers.push(peer);
  }
  const { data, error } = await admin.rpc("manage_review_activity", {
    _owner: owner,
    _peers: peers,
    _enabled: enabled,
  });
  if (error)
    throw new Error(
      `Could not ${enabled ? "populate" : "remove"} sample activity: ${error.message}`,
    );
  // Retire the separate simulator only after the saved-data operation succeeds.
  const { error: flagError } = await admin.auth.admin.updateUserById(owner, {
    app_metadata: { review_demo_enabled: false },
  });
  if (flagError)
    throw new Error("Sample activity saved, but could not disable the old simulator; retry");
  return data as { enabled: boolean; chats: number; questions: number };
}
