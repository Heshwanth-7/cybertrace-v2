import { useCallback, useState } from "react";

import { Preloader } from "./components/layout/Preloader";
import { useLenis } from "./hooks/useLenis";

function App() {
  const [ready, setReady] = useState(false);
  const finishLoading = useCallback(() => setReady(true), []);

  useLenis();

  return (
    <>
      {!ready && <Preloader onDone={finishLoading} />}
      <main inert={!ready}>
        <h1 className="text-4xl font-bold">CyberTrace v2</h1>
      </main>
    </>
  );
}

export default App;
