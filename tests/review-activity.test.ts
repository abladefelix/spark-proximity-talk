import { expect, test } from "bun:test";
import { populateReviewActivity } from "../src/lib/review-activity.server";

function fixture({ collision = false, failRpc = false } = {}) {
  const created: any[] = [];
  const updates: any[] = [];
  const calls: any[] = [];
  const profiles = new Map<string, string>();
  const users = new Map<string, any>();
  if (collision) {
    profiles.set("sample_alex_3a05b0", "real-user");
    users.set("real-user", { app_metadata: {} });
  }
  const admin: any = {
    from: () => {
      let username = "";
      const chain: any = {
        select: () => chain,
        eq: (_: string, value: string) => {
          username = value;
          return chain;
        },
        maybeSingle: async () => ({
          data: profiles.has(username) ? { id: profiles.get(username) } : null,
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
      return chain;
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: users.get(id) } }),
        createUser: async (attrs: any) => {
          created.push(attrs);
          const id = `peer-${created.length}`;
          profiles.set(attrs.user_metadata.username, id);
          users.set(id, attrs);
          return { data: { user: { id } } };
        },
        updateUserById: async (...args: any[]) => {
          updates.push(args);
          return {};
        },
      },
    },
    rpc: async (...args: any[]) => {
      calls.push(args);
      return failRpc
        ? { error: { message: "database unavailable" } }
        : { data: { enabled: args[1]._enabled, chats: 4, questions: 4 } };
    },
  };
  return { admin, created, updates, calls };
}
const owner = "3a05b02f-b5a0-4e1e-97a6-250d4344a2e8";
test("creates labelled non-login samples, then reuses protected identities", async () => {
  const f = fixture();
  await populateReviewActivity(f.admin, owner, true);
  await populateReviewActivity(f.admin, owner, true);
  expect(f.created).toHaveLength(4);
  expect(
    f.created.every(
      (x) =>
        x.ban_duration &&
        x.email.endsWith(".invalid") &&
        x.user_metadata.display_name.endsWith("(Sample)"),
    ),
  ).toBe(true);
  expect(f.calls[0][1]._peers).toHaveLength(4);
  expect(f.updates[0]).toEqual([owner, { app_metadata: { review_demo_enabled: false } }]);
});
test("never takes over an existing ordinary account", async () => {
  const f = fixture({ collision: true });
  await expect(populateReviewActivity(f.admin, owner, true)).rejects.toThrow("unmanaged account");
  expect(f.created).toHaveLength(0);
  expect(f.calls).toHaveLength(0);
});
test("database failure does not claim success or disable previous access", async () => {
  const f = fixture({ failRpc: true });
  await expect(populateReviewActivity(f.admin, owner, true)).rejects.toThrow(
    "database unavailable",
  );
  expect(f.updates).toHaveLength(0);
});
test("removal never creates new sample accounts", async () => {
  const f = fixture();
  await populateReviewActivity(f.admin, owner, false);
  expect(f.created).toHaveLength(0);
  expect(f.calls[0][1]._enabled).toBe(false);
});
