import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { useEffect, useSyncExternalStore } from "react";

/**
 * The on-screen keyboard must never resize or shift the app shell. iOS scrolls
 * the whole web view up to reveal a focused field and Android can shrink the
 * window; both squash every fixed element on screen. We measure the keyboard
 * ourselves, expose it as `--keyboard-inset`, and undo any shift the platform
 * applied, so only the chat composer reacts to the keyboard.
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
          Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => undefined),
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
        values.slice(1).forEach((handle) => void handle?.remove());
      });
      setInset(0);
    };
  }, []);
}
