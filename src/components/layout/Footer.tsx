import { useRef } from "react";

import { gsap, useGSAP } from "../../lib/gsap";

export function Footer() {
  const mask = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const trigger = mask.current;
    const target = word.current;
    if (!trigger || !target) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(target, {
        yPercent: 100,
        duration: 1,
        ease: "expo.out",
        scrollTrigger: { trigger, start: "top 90%", once: true },
      });
    });

    return () => media.revert();
  }, { scope: mask });

  return (
    <footer className="border-t border-ink/10 px-[clamp(1rem,5vw,5rem)] pt-16 pb-8">
      <div ref={mask} className="mb-6 overflow-hidden">
        <div ref={word} aria-hidden="true" className="text-outline w-max font-display text-[clamp(2.5rem,14vw,28rem)] leading-[0.9] font-bold tracking-[-0.05em]">
          CYBERTRACE
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 text-sm">
          <a href="#how" className="py-2 underline-offset-4 hover:underline">How it works</a>
          <a href="#studio" className="py-2 underline-offset-4 hover:underline">Studio</a>
          <a href="#gallery" className="py-2 underline-offset-4 hover:underline">Gallery</a>
        </nav>
        <p className="font-mono text-sm text-dim">© {new Date().getFullYear()} CyberTrace</p>
      </div>
    </footer>
  );
}
