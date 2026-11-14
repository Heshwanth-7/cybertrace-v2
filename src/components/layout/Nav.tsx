import type { MouseEvent } from "react";

import { getLenis } from "../../lib/lenis";
import { MagneticButton } from "../ui/MagneticButton";

function scrollToSection(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 ||
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const lenis = getLenis();
  const hash = event.currentTarget.hash;
  if (!lenis || !document.getElementById(hash.slice(1))) return;

  event.preventDefault();
  if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  lenis.scrollTo(hash);
}

export function Nav({ ready }: { ready: boolean }) {
  return (
    <header
      inert={!ready}
      className={"fixed inset-x-0 top-0 z-40 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-[clamp(1rem,5vw,5rem)] py-3 text-ink mix-blend-difference transition-opacity duration-500 sm:py-5 " + (ready ? "opacity-100" : "opacity-0")}
    >
      <a href="#hero" onClick={scrollToSection} className="font-mono text-lg tracking-[0.12em]">
        CYBERTRACE
      </a>
      <nav aria-label="Main navigation" className="order-last flex w-full flex-wrap gap-x-5 text-sm sm:order-none sm:w-auto lg:gap-x-8">
        <a href="#how" onClick={scrollToSection} className="py-2 underline-offset-4 hover:underline">How it works</a>
        <a href="#studio" onClick={scrollToSection} className="py-2 underline-offset-4 hover:underline">Studio</a>
        <a href="#gallery" onClick={scrollToSection} className="py-2 underline-offset-4 hover:underline">Gallery</a>
      </nav>
      <MagneticButton asChild className="h-10 rounded-full border-neon bg-transparent px-4 text-neon hover:bg-neon hover:text-void sm:px-6">
        <a href="#studio" onClick={scrollToSection}>Launch Studio</a>
      </MagneticButton>
    </header>
  );
}
