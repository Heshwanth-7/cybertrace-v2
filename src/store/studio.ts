import { create } from "zustand";

import type { Point } from "../lib/hand/types";

export interface Stroke {
  id: string;
  color: string;
  width: number;
  /** Points normalized to the drawing area's width and height. */
  points: readonly Point[];
}

interface StudioState {
  strokes: readonly Stroke[];
  color: string;
  eraser: boolean;
  undoStack: readonly (readonly Stroke[])[];
  redoStack: readonly (readonly Stroke[])[];
  addStroke: (stroke: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setColor: (color: string) => void;
  toggleEraser: () => void;
}

export const useStudioStore = create<StudioState>()((set) => ({
  strokes: [],
  color: "#00f3ff",
  eraser: false,
  undoStack: [],
  redoStack: [],

  addStroke: (stroke) => {
    const points = stroke.points.map(({ x, y }) => ({
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    }));

    set((state) => ({
      strokes: [...state.strokes, { ...stroke, points }],
      undoStack: [...state.undoStack, state.strokes],
      redoStack: [],
    }));
  },

  undo: () => set((state) => {
    const strokes = state.undoStack.at(-1);
    if (!strokes) return state;

    return {
      strokes,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, state.strokes],
    };
  }),

  redo: () => set((state) => {
    const strokes = state.redoStack.at(-1);
    if (!strokes) return state;

    return {
      strokes,
      undoStack: [...state.undoStack, state.strokes],
      redoStack: state.redoStack.slice(0, -1),
    };
  }),

  clear: () => set((state) => {
    if (state.strokes.length === 0) return state;

    return {
      strokes: [],
      undoStack: [...state.undoStack, state.strokes],
      redoStack: [],
    };
  }),

  setColor: (color) => set({ color, eraser: false }),
  toggleEraser: () => set((state) => ({ eraser: !state.eraser })),
}));
