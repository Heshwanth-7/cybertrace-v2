import { useCallback, useEffect, useState } from "react";

import { ScrollTrigger } from "@/lib/gsap";

import { Cursor } from "./components/layout/Cursor";
import { Footer } from "./components/layout/Footer";
import { Grain } from "./components/layout/Grain";
import { Nav } from "./components/layout/Nav";
import { Preloader } from "./components/layout/Preloader";
import { Hero } from "./components/sections/Hero";
import { HowItWorks } from "./components/sections/HowItWorks";
import { Marquee } from "./components/sections/Marquee";
import { StudioSection } from "./components/studio/StudioSection";
import { useLenis } from "./hooks/useLenis";

function App() {
  const [ready, setReady] = useState(false);
  const finishLoading = useCallback(() => setReady(true), []);

  useLenis();

  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) ScrollTrigger.refresh();
    });

    return () => { active = false; };
  }, []);

  return (
    <>
      {!ready && <Preloader onDone={finishLoading} />}
      <Grain />
      {ready && <Cursor />}
      <Nav ready={ready} />
      <div inert={!ready}>
        <main>
          <Hero ready={ready} />
          <Marquee />
          <HowItWorks />
          <StudioSection />
          <section id="gallery" className="scroll-mt-28 px-[clamp(1rem,5vw,5rem)] py-12">
            <h2 className="text-2xl font-bold">Gallery</h2>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;
