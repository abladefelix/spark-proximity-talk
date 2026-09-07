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
    if (!vv) return;

    let frame = 0;
    const pin = () => {
      // Undo the platform's automatic scroll of the whole web view.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      const se = document.scrollingElement;
      if (se && se.scrollTop !== 0) se.scrollTop = 0;
    };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setInset(overlap > 80 ? Math.round(overlap) : 0);
        pin();
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("scroll", pin, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", pin);
      setInset(0);
    };
  }, []);
}
