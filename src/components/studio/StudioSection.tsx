import { useCallback, useEffect, useRef, useState } from "react";

import { useDwellSelect } from "@/hooks/useDwellSelect";
import { useHandTracker, type HandFrame } from "@/hooks/useHandTracker";
import { exportPng } from "@/lib/draw/export";
import { drawStroke, redrawAll, strokeHitsPoint } from "@/lib/draw/renderer";
import { createGestureState, createOneEuro, cursorPoint, toScreen, updateGesture } from "@/lib/hand/hand";
import type { Point } from "@/lib/hand/types";
import { useStudioStore, type Stroke, type StrokePoint } from "@/store/studio";

import { MagneticButton } from "../ui/MagneticButton";
import { Toolbar } from "./Toolbar";

type Mode = "HOVERING" | "DRAWING" | "ERASING";
type ActiveStroke = Stroke & { points: StrokePoint[] };

/** Speed in px/ms at which the line is about 37% of the way from thick to thin. */
const SPEED_SCALE = 0.9;
const MIN_PRESSURE = 0.18;
/** Smoothing for speed and pressure, from 0 (frozen) to 1 (no smoothing). */
const SPEED_EASE = 0.3;
const PRESSURE_EASE = 0.25;
/** Largest believable move in one frame, as a fraction of the longer side. */
const MAX_JUMP = 0.3;
/** Points dropped at the end of a stroke, recorded while the fingers were opening. */
const RELEASE_TRIM = 2;
/** Strokes shorter than this are accidental taps and are discarded. */
const MIN_POINTS = 4;
const MIN_LENGTH_PX = 12;
const idleHud = { mode: "HOVERING" as Mode, hand: false };

function createDrawingSession() {
  return {
    width: 0,
    height: 0,
    strokes: null as CanvasRenderingContext2D | null,
    live: null as CanvasRenderingContext2D | null,
    current: null as ActiveStroke | null,
    gesture: createGestureState(),
    smoothX: createOneEuro(1.5, 0.03),
    smoothY: createOneEuro(1.5, 0.03),
    lastTime: 0,
    speed: 0,
    pressure: 1,
    neon: "",
    hot: "",
    hud: idleHud,
  };
}

type DrawingSession = ReturnType<typeof createDrawingSession>;

function finishStroke(session: DrawingSession) {
  const stroke = session.current;
  if (!stroke) return;

  session.current = null;
  if (stroke.points.length > RELEASE_TRIM + 3) stroke.points.length -= RELEASE_TRIM;
  session.speed = 0;
  session.pressure = 1;

  let length = 0;
  for (let index = 1; index < stroke.points.length; index++) {
    const a = stroke.points[index - 1]!;
    const b = stroke.points[index]!;
    length += Math.hypot((b.x - a.x) * session.width, (b.y - a.y) * session.height);
  }
  if (stroke.points.length < MIN_POINTS || length < MIN_LENGTH_PX) {
    session.live?.clearRect(0, 0, session.width, session.height);
    return;
  }
  useStudioStore.getState().addStroke(stroke);
  session.live?.clearRect(0, 0, session.width, session.height);
}

function resetHand(session: DrawingSession) {
  finishStroke(session);
  session.gesture = createGestureState();
  session.smoothX.reset();
  session.smoothY.reset();
  session.hud = idleHud;
  session.live?.clearRect(0, 0, session.width, session.height);
}

function renderFrame(
  session: DrawingSession,
  frame: HandFrame,
  select: (point: Point | null) => ReturnType<ReturnType<typeof useDwellSelect>>,
  frameElement: HTMLDivElement | null,
) {
  const { width, height, strokes, live } = session;
  if (!strokes || !live || !width || !height) return;

  const { landmarks, videoWidth, videoHeight, timestamp } = frame;
  const tip = landmarks?.[8];
  if (!landmarks || !tip) {
    select(null);
    resetHand(session);
    return;
  }

  const mapped = toScreen(cursorPoint(landmarks, videoWidth / videoHeight), videoWidth, videoHeight, width, height);
  const x = session.smoothX.filter(mapped.x, timestamp);
  const y = session.smoothY.filter(mapped.y, timestamp);
  session.gesture = updateGesture(session.gesture, landmarks, videoWidth / videoHeight);

  const { color, eraser } = useStudioStore.getState();
  const inside = x >= 0 && x <= width && y >= 0 && y <= height;
  const erasing = session.gesture.erasing || (eraser && session.gesture.drawing);
  const { overToolbar, selection } = select(inside ? { x, y } : null);
  const drawing = inside && !overToolbar && session.gesture.drawing && !erasing;
  if (!drawing) finishStroke(session);

  if (inside && !overToolbar && erasing) {
    useStudioStore.setState((state) => {
      const remaining = state.strokes.filter((stroke) => !strokeHitsPoint(stroke, x, y, 28, width, height));
      if (remaining.length === state.strokes.length) return state;

      return { strokes: remaining, undoStack: [...state.undoStack, state.strokes], redoStack: [] };
    });
  } else if (drawing) {
    const stroke = session.current ??= { id: crypto.randomUUID(), color, width: 6, points: [] };
    const last = stroke.points.at(-1);
    const moved = last ? Math.hypot(x - last.x * width, y - last.y * height) : 0;
    const elapsed = timestamp - session.lastTime;

    if (last && moved > MAX_JUMP * Math.max(width, height)) {
      // A tracking glitch, so end this stroke instead of drawing a long line.
      finishStroke(session);
    } else {
      if (last && elapsed > 0) {
        // Slow movement gives a thick line and fast movement a thin one.
        session.speed += SPEED_EASE * (moved / elapsed - session.speed);
        const target = MIN_PRESSURE + (1 - MIN_PRESSURE) * Math.exp(-session.speed / SPEED_SCALE);
        session.pressure += PRESSURE_EASE * (target - session.pressure);
      }
      if (!last || moved >= 2) {
        stroke.points.push({ x: x / width, y: y / height, p: session.pressure });
      }
    }
  }

  session.lastTime = timestamp;
  session.hud = { mode: erasing && !overToolbar ? "ERASING" : drawing ? "DRAWING" : "HOVERING", hand: true };
  live.clearRect(0, 0, width, height);
  if (session.current) drawStroke(live, session.current, width, height, false);
  live.strokeStyle = erasing && !overToolbar ? session.hot : session.neon;
  live.fillStyle = live.strokeStyle;
  live.lineWidth = 2;
  live.beginPath();
  live.arc(x, y, drawing ? 7 : 13, 0, Math.PI * 2);
  live.stroke();
  live.beginPath();
  live.arc(x, y, 2.5, 0, Math.PI * 2);
  live.fill();

  if (selection && frameElement) {
    const bounds = frameElement.getBoundingClientRect();
    const rect = selection.targetRect;
    const centerX = rect.left - bounds.left - frameElement.clientLeft + rect.width / 2;
    const centerY = rect.top - bounds.top - frameElement.clientTop + rect.height / 2;
    live.strokeStyle = session.neon;
    live.beginPath();
    live.arc(centerX, centerY, Math.min(rect.width, rect.height) / 2 - 3, -Math.PI / 2, selection.progress * Math.PI * 2 - Math.PI / 2);
    live.stroke();
  }
}

export function StudioSection() {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const select = useDwellSelect();
  const [exportError, setExportError] = useState<string | null>(null);
  const strokesCanvas = useRef<HTMLCanvasElement>(null);
  const liveCanvas = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<DrawingSession | null>(null);
  const session = sessionRef.current ??= createDrawingSession();
  const { status, fps, error, start } = useHandTracker(video, (sample) => {
    renderFrame(session, sample, (point) => select(point, frame.current, toolbar.current, sample.timestamp), frame.current);
  });
  const prepareTool = useCallback(() => finishStroke(session), [session]);

  async function download(strokesOnly: boolean) {
    const element = video.current;
    if (!element) return;

    setExportError(null);
    try {
      await exportPng(element, useStudioStore.getState().strokes, {
        strokesOnly,
        frameWidth: session.width,
        frameHeight: session.height,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export the drawing.");
    }
  }
  const hud = useRef<HTMLDivElement>(null);

  // The tracker publishes a fresh status/FPS sample at most once per second.
  useEffect(() => {
    if (status === "idle" || status === "error") resetHand(session);
    if (hud.current) {
      const { mode, hand } = session.hud;
      hud.current.textContent = fps + " FPS · " + mode + " · " + (hand ? "HAND LOCKED" : "NO HAND");
    }
  });

  useEffect(() => {
    const element = frame.current;
    const strokes = strokesCanvas.current?.getContext("2d");
    const live = liveCanvas.current?.getContext("2d");
    if (!element || !strokes || !live) return;

    session.strokes = strokes;
    session.live = live;
    const theme = getComputedStyle(element);
    session.neon = theme.getPropertyValue("--color-neon").trim();
    session.hot = getComputedStyle(live.canvas).color;

    function redraw() {
      if (!strokes) return;
      const { width, height } = session;
      redrawAll(strokes, useStudioStore.getState().strokes, width, height);
    }

    const unsubscribe = useStudioStore.subscribe((state, previous) => {
      if (state.strokes === previous.strokes) return;

      const added = state.strokes.at(-1);
      if (
        added &&
        state.strokes.length === previous.strokes.length + 1 &&
        previous.strokes.every((stroke, index) => stroke === state.strokes[index])
      ) {
        drawStroke(strokes, added, session.width, session.height, true);
      } else {
        redraw();
      }
    });

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;

      resetHand(session);
      session.width = width;
      session.height = height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      for (const context of [strokes, live]) {
        const canvas = context.canvas;
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      }
      redraw();
    });

    const onVisibilityChange = () => {
      if (document.hidden) {
        select(null, null, null, 0);
        resetHand(session);
      }
    };
    observer.observe(element);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      observer.disconnect();
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resetHand(session);
      session.strokes = null;
      session.live = null;
    };
  }, [select, session]);

  const cameraUnavailable = !navigator.mediaDevices?.getUserMedia;

  return (
    <section id="studio" aria-labelledby="studio-title" className="scroll-mt-28 py-16">
      <h2 id="studio-title" className="mx-auto mb-6 w-[min(92vw,1400px)] text-4xl font-bold tracking-tight">Studio</h2>
      <div ref={frame} className="frame relative isolate mx-auto grid aspect-video w-[min(92vw,1400px)] place-items-center overflow-hidden rounded-3xl border border-neon/25 bg-panel">
        <video ref={video} muted playsInline className="pointer-events-none absolute inset-0 size-full -scale-x-100 object-cover" />
        <canvas ref={strokesCanvas} id="strokes" className="pointer-events-none absolute inset-0 size-full" />
        <canvas ref={liveCanvas} id="live" aria-hidden="true" className="pointer-events-none absolute z-20 inset-0 size-full text-hot" />
        <div ref={hud} className="pointer-events-none absolute top-2 left-3 font-mono text-[0.65rem] text-neon drop-shadow-sm sm:top-4 sm:left-4 sm:text-xs" />
        {status === "running" && (
          <Toolbar toolbarRef={toolbar} onBeforeAction={prepareTool} onExport={(strokesOnly) => void download(strokesOnly)} />
        )}
        {status !== "running" && (
          <div className="relative grid justify-items-center gap-1 rounded-xl bg-panel/90 px-3 py-2 text-center sm:gap-2 sm:px-6 sm:py-4">
            <MagneticButton type="button" disabled={cameraUnavailable || status === "loading"} onClick={() => void start()}>
              {error ? "Retry camera" : "Enable camera"}
            </MagneticButton>
            <p role="status" className="max-w-xs font-mono text-xs text-neon">
              {cameraUnavailable
                ? "The camera needs HTTPS or localhost in a browser with camera support."
                : error ?? (status === "loading" ? "Starting camera and hand tracking…" : "Camera is off")}
            </p>
            <p className="text-xs text-dim">Video never leaves your device.</p>
          </div>
        )}
      </div>
      {exportError && <p role="alert" className="mx-auto mt-2 w-[min(92vw,1400px)] font-mono text-xs text-hot">{exportError}</p>}
    </section>
  );
}
