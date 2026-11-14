import { useRef } from "react";

import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

const phrases = ["PINCH TO DRAW", "OPEN HAND TO HOVER", "NO HARDWARE", "RUNS IN YOUR BROWSER"];

export function Marquee() {
  const track = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const element = track.current;
    if (!element) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const loop = gsap.to(element, {
        xPercent: -50,
        duration: 25,
        repeat: -1,
        ease: "none",
        onReverseComplete() {
          loop.totalTime(loop.totalTime() + loop.duration() * 100);
        },
      });
      const boost = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });

      ScrollTrigger.create({
        onUpdate(trigger) {
          const velocity = trigger.getVelocity();
          if (!velocity) return;

          const direction = Math.sign(velocity);
          const speed = 1 + Math.min(Math.abs(velocity) / 800, 5);
          boost.pause().clear()
            .to(loop, { timeScale: direction * speed, duration: 0.15, ease: "power2.out" })
            .to(loop, { timeScale: direction, duration: 0.85, ease: "power2.out" })
            .play(0);
        },
      });
    });

    return () => media.revert();
  }, { scope: track });

  return (
    <section aria-label="Drawing basics" className="overflow-hidden border-y border-ink/15 py-5">
      <div ref={track} className="flex w-max motion-reduce:w-full">
        {[false, true].map((duplicate) => (
          <div key={String(duplicate)} aria-hidden={duplicate || undefined} className={`flex min-w-[100vw] shrink-0 justify-around gap-x-6 pr-6 pl-6 text-[clamp(1.5rem,4vw,4rem)] font-bold motion-reduce:min-w-0 motion-reduce:flex-wrap ${duplicate ? "motion-reduce:hidden" : ""}`}>
            {phrases.map((phrase, index) => (
              <span key={phrase} className="flex items-center gap-x-6 motion-safe:whitespace-nowrap">
                <span className={index % 2 === 1 ? "text-outline" : undefined}>{phrase}</span>
                <span>—</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
