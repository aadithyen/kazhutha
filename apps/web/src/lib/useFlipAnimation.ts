import { RefObject, useLayoutEffect, useRef } from "react";

/** FLIP layout animation for children marked with `data-flip-key`. */
export function useFlipAnimation(containerRef: RefObject<HTMLElement | null>, deps: unknown[]) {
  const prevPositions = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const nextPositions = new Map<string, DOMRect>();

    container.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((el) => {
      const key = el.dataset.flipKey;
      if (!key) return;

      const rect = el.getBoundingClientRect();
      nextPositions.set(key, rect);

      const prev = prevPositions.current.get(key);
      if (!prev) return;

      const dx = prev.left - rect.left;
      const dy = prev.top - rect.top;
      if (dx === 0 && dy === 0) return;

      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });

    prevPositions.current = nextPositions;
  }, deps);
}
