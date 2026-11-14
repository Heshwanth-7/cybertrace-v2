import type { Point } from "@/lib/hand/types";
import type { Stroke } from "@/store/studio";

export interface Trace {
  id: string;
  createdAt: string;
  strokes: readonly Stroke[];
  thumb: string;
}

const key = "cybertrace.traces";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNormalized(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

function isPoint(value: unknown): value is Point {
  return isRecord(value) && isNormalized(value.x) && isNormalized(value.y);
}

function parseTrace(value: unknown): Trace | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id ||
      typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.thumb !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.thumb) ||
      !Array.isArray(value.strokes)) return null;

  const strokes: Stroke[] = [];
  for (const stroke of value.strokes as unknown[]) {
    if (!isRecord(stroke) || (stroke.id !== undefined && (typeof stroke.id !== "string" || !stroke.id)) ||
        typeof stroke.color !== "string" || !stroke.color ||
        typeof stroke.width !== "number" || !Number.isFinite(stroke.width) || stroke.width <= 0 ||
        !Array.isArray(stroke.points) || !stroke.points.every(isPoint)) return null;

    // Legacy traces stored strokes without IDs.
    strokes.push({
      id: stroke.id ?? value.id + "-" + strokes.length,
      color: stroke.color,
      width: stroke.width,
      points: stroke.points,
    });
  }

  return { id: value.id, createdAt: value.createdAt, thumb: value.thumb, strokes };
}

export function limitTraces(traces: readonly Trace[]): Trace[] {
  return [...traces].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 12);
}

export function loadTraces(): Trace[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(saved)) return [];

    const traces: Trace[] = [];
    const seen = new Set<string>();
    for (const value of saved as unknown[]) {
      const trace = parseTrace(value);
      if (!trace || seen.has(trace.id)) continue;
      traces.push(trace);
      seen.add(trace.id);
    }

    return limitTraces(traces);
  } catch {
    return [];
  }
}

export function saveTraces(traces: readonly Trace[]): void {
  try {
    if (traces.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(limitTraces(traces)));
  } catch {
    // Traces remain available in the store for this session.
  }
}
