/** Loads Paystack's inline checkout script and opens it as an in-app popup. */

const SCRIPT_SRC = "https://js.paystack.co/v2/inline.js";

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if ((window as any).PaystackPop) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const el = existing ?? document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => {
      loading = null;
      reject(new Error("Could not load the payment window."));
    });
    if (!existing) document.body.appendChild(el);
  });
  return loading;
}

export type PopupOutcome = "success" | "cancelled";

/** Opens the Paystack popup for an initialized transaction access code. */
export async function openPaystackPopup(accessCode: string): Promise<PopupOutcome> {
  await loadScript();
  const Pop = (window as any).PaystackPop;
  if (!Pop) throw new Error("Payment window unavailable.");
  const instance = new Pop();
  return await new Promise<PopupOutcome>((resolve, reject) => {
    try {
      instance.resumeTransaction(accessCode, {
        onSuccess: () => resolve("success"),
        onCancel: () => resolve("cancelled"),
        onLoad: () => {},
        onError: (err: any) =>
          reject(new Error(err?.message ?? "The payment window failed to open.")),
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error("The payment window failed to open."));
    }
  });
}
