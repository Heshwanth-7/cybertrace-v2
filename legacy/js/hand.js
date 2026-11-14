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

/** @typedef {{x: number, y: number}} Point */
/** @typedef {{drawing: boolean, erasing: boolean, enterCount: number, exitCount: number}} GestureState */

function distance(a, b, aspect) {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/**
 * Measures the wrist-to-middle-MCP distance in video-height units.
 * @param {Point[]} lm Normalized hand landmarks.
 * @param {number} aspect Video width divided by video height.
 * @returns {number}
 */
export function handScale(lm, aspect) {
  return distance(lm[0], lm[9], aspect);
}

/**
 * Measures the distance between two landmarks relative to the size of the hand.
 * @param {Point[]} lm Normalized hand landmarks.
 * @param {number} aspect Video width divided by video height.
 * @param {number} tipA First landmark index.
 * @param {number} tipB Second landmark index.
 * @returns {number} Infinity if the hand scale cannot be used.
 */
export function pinchRatio(lm, aspect, tipA, tipB) {
  const scale = handScale(lm, aspect);
  return scale > 0 && Number.isFinite(scale)
    ? distance(lm[tipA], lm[tipB], aspect) / scale
    : Infinity;
}

/**
 * Creates a gesture state with no active or pending gesture.
 * @returns {GestureState}
 */
export function createGestureState() {
  return { drawing: false, erasing: false, enterCount: 0, exitCount: 0 };
}

/**
 * Advances gesture detection by one frame without mutating the input state.
 * @param {GestureState} state State from the preceding frame.
 * @param {Point[]} lm Normalized hand landmarks.
 * @param {number} aspect Video width divided by video height.
 * @returns {GestureState}
 */
export function updateGesture(state, lm, aspect) {
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
 * @param {Point} lm Normalized landmark.
 * @param {number} videoW Intrinsic video width.
 * @param {number} videoH Intrinsic video height.
 * @param {number} boxW Display box width.
 * @param {number} boxH Display box height.
 * @returns {Point} Position in box pixels.
 */
export function toScreen(lm, videoW, videoH, boxW, boxH) {
  const scale = Math.max(boxW / videoW, boxH / videoH);
  const width = videoW * scale;
  const height = videoH * scale;
  const cropX = (width - boxW) / 2;
  const cropY = (height - boxH) / 2;
  const mirroredX = 1 - lm.x;

  return { x: mirroredX * width - cropX, y: lm.y * height - cropY };
}

/**
 * Creates an adaptive low-pass filter for one axis.
 * @param {number} [minCutoff=1.0] Minimum signal cutoff in Hz.
 * @param {number} [beta=0.02] Increase in signal cutoff per unit of filtered speed.
 * @param {number} [dCutoff=1.0] Derivative cutoff in Hz.
 * @returns {{filter: (value: number, timestampMs: number) => number, reset: () => void}}
 */
export function createOneEuro(minCutoff = 1.0, beta = 0.02, dCutoff = 1.0) {
  let lastTime;
  let signal;
  let derivative = 0;

  function alpha(cutoff, elapsed) {
    const rate = 2 * Math.PI * cutoff * elapsed;
    return rate / (1 + rate);
  }

  return {
    filter(value, timestampMs) {
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

    reset() {
      lastTime = undefined;
      signal = undefined;
      derivative = 0;
    },
  };
}
