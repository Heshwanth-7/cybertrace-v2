import { useRef } from "react";

import { gsap, useGSAP } from "@/lib/gsap";

export function Hero({ ready }: { ready: boolean }) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.set("[data-hero-line]", { yPercent: 110 });
      gsap.set("[data-hero-detail]", { opacity: 0 });
      if (!ready) return;

      gsap.timeline()
        .to("[data-hero-line]", { yPercent: 0, stagger: 0.12, duration: 1.3, ease: "expo.out" })
        .to("[data-hero-detail]", { opacity: 1, stagger: 0.08, duration: 0.5, ease: "power2.out" });
    }, scope.current ?? undefined);

    return () => media.revert();
  }, { scope, dependencies: [ready], revertOnUpdate: true });

  return (
    <section ref={scope} id="hero" aria-labelledby="hero-title" className="relative grid min-h-svh content-center gap-6 px-[clamp(1rem,5vw,5rem)] pt-28 pb-16">
      <h1 id="hero-title" className="font-display text-[clamp(4rem,16vw,15rem)] leading-[0.88] font-bold tracking-[-0.08em] uppercase">
        <span className="block overflow-hidden"><span data-hero-line className="block">DRAW</span></span>
        <span className="block overflow-hidden"><span data-hero-line className="block">IN THE</span></span>
        <span className="block overflow-hidden">
          <span data-hero-line className="block"><em className="font-serif font-normal text-neon lowercase">air.</em></span>
        </span>
      </h1>
      <p data-hero-detail className="max-w-md text-lg text-dim">Draw in the air with your hand using your webcam.</p>
      <noscript><p>Enable JavaScript to use your camera and draw in the studio.</p></noscript>
      <div data-hero-detail aria-hidden="true" className="absolute bottom-6 right-[clamp(1rem,5vw,5rem)] font-mono text-xs tracking-[0.24em] text-dim">SCROLL</div>
    </section>
  );
}
