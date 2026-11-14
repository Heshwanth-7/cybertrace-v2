import type { Landmark } from "./types";

// Keep this version aligned with the installed @mediapipe/tasks-vision package.
const wasmBase = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface HandTracker {
  detect(video: HTMLVideoElement, timestampMs: number): Landmark[] | null;
  close(): void;
}

/** Creates a video hand landmarker, falling back to CPU if GPU setup fails. */
export async function createHandTracker(): Promise<HandTracker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(wasmBase);
  const create = (delegate: "GPU" | "CPU") => HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath, delegate },
    runningMode: "VIDEO",
    numHands: 1,
  });

  let landmarker: Awaited<ReturnType<typeof create>>;
  try {
    landmarker = await create("GPU");
  } catch {
    landmarker = await create("CPU");
  }

  return {
    detect: (video, timestampMs) => landmarker.detectForVideo(video, timestampMs).landmarks[0] ?? null,
    close: () => landmarker.close(),
  };
}
