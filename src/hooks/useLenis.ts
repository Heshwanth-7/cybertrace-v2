import Lenis from "lenis";
import { useLayoutEffect } from "react";

import { gsap, ScrollTrigger } from "../lib/gsap";
import { getLenis, setLenis } from "../lib/lenis";

export function useLenis(): void {
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (time) => Math.min(1, 1.001 - Math.pow(2, -10 * time)),
      autoRaf: false,
    });

    const unsubscribe = lenis.on("scroll", ScrollTrigger.update);
    const tick = (seconds: number) => lenis.raf(seconds * 1000);

    setLenis(lenis);
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      unsubscribe();
      lenis.destroy();

      if (getLenis() === lenis) setLenis(null);
    };
  }, []);
}
