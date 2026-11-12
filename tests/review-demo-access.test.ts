import { beforeEach, expect, mock, test } from "bun:test";

let roles: string[] = [];
let roleError: Error | null = null;
let enabled = false;
let updates: unknown[] = [];
const roleQuery: any = {
  select: () => roleQuery,
  eq: () => roleQuery,
  then: (resolve: any) =>
    Promise.resolve({ data: roles.map((role) => ({ role })), error: roleError }).then(resolve),
};
const profileQuery: any = {
  select: () => profileQuery,
  eq: () => profileQuery,
  maybeSingle: async () => ({ data: { id: "review-user", username: "ogyamwilson" }, error: null }),
};
mock.module("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (x: unknown) => x;
    const chain: any = {
      inputValidator: (fn: any) => {
        validate = fn;
        return chain;
      },
      middleware: () => chain,
      handler:
        (fn: any) =>
        (input: any = {}) =>
          fn({
            data: validate(input.data),
            context: { userId: "caller", supabase: { from: () => roleQuery } },
          }),
    };
    return chain;
  },
}));
mock.module("../src/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
mock.module("../src/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => profileQuery,
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              app_metadata: { review_demo_enabled: enabled },
              user_metadata: { review_demo_enabled: true },
            },
          },
          error: null,
        }),
        updateUserById: async (...args: unknown[]) => {
          updates.push(args);
          return { error: null };
        },
      },
    },
  },
}));
const { getReviewDemoAccess, setReviewDemoAccess } =
  await import("../src/lib/review-demo.functions");
beforeEach(() => {
  roles = [];
  roleError = null;
  enabled = false;
  updates = [];
});
test("ordinary users cannot enable demo", async () => {
  await expect(
    setReviewDemoAccess({ data: { username: "ogyamwilson", enabled: true } }),
  ).rejects.toThrow("Admins only");
  expect(updates).toHaveLength(0);
});
test("role lookup errors fail closed", async () => {
  roles = ["admin"];
  roleError = new Error("database unavailable");
  await expect(
    setReviewDemoAccess({ data: { username: "ogyamwilson", enabled: true } }),
  ).rejects.toThrow("Admins only");
  expect(updates).toHaveLength(0);
});
test("an admin changes only the demo flag", async () => {
  roles = ["admin"];
  await setReviewDemoAccess({ data: { username: "ogyamwilson", enabled: false } });
  expect(updates).toEqual([["review-user", { app_metadata: { review_demo_enabled: false } }]]);
});
test("user-editable metadata cannot grant access and fresh disable is respected", async () => {
  expect((await getReviewDemoAccess()).enabled).toBe(false);
  enabled = true;
  expect((await getReviewDemoAccess()).enabled).toBe(true);
  enabled = false;
  expect((await getReviewDemoAccess()).enabled).toBe(false);
});
test("wildcard usernames and nonboolean flags are rejected", () => {
  expect(() => setReviewDemoAccess({ data: { username: "%", enabled: true } })).toThrow();
  expect(() =>
    setReviewDemoAccess({ data: { username: "ogyamwilson", enabled: "true" as any } }),
  ).toThrow();
});

const { setReviewActivity } = await import("../src/lib/review-activity.functions");
test("normal users cannot populate persistent activity", async () => {
  await expect(setReviewActivity({ data: { username: "ogyamwilson", enabled: true } })).rejects.toThrow("Admins only");
});
test("persistent activity is restricted to the explicitly requested account", () => {
  expect(() => setReviewActivity({ data: { username: "someone_else", enabled: true } })).toThrow("scoped to ogyamwilson");
});
