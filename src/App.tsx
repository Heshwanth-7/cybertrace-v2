import { useCallback, useState } from "react";

import { Cursor } from "./components/layout/Cursor";
import { Footer } from "./components/layout/Footer";
import { Grain } from "./components/layout/Grain";
import { Nav } from "./components/layout/Nav";
import { Preloader } from "./components/layout/Preloader";
import { useLenis } from "./hooks/useLenis";

function App() {
  const [ready, setReady] = useState(false);
  const finishLoading = useCallback(() => setReady(true), []);

  useLenis();

  return (
    <>
      {!ready && <Preloader onDone={finishLoading} />}
      <Grain />
      {ready && <Cursor />}
      <Nav ready={ready} />
      <div inert={!ready}>
        <main className="px-[clamp(1rem,5vw,5rem)]">
          <section id="hero" className="grid min-h-svh content-center">
            <h1 className="text-4xl font-bold">CyberTrace v2</h1>
          </section>
          <section id="how" className="scroll-mt-28 py-12">
            <h2 className="text-2xl font-bold">How it works</h2>
          </section>
          <section id="studio" className="scroll-mt-28 py-12">
            <h2 className="text-2xl font-bold">Studio</h2>
          </section>
          <section id="gallery" className="scroll-mt-28 py-12">
            <h2 className="text-2xl font-bold">Gallery</h2>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;
