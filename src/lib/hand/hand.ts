import type { GestureState, Point } from "./types";

/** Draw entry threshold, expressed as a fraction of hand scale. */
export const PINCH_ENTER = 0.28;
/** Draw release threshold, expressed as a fraction of hand scale. */
export const PINCH_EXIT = 0.40;
/** Erase entry threshold, expressed as a fraction of hand scale. */
export const ERASE_ENTER = 0.30;
/** Erase release threshold, expressed as a fraction of hand scale. */
export const ERASE_EXIT = 0.42;
/** Consecutive frames required to enter or exit a gesture. */
export const DEBOUNCE_FRAMES = 2;

/** Measures the planar distance in video-height units. */
function distance(a: Point, b: Point, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/**
 * Measures the wrist-to-middle-MCP distance in video-height units.
 * @param lm Normalized hand landmarks.
 * @param aspect Video width divided by video height.
 */
export function handScale(lm: readonly Point[], aspect: number): number {
  return distance(lm[0]!, lm[9]!, aspect);
}

/**
 * Measures the distance between two landmarks relative to the size of the hand.
 * @param lm Normalized hand landmarks.
 * @param aspect Video width divided by video height.
 * @param tipA First landmark index.
 * @param tipB Second landmark index.
 * @returns Infinity if the hand scale cannot be used.
 */
export function pinchRatio(lm: readonly Point[], aspect: number, tipA: number, tipB: number): number {
  const scale = handScale(lm, aspect);
  return scale > 0 && Number.isFinite(scale)
    ? distance(lm[tipA]!, lm[tipB]!, aspect) / scale
    : Infinity;
}

/**
 * Creates a gesture state with no active or pending gesture.
 */
export function createGestureState(): GestureState {
  return { drawing: false, erasing: false, enterCount: 0, exitCount: 0 };
}

/**
 * Advances gesture detection by one frame without mutating the input state.
 * @param state State from the preceding frame.
 * @param lm Normalized hand landmarks.
 * @param aspect Video width divided by video height.
 */
export function updateGesture(state: GestureState, lm: readonly Point[], aspect: number): GestureState {
  const drawRatio = pinchRatio(lm, aspect, 4, 8);
  const eraseRatio = pinchRatio(lm, aspect, 4, 12);

  if (state.drawing || state.erasing) {
    const released = state.drawing ? drawRatio >= PINCH_EXIT : eraseRatio >= ERASE_EXIT;
    const exitCount = released ? state.exitCount + 1 : 0;
    return exitCount >= DEBOUNCE_FRAMES
      ? createGestureState()
      : { ...state, enterCount: 0, exitCount };
  }

  // The sign identifies the pending gesture so switching fingers restarts the count.
  let candidate = 0;
  if (eraseRatio <= ERASE_ENTER && eraseRatio < drawRatio) {
    candidate = -1;
  } else if (drawRatio <= PINCH_ENTER) {
    candidate = 1;
  }

  const enterCount = Math.sign(state.enterCount) === candidate
    ? state.enterCount + candidate
    : candidate;

  if (Math.abs(enterCount) < DEBOUNCE_FRAMES) {
    return { ...createGestureState(), enterCount };
  }

  return { drawing: candidate === 1, erasing: candidate === -1, enterCount: 0, exitCount: 0 };
}

/**
 * Mirrors a normalized landmark and maps it through a centered cover crop.
 * @param lm Normalized landmark.
 * @param videoW Intrinsic video width.
 * @param videoH Intrinsic video height.
 * @param boxW Display box width.
 * @param boxH Display box height.
 * @returns Position in box pixels.
 */
export function toScreen(lm: Point, videoW: number, videoH: number, boxW: number, boxH: number): Point {
  const scale = Math.max(boxW / videoW, boxH / videoH);
  const width = videoW * scale;
  const height = videoH * scale;
  const cropX = (width - boxW) / 2;
  const cropY = (height - boxH) / 2;
  const mirroredX = 1 - lm.x;

  return { x: mirroredX * width - cropX, y: lm.y * height - cropY };
}

/**
 * Returns the midpoint between the thumb and index tips.
 * It moves far less than the index tip while the fingers close or open,
 * which removes the hooks at the start and end of strokes.
 */
export function pinchPoint(lm: readonly Point[]): Point {
  const thumb = lm[4]!;
  const index = lm[8]!;
  return { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 };
}

/**
 * Stretches the central part of the screen position to the whole drawing area,
 * so the edges can be reached without leaving the camera view.
 * @param point Position in box pixels.
 * @param boxW Display box width.
 * @param boxH Display box height.
 * @param reach Fraction of the box that maps to the full area, from 0 to 1.
 */
export function expandReach(point: Point, boxW: number, boxH: number, reach: number): Point {
  const stretch = (value: number, size: number) =>
    Math.min(size, Math.max(0, size / 2 + (value - size / 2) / reach));
  return { x: stretch(point.x, boxW), y: stretch(point.y, boxH) };
}

/**
 * Creates an adaptive low-pass filter for one axis.
 * @param [minCutoff=1.0] Minimum signal cutoff in Hz.
 * @param [beta=0.02] Increase in signal cutoff per unit of filtered speed.
 * @param [dCutoff=1.0] Derivative cutoff in Hz.
 */
export function createOneEuro(minCutoff = 1.0, beta = 0.02, dCutoff = 1.0) {
  let lastTime: number | undefined;
  let signal = 0;
  let derivative = 0;

  /** Converts a cutoff and elapsed time to a smoothing coefficient. */
  function alpha(cutoff: number, elapsed: number): number {
    const rate = 2 * Math.PI * cutoff * elapsed;
    return rate / (1 + rate);
  }

  return {
    /** Filters a sample taken at the given timestamp in milliseconds. */
    filter(value: number, timestampMs: number): number {
      if (lastTime === undefined) {
        lastTime = timestampMs;
        signal = value;
        return signal;
      }

      const elapsed = (timestampMs - lastTime) / 1000;
      if (elapsed <= 0) return signal;

      const velocity = (value - signal) / elapsed;
      derivative += alpha(dCutoff, elapsed) * (velocity - derivative);
      const cutoff = minCutoff + beta * Math.abs(derivative);
      signal += alpha(cutoff, elapsed) * (value - signal);
      lastTime = timestampMs;
      return signal;
    },

    /** Clears the filter history for the next sample. */
    reset(): void {
      lastTime = undefined;
      signal = 0;
      derivative = 0;
    },
  };
}
