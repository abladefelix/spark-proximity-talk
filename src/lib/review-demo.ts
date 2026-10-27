export const DEMO_PEOPLE = [
  {
    id: "alex",
    name: "Alex · Demo",
    bio: "Fictional member interested in coffee and photography.",
  },
  { id: "sam", name: "Sam · Demo", bio: "Fictional member who enjoys music and walking." },
] as const;
export type DemoState = {
  messages: { person: string; from: "me" | "sample"; text: string }[];
  questions: {
    id: number;
    author: "me" | "sample";
    text: string;
    answers: string[];
    vote: number | null;
  }[];
  blocked: string[];
  reports: string[];
  signals: string[];
};
export function seedDemo(): DemoState {
  return {
    messages: [
      {
        person: "alex",
        from: "sample",
        text: "Welcome! This is a fictional sample conversation for exploring SkanAround.",
      },
      { person: "alex", from: "me", text: "Thanks! Where can I find a quiet place for coffee?" },
      {
        person: "alex",
        from: "sample",
        text: "In this sample scenario, let's meet at the fictional Garden Café.",
      },
      {
        person: "sam",
        from: "sample",
        text: "Hi! What kind of music do you enjoy? This conversation uses demo data.",
      },
    ],
    questions: [
      {
        id: 1,
        author: "sample",
        text: "Demo question: which activity would you choose?",
        answers: ["Coffee", "A walk", "Live music"],
        vote: null,
      },
      {
        id: 2,
        author: "me",
        text: "My demo question: what's your favourite weekend plan?",
        answers: ["Outdoors", "Relaxing at home"],
        vote: null,
      },
    ],
    blocked: [],
    reports: [],
    signals: [],
  };
}
export type DemoAction =
  | { type: "send"; person: string; text: string }
  | { type: "block" | "signal"; person: string }
  | { type: "report"; target: string }
  | { type: "question"; text: string }
  | { type: "delete"; id: number }
  | { type: "vote"; id: number; option: number };
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if ("person" in action && !DEMO_PEOPLE.some((p) => p.id === action.person)) return state;
  switch (action.type) {
    case "send": {
      const text = action.text.trim().slice(0, 500);
      if (!text || state.blocked.includes(action.person)) return state;
      return {
        ...state,
        messages: [
          ...state.messages,
          { person: action.person, from: "me" as const, text },
          {
            person: action.person,
            from: "sample" as const,
            text: "Sample reply: message received. This is an automated demo response, not a real person.",
          },
        ].slice(-40),
      };
    }
    case "block":
      return { ...state, blocked: [...new Set([...state.blocked, action.person])] };
    case "signal":
      return state.blocked.includes(action.person)
        ? state
        : { ...state, signals: [...new Set([...state.signals, action.person])] };
    case "report":
      return {
        ...state,
        reports: [...new Set([...state.reports, action.target.slice(0, 80)])].slice(-30),
      };
    case "question": {
      const text = action.text.trim().slice(0, 200);
      if (!text || state.questions.length >= 12) return state;
      return {
        ...state,
        questions: [
          ...state.questions,
          {
            id: Math.max(2, ...state.questions.map((q) => q.id)) + 1,
            author: "me",
            text,
            answers: ["Yes", "No"],
            vote: null,
          },
        ],
      };
    }
    case "delete":
      return {
        ...state,
        questions: state.questions.filter((q) => q.id !== action.id || q.author !== "me"),
      };
    case "vote":
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id === action.id &&
          Number.isInteger(action.option) &&
          action.option >= 0 &&
          action.option < q.answers.length
            ? { ...q, vote: action.option }
            : q,
        ),
      };
  }
}
