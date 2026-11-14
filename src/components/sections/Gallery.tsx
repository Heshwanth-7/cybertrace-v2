import { Trash2 } from "lucide-react";
import { useRef } from "react";

import { gsap, useGSAP } from "@/lib/gsap";
import type { Trace } from "@/lib/storage";
import { useTracesStore } from "@/store/traces";

function TraceCard({ trace }: { trace: Trace }) {
  const card = useRef<HTMLElement>(null);
  const date = new Date(trace.createdAt).toLocaleString();

  useGSAP(() => {
    const element = card.current;
    if (!element) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(element, {
        opacity: 0,
        y: 24,
        duration: 0.65,
        ease: "power2.out",
        scrollTrigger: { trigger: element, start: "top 90%", once: true },
      });
    });

    return () => media.revert();
  }, { scope: card });

  return (
    <article ref={card} className="group relative overflow-hidden rounded-2xl border border-ink/15 bg-panel">
      <button
        type="button"
        aria-label={"Load trace from " + date}
        onClick={() => useTracesStore.getState().load(trace.id)}
        className="block w-full cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neon"
      >
        <img src={trace.thumb} alt="" width={320} height={180} className="aspect-video w-full object-cover" />
      </button>
      <button
        type="button"
        aria-label={"Delete trace from " + date}
        onClick={() => useTracesStore.getState().remove(trace.id)}
        className="absolute top-2 right-2 grid size-11 cursor-pointer place-items-center rounded-full border border-ink/20 bg-panel/90 text-ink transition-opacity hover:text-hot focus-visible:outline-neon pointer-fine:pointer-events-none pointer-fine:opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </article>
  );
}

export function Gallery() {
  const traces = useTracesStore((state) => state.traces);

  return (
    <section id="gallery" aria-labelledby="gallery-title" className="mx-auto w-[min(92vw,1400px)] scroll-mt-28 py-16">
      <h2 id="gallery-title" className="mb-6 text-4xl font-bold tracking-tight">Your traces</h2>
      {traces.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {traces.map((trace) => <TraceCard key={trace.id} trace={trace} />)}
        </div>
      ) : (
        <p className="font-mono text-sm text-dim">Nothing saved yet.</p>
      )}
    </section>
  );
}
