import { useCallback, useEffect, useState } from "react";

import { ScrollTrigger } from "@/lib/gsap";

import { Cursor } from "./components/layout/Cursor";
import { Footer } from "./components/layout/Footer";
import { Grain } from "./components/layout/Grain";
import { Nav } from "./components/layout/Nav";
import { Preloader } from "./components/layout/Preloader";
import { Gallery } from "./components/sections/Gallery";
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
          <Gallery />
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;
