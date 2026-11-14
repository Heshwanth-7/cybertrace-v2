import { useRef, type ComponentProps } from "react";

import { gsap, useGSAP } from "../../lib/gsap";
import { Button } from "./button";

export function MagneticButton(props: ComponentProps<typeof Button>) {
  const area = useRef<HTMLSpanElement>(null);
  const mover = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const hitArea = area.current;
    const target = mover.current;
    if (!hitArea || !target) return;

    const media = gsap.matchMedia();
    media.add("(hover: hover) and (pointer: fine) and (min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const moveX = gsap.quickTo(target, "x", { duration: 0.3, ease: "power2.out" });
      const moveY = gsap.quickTo(target, "y", { duration: 0.3, ease: "power2.out" });
      const reset = gsap.to(target, {
        x: 0,
        y: 0,
        duration: 0.8,
        ease: "elastic.out(1, 0.4)",
        paused: true,
      });

      const follow = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;

        reset.pause();
        const bounds = hitArea.getBoundingClientRect();
        moveX((event.clientX - bounds.left - bounds.width / 2) * 0.25);
        moveY((event.clientY - bounds.top - bounds.height / 2) * 0.25);
      };

      const leave = () => {
        moveX.tween.pause();
        moveY.tween.pause();
        reset.invalidate().restart();
      };

      hitArea.addEventListener("pointermove", follow);
      hitArea.addEventListener("pointerleave", leave);

      return () => {
        hitArea.removeEventListener("pointermove", follow);
        hitArea.removeEventListener("pointerleave", leave);
      };
    });

    return () => media.revert();
  }, { scope: area });

  return (
    <span ref={area} className="inline-flex">
      <span ref={mover} className="inline-flex">
        <Button {...props} />
      </span>
    </span>
  );
}
