import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { useEffect, useSyncExternalStore } from "react";

/**
 * The platform resizes the web view for the keyboard (Capacitor Keyboard
 * `resize: "native"`, Android `adjustResize`), which is exactly how native
 * apps behave: the app shell simply becomes shorter. This hook only reports
 * the keyboard state so surfaces such as the bottom navigation and the
 * composer's home-indicator padding can respond; it never moves the layout.
 */

let inset = 0;
const listeners = new Set<() => void>();

function setInset(next: number) {
  if (next === inset) return;
  inset = next;
  document.documentElement.style.setProperty("--keyboard-inset", `${next}px`);
  document.documentElement.toggleAttribute("data-keyboard-open", next > 0);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the on-screen keyboard covers part of the app. */
export function useKeyboardOpen() {
  return useSyncExternalStore(
    subscribe,
    () => inset > 0,
    () => false,
  );
}

/** Mount once, high in the tree. */
export function useKeyboardInsetProvider() {
  useEffect(() => {
    const vv = window.visualViewport;
    let frame = 0;
    let nativeKeyboard = false;

    const update = () => {
      if (!vv || nativeKeyboard) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setInset(overlap > 80 ? Math.round(overlap) : 0);
      });
    };

    const nativeListeners = Capacitor.isNativePlatform()
      ? Promise.all([
          Keyboard.addListener("keyboardWillShow", ({ keyboardHeight }) => {
            nativeKeyboard = true;
            setInset(Math.max(0, Math.round(keyboardHeight)));
          }),
          Keyboard.addListener("keyboardWillHide", () => {
            nativeKeyboard = true;
            setInset(0);
          }),
        ])
      : null;

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      void nativeListeners?.then((values) => {
        values.forEach((handle) => void handle?.remove());
      });
      setInset(0);
    };
  }, []);
}
