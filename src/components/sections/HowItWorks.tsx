import { useRef } from "react";

import { gsap, useGSAP } from "@/lib/gsap";

export function HowItWorks() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const pin = section.current;
    const cards = track.current;
    if (!pin || !cards) return;

    const media = gsap.matchMedia();
    media.add("(min-width: 769px) and (prefers-reduced-motion: no-preference)", () => {
      const travel = () => Math.max(0, cards.scrollWidth - pin.clientWidth);

      gsap.to(cards, {
        x: () => -travel(),
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => "+=" + travel(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    });

    return () => media.revert();
  }, { scope: section });

  return (
    <section ref={section} id="how" aria-label="How it works" className="scroll-mt-28 overflow-hidden bg-void py-16 min-[769px]:motion-safe:flex min-[769px]:motion-safe:min-h-svh min-[769px]:motion-safe:items-center">
      <div ref={track} data-lenis-prevent-horizontal className="flex w-full snap-x snap-mandatory gap-6 overflow-x-auto px-[clamp(1rem,5vw,5rem)] min-[769px]:motion-safe:overflow-visible">
        <article className="flex min-h-[26rem] w-[min(78vw,36rem)] shrink-0 snap-center flex-col items-start justify-center gap-5 rounded-2xl border border-ink/15 bg-panel p-[clamp(1.5rem,5vw,4rem)] min-[769px]:w-[58vw]">
          <span className="font-mono text-sm tracking-widest text-neon">01</span>
          <svg className="size-28 text-neon" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M48 106v-14L27 71q-6-7 0-12t13 1l9 8 10-19-9-8q-5-5-1-10t10-1l15 14"/>
            <path d="M76 43 69 20q-2-7 4-9t9 5l9 29-1-19q0-7 6-7t7 7l3 37q1 17-13 29v14M49 68l9-9q6-6 11-2t1 11l-8 10"/>
            <path d="m51 49-7 2m12-1 1 5"/>
          </svg>
          <h2 className="text-5xl font-bold tracking-tight">Pinch</h2>
          <p className="max-w-sm text-lg text-dim">Pinch your thumb and index finger together to draw.</p>
        </article>
        <article className="flex min-h-[26rem] w-[min(78vw,36rem)] shrink-0 snap-center flex-col items-start justify-center gap-5 rounded-2xl border border-ink/15 bg-panel p-[clamp(1.5rem,5vw,4rem)] min-[769px]:w-[58vw]">
          <span className="font-mono text-sm tracking-widest text-neon">02</span>
          <svg className="size-28 text-neon" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M47 106V93L25 72q-6-6-1-11t11 0l11 9V29q0-7 6-7t6 7v25-38q0-7 6-7t6 7v38-34q0-7 6-7t6 7v36-24q0-7 6-7t6 7v42q0 12-9 19v13"/>
            <path d="M47 70q15-3 21 12"/>
          </svg>
          <h2 className="text-5xl font-bold tracking-tight">Hover</h2>
          <p className="max-w-sm text-lg text-dim">Open your hand to move the cursor. Hold it over a tool to select it.</p>
        </article>
        <article className="flex min-h-[26rem] w-[min(78vw,36rem)] shrink-0 snap-center flex-col items-start justify-center gap-5 rounded-2xl border border-ink/15 bg-panel p-[clamp(1.5rem,5vw,4rem)] min-[769px]:w-[58vw]">
          <span className="font-mono text-sm tracking-widest text-neon">03</span>
          <svg className="size-28 text-neon" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M47 106V93L26 73q-6-6-1-11t11 0l11 9 10-12-10-30q-2-7 4-9t8 5l10 29"/>
            <path d="m69 54-2-10q-1-6 5-8t8 5l5 16 2-27q1-7 7-6t6 8l-2 34q-1 16-12 27v13M47 71l13-13q5-5 10-1t1 10l-9 11"/>
            <path d="m61 50 4 2m-7 1 2 5"/>
          </svg>
          <h2 className="text-5xl font-bold tracking-tight">Erase</h2>
          <p className="max-w-sm text-lg text-dim">Pinch your thumb and middle finger together to erase.</p>
        </article>
      </div>
    </section>
  );
}
