import { create } from "zustand";

import { getLenis } from "@/lib/lenis";
import { limitTraces, loadTraces, saveTraces, type Trace } from "@/lib/storage";

import { useStudioStore, type Stroke } from "./studio";

interface TracesState {
  traces: readonly Trace[];
  saveCurrent: (strokes: readonly Stroke[], thumb: string) => void;
  remove: (id: string) => void;
  load: (id: string) => void;
}

export const useTracesStore = create<TracesState>()((set, get) => ({
  traces: loadTraces(),

  saveCurrent: (strokes, thumb) => {
    const trace: Trace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      strokes,
      thumb,
    };
    const traces = limitTraces([trace, ...get().traces]);
    saveTraces(traces);
    set({ traces });
  },

  remove: (id) => {
    const previous = get().traces;
    const traces = previous.filter((trace) => trace.id !== id);
    if (traces.length === previous.length) return;
    saveTraces(traces);
    set({ traces });
  },

  load: (id) => {
    const trace = get().traces.find((entry) => entry.id === id);
    if (!trace) return;

    useStudioStore.setState((state) => ({
      strokes: trace.strokes,
      undoStack: [...state.undoStack, state.strokes],
      redoStack: [],
    }));

    const lenis = getLenis();
    if (lenis) lenis.scrollTo("#studio");
    else document.getElementById("studio")?.scrollIntoView();
  },
}));
