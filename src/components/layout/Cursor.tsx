import { useRef, useSyncExternalStore } from "react";

import { gsap, useGSAP } from "../../lib/gsap";

const disabledQuery = "(hover: none), (prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(disabledQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function Cursor() {
  const enabled = useSyncExternalStore(
    subscribe,
    () => !window.matchMedia(disabledQuery).matches,
    () => false,
  );
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!enabled || !ring.current || !dot.current) return;

    const targets = [ring.current, dot.current];
    gsap.set(targets, { xPercent: -50, yPercent: -50, opacity: 0 });
    const movers = targets.map((target, index) => {
      const options = { duration: index === 0 ? 0.5 : 0.1, ease: "power3.out" };
      return {
        x: gsap.quickTo(target, "x", options),
        y: gsap.quickTo(target, "y", options),
      };
    });
    const grow = gsap.quickTo(ring.current, "scale", { duration: 0.2, ease: "power2.out" });
    let visible = false;

    function hide() {
      for (const target of targets) target.style.opacity = "0";
      visible = false;
    }

    function follow(event: PointerEvent) {
      if (event.pointerType === "touch") {
        hide();
        return;
      }

      const { clientX, clientY, target } = event;
      for (const mover of movers) {
        mover.x(clientX, visible ? undefined : clientX);
        mover.y(clientY, visible ? undefined : clientY);
      }
      grow(target instanceof Element && target.closest("a, button, [data-cursor]") ? 1.55 : 1);

      if (!visible) {
        for (const element of targets) element.style.opacity = "1";
        visible = true;
      }
    }

    window.addEventListener("pointermove", follow, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", follow);
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, { dependencies: [enabled], revertOnUpdate: true });

  if (!enabled) return null;

  return (
    <>
      <div ref={ring} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-[110] size-[36px] rounded-full border border-ink opacity-0 mix-blend-difference" />
      <div ref={dot} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-[110] size-[6px] rounded-full bg-ink opacity-0 mix-blend-difference" />
    </>
  );
}
