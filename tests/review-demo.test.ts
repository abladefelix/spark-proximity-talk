import { describe, expect, test } from "bun:test";
import { demoReducer, seedDemo } from "../src/lib/review-demo";
describe("isolated review demo", () => {
  test("seeds two chats and questions without location or expiry", () => {
    const state = seedDemo();
    expect(new Set(state.messages.map((m) => m.person)).size).toBe(2);
    expect(state.questions.length).toBe(2);
  });
  test("blocking prevents messages and signals", () => {
    const state = demoReducer(seedDemo(), { type: "block", person: "alex" });
    expect(demoReducer(state, { type: "send", person: "alex", text: "hello" })).toBe(state);
    expect(demoReducer(state, { type: "signal", person: "alex" })).toBe(state);
  });
  test("does not allow deleting someone else's sample question", () => {
    expect(demoReducer(seedDemo(), { type: "delete", id: 1 }).questions.length).toBe(2);
    expect(demoReducer(seedDemo(), { type: "delete", id: 2 }).questions.length).toBe(1);
  });
  test("limits messages, rejects unknown peers and invalid votes", () => {
    let state = seedDemo();
    expect(demoReducer(state, { type: "send", person: "real-user", text: "hi" })).toBe(state);
    for (let i = 0; i < 50; i++)
      state = demoReducer(state, { type: "send", person: "alex", text: "a".repeat(600) });
    expect(state.messages.length).toBe(40);
    expect(state.messages[0].text.length).toBe(500);
    expect(demoReducer(state, { type: "vote", id: 1, option: 99 }).questions[0].vote).toBeNull();
  });
  test("reset returns independent clean fixtures", () => {
    const state = demoReducer(seedDemo(), { type: "question", text: "My sample?" });
    expect(state.questions.length).toBe(3);
    expect(seedDemo().questions.length).toBe(2);
  });
});
