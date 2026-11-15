import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { createHandTracker } from "@/lib/hand/tracker";
import type { Landmark } from "@/lib/hand/types";

export interface HandFrame {
  landmarks: Landmark[] | null;
  videoWidth: number;
  videoHeight: number;
  timestamp: number;
}

interface TrackerState {
  status: "idle" | "loading" | "running" | "error";
  fps: number;
  error: string | null;
}

const idle: TrackerState = { status: "idle", fps: 0, error: null };

function cameraError(error: unknown): string {
  switch (error instanceof Error ? error.name : "") {
    case "NotAllowedError":
      return "Camera access was denied. Allow camera access in your browser and try again.";
    case "NotFoundError":
      return "No camera was found. Connect a camera and try again.";
    case "NotReadableError":
      return "The camera is unavailable. Close other apps using it and try again.";
    default:
      return "Hand tracking could not start or continue. Please try again.";
  }
}

/** Delivers frames outside React state. Keep per-frame changes in refs or the store. */
export function useHandTracker(
  videoRef: RefObject<HTMLVideoElement | null>,
  onFrame: (frame: HandFrame) => void,
) {
  const [state, setState] = useState<TrackerState>(idle);
  const callback = useRef(onFrame);
  const release = useRef<(() => void) | null>(null);
  const pendingState = useRef<TrackerState>(idle);
  const lastPublished = useRef(-Infinity);
  const publishTimer = useRef<number | null>(null);

  useLayoutEffect(() => {
    callback.current = onFrame;
  }, [onFrame]);

  const publish = useCallback((next: TrackerState) => {
    pendingState.current = next;
    if (publishTimer.current !== null) return;

    const flush = () => {
      publishTimer.current = null;
      lastPublished.current = performance.now();
      setState(pendingState.current);
    };
    const delay = 1000 - (performance.now() - lastPublished.current);
    if (delay > 0) publishTimer.current = window.setTimeout(flush, Math.ceil(delay));
    else flush();
  }, []);

  const stop = useCallback(() => {
    release.current?.();
    publish(idle);
  }, [publish]);

  useEffect(() => () => {
    release.current?.();
    if (publishTimer.current !== null) window.clearTimeout(publishTimer.current);
    publishTimer.current = null;
  }, []);

  const start = useCallback(async () => {
    if (release.current) return;

    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      publish({
        status: "error",
        fps: 0,
        error: video ? "Camera access requires HTTPS or localhost and a supported browser." : "The camera preview is unavailable. Please try again.",
      });
      return;
    }

    const useVideoFrames = typeof video.requestVideoFrameCallback === "function";
    let cancelled = false;
    let stream: MediaStream | null = null;
    let tracker: Awaited<ReturnType<typeof createHandTracker>> | null = null;
    let frameId: number | null = null;
    let lastVideoTime = -1;
    let sampleStart = performance.now();
    let frames = 0;

    const pause = () => {
      if (frameId !== null) {
        if (useVideoFrames) video.cancelVideoFrameCallback(frameId);
        else cancelAnimationFrame(frameId);
      }
      frameId = null;
    };

    const cleanup = () => {
      cancelled = true;
      release.current = null;
      pause();
      document.removeEventListener("visibilitychange", syncVisibility);
      if (stream && video.srcObject === stream) video.srcObject = null;
      stream?.getTracks().forEach((track) => track.stop());
      tracker?.close();
    };

    const fail = (error: unknown) => {
      cleanup();
      publish({ status: "error", fps: 0, error: cameraError(error) });
    };

    const render = (timestamp: number) => {
      frameId = null;
      if (cancelled || document.hidden || !tracker) return;

      const { currentTime, videoWidth, videoHeight } = video;
      try {
        if (video.readyState >= 2 && videoWidth && videoHeight && (useVideoFrames || currentTime !== lastVideoTime)) {
          lastVideoTime = currentTime;
          const landmarks = tracker.detect(video, timestamp);
          frames++;
          callback.current({ landmarks, videoWidth, videoHeight, timestamp });
        }
      } catch (error) {
        if (!cancelled) fail(error);
        return;
      }

      if (cancelled) return;
      const elapsed = timestamp - sampleStart;
      if (elapsed >= 1000) {
        publish({ status: "running", fps: Math.round(frames * 1000 / elapsed), error: null });
        sampleStart = timestamp;
        frames = 0;
      }
      if (!document.hidden) scheduleFrame();
    };

    const scheduleFrame = () => {
      frameId = useVideoFrames
        ? video.requestVideoFrameCallback(render)
        : requestAnimationFrame(() => render(performance.now()));
    };

    const syncVisibility = () => {
      pause();
      frames = 0;
      sampleStart = performance.now();
      if (document.hidden) {
        publish({ status: "running", fps: 0, error: null });
      } else {
        scheduleFrame();
      }
    };

    release.current = cleanup;
    publish({ status: "loading", fps: 0, error: null });

    try {
      const camera = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60, min: 30 },
        },
        audio: false,
      });
      if (cancelled) {
        camera.getTracks().forEach((track) => track.stop());
        return;
      }

      stream = camera;
      video.srcObject = camera;
      await video.play();
      if (cancelled) return;

      const detector = await createHandTracker();
      if (cancelled) {
        detector.close();
        return;
      }

      tracker = detector;
      publish({ status: "running", fps: 0, error: null });
      document.addEventListener("visibilitychange", syncVisibility);
      syncVisibility();
    } catch (error) {
      if (!cancelled) fail(error);
    }
  }, [publish, videoRef]);

  return { ...state, start, stop };
}
