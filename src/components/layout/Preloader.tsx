import { useRef } from "react";

import { gsap, useGSAP } from "../../lib/gsap";
import { getLenis } from "../../lib/lenis";

interface PreloaderProps {
  onDone: () => void;
}

export function Preloader({ onDone }: PreloaderProps) {
  const scope = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const completed = useRef(false);

  useGSAP(() => {
    if (completed.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      completed.current = true;
      onDone();
      return;
    }

    const overlay = scope.current;
    const counter = count.current;
    const line = progress.current;
    if (!overlay || !counter || !line) return;

    const value = { percent: 0 };
    let pausedLenis: ReturnType<typeof getLenis> = null;

    const resumeScroll = () => {
      if (pausedLenis && pausedLenis === getLenis()) pausedLenis.start();
      pausedLenis = null;
    };

    counter.textContent = "0";
    gsap.set(line, { scaleX: 0 });
    gsap.timeline({
      onStart() {
        // The parent installs Lenis in its layout effect before the first tick.
        pausedLenis = getLenis();
        pausedLenis?.stop();
      },
      onComplete() {
        resumeScroll();
        completed.current = true;
        onDone();
      },
    })
      .to(value, {
        percent: 100,
        duration: 1.8,
        ease: "power2.inOut",
        onUpdate() {
          counter.textContent = String(Math.round(value.percent));
        },
      })
      .to(line, { scaleX: 1, duration: 1.8, ease: "power2.inOut" }, 0)
      .to(overlay, { yPercent: -100, duration: 1, ease: "expo.inOut" });

    return resumeScroll;
  }, { scope, dependencies: [onDone], revertOnUpdate: true });

  return (
    <div
      ref={scope}
      aria-hidden="true"
      className="fixed inset-0 z-50 grid place-content-center justify-items-center gap-5 bg-void text-ink motion-reduce:hidden"
    >
      <span ref={count} className="font-display text-[clamp(5rem,18vw,12rem)] leading-none font-bold tabular-nums">
        0
      </span>
      <div className="h-px w-40 bg-ink/20">
        <div ref={progress} className="h-full w-full origin-left bg-neon" />
      </div>
      <span className="font-mono text-xs tracking-[0.24em] text-neon">INITIALIZING</span>
    </div>
  );
}
