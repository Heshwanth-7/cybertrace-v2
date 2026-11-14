import { updateGesture, createGestureState, toScreen, createOneEuro } from './hand.js';

const studio = document.querySelector('#studio');
const frame = studio.querySelector('.studio-frame');
const startButton = document.querySelector('#start-cam');
const status = document.querySelector('#cam-status');
const video = document.querySelector('#cam');
const strokesCanvas = document.querySelector('#layer-strokes');
const liveCanvas = document.querySelector('#layer-live');
const strokesContext = strokesCanvas.getContext('2d');
const liveContext = liveCanvas.getContext('2d');
const fps = document.querySelector('#fps');
const mode = document.querySelector('#mode');
const handState = document.querySelector('#hand-state');

const store = { strokes: [], current: null, color: '#00f3ff', eraser: false };
const toolbar = frame.querySelector('.toolbar');
const swatches = [...toolbar.querySelectorAll('.swatch[data-color]')];
const eraserButton = toolbar.querySelector('#btn-eraser');
const undoStack = [];
const redoStack = [];
let dwell = null;
const smoothX = createOneEuro();
const smoothY = createOneEuro();
let gesture = createGestureState();
let fingertip = null;
let boxWidth = 0;
let boxHeight = 0;
let landmarker;
let stream;
let starting = false;
let cameraSession = 0;
let studioVisible = false;
let animationFrame = null;
let lastVideoTime = -1;
let sampleStart = 0;
let framesTracked = 0;

// Load the model on demand, falling back to CPU if GPU setup fails.
async function createLandmarker() {
  const { FilesetResolver, HandLandmarker } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10/vision_bundle.mjs'
  );
  const fileset = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10/wasm',
  );
  const options = {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  };

  try {
    return await HandLandmarker.createFromOptions(fileset, options);
  } catch {
    options.baseOptions.delegate = 'CPU';
    return HandLandmarker.createFromOptions(fileset, options);
  }
}

function cameraErrorMessage(error) {
  switch (error.name) {
    case 'NotAllowedError':
      return 'Camera access was denied. Allow it in your browser settings and try again.';
    case 'NotFoundError':
      return 'No camera was found. Connect a camera and try again.';
    case 'NotReadableError':
      return 'The camera is unavailable. Close any other app using it and try again.';
    default:
      return 'Could not start the camera or load hand tracking. Try again.';
  }
}

// Camera setup and cleanup.
startButton.addEventListener('click', async () => {
  if (starting || stream) return;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.textContent = 'Camera access is unavailable. Open this page over HTTPS or on localhost in a browser that supports webcam access.';
    return;
  }

  const session = ++cameraSession;
  starting = true;
  startButton.disabled = true;
  status.textContent = 'Requesting camera access…';

  try {
    const camera = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (session !== cameraSession) {
      camera.getTracks().forEach(track => track.stop());
      return;
    }

    stream = camera;
    status.textContent = 'Loading hand tracking…';
    const detector = await createLandmarker();
    if (session !== cameraSession) {
      detector.close();
      return;
    }

    landmarker = detector;
    video.srcObject = stream;
    await video.play();
    if (session !== cameraSession) return;

    frame.classList.add('is-live');
    startButton.style.display = 'none';
    status.textContent = '';
    syncLoop();
  } catch (error) {
    if (session !== cameraSession) return;
    stopCamera();
    status.textContent = cameraErrorMessage(error);
    startButton.textContent = 'Retry camera';
  } finally {
    if (session === cameraSession) {
      starting = false;
      startButton.disabled = false;
    }
  }
});

function stopCamera() {
  ++cameraSession;
  starting = false;
  pauseLoop();
  frame.classList.remove('is-live');
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
  video.pause();
  video.srcObject = null;
  landmarker?.close();
  landmarker = undefined;
  startButton.disabled = false;
  startButton.style.removeProperty('display');
  status.textContent = '';
}

window.addEventListener('pagehide', stopCamera);

// Size backing stores to the displayed frame and preserve the committed layer.
new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  if (!width || !height) return;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (width === boxWidth && height === boxHeight &&
      pixelWidth === liveCanvas.width && pixelHeight === liveCanvas.height) return;

  finishStroke();
  boxWidth = width;
  boxHeight = height;
  for (const context of [strokesContext, liveContext]) {
    context.canvas.width = pixelWidth;
    context.canvas.height = pixelHeight;
    context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  }
  redrawStrokes();
  resetHand();
  lastVideoTime = -1;
}).observe(frame);

// Suspend detection when the studio cannot be seen.
new IntersectionObserver(([entry]) => {
  studioVisible = entry.isIntersecting;
  syncLoop();
}).observe(studio);

document.addEventListener('visibilitychange', syncLoop);

function syncLoop() {
  if (!frame.classList.contains('is-live') || document.hidden || !studioVisible) {
    pauseLoop();
  } else if (animationFrame === null) {
    sampleStart = performance.now();
    animationFrame = requestAnimationFrame(render);
  }
}

function pauseLoop() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  lastVideoTime = -1;
  framesTracked = 0;
  fps.textContent = '0 FPS';
  resetHand();
  renderReticle();
}

function resetHand() {
  finishStroke();
  dwell = null;
  fingertip = null;
  gesture = createGestureState();
  smoothX.reset();
  smoothY.reset();
  handState.textContent = 'NO HAND';
  mode.textContent = 'HOVER';
}

// Track each new video frame and render the reticle on its own layer.
function render() {
  const now = performance.now();
  if (boxWidth && boxHeight && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth && video.videoHeight && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      const result = landmarker.detectForVideo(video, now);
      trackHand(result.landmarks[0], now);
      framesTracked++;
    } catch {
      stopCamera();
      status.textContent = 'Hand tracking stopped. Try restarting the camera.';
      startButton.textContent = 'Retry camera';
      return;
    }
  }

  if (now - sampleStart >= 1000) {
    fps.textContent = `${Math.round(framesTracked * 1000 / (now - sampleStart))} FPS`;
    sampleStart = now;
    framesTracked = 0;
  }

  renderReticle();
  animationFrame = requestAnimationFrame(render);
}

function trackHand(landmarks, now) {
  if (!landmarks) {
    resetHand();
    return;
  }

  const { videoWidth, videoHeight } = video;
  const { x, y } = toScreen(landmarks[8], videoWidth, videoHeight, boxWidth, boxHeight);
  fingertip = { x: smoothX.filter(x, now), y: smoothY.filter(y, now) };
  gesture = updateGesture(gesture, landmarks, videoWidth / videoHeight);
  handState.textContent = 'HAND LOCKED';
  updateDrawing(now);
}

function renderReticle() {
  liveContext.clearRect(0, 0, boxWidth, boxHeight);
  if (!fingertip) return;

  const { x, y } = fingertip;
  liveContext.strokeStyle = '#00f3ff';
  liveContext.fillStyle = '#00f3ff';
  liveContext.lineWidth = 2;
  liveContext.beginPath();
  liveContext.arc(x, y, store.current ? 7 : 13, 0, Math.PI * 2);
  liveContext.stroke();
  liveContext.beginPath();
  liveContext.arc(x, y, 2.5, 0, Math.PI * 2);
  liveContext.fill();

  if (dwell && !dwell.fired) {
    liveContext.beginPath();
    liveContext.arc(x, y, 19, -Math.PI / 2, -Math.PI / 2 + dwell.progress * Math.PI * 2);
    liveContext.stroke();
  }
}

// Stroke geometry is stored relative to the canvas and projected when painted.
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function paintStroke(context, stroke, width, height, index, finish = false) {
  const { points, color } = stroke;
  const point = points[index];
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowBlur = 15;
  context.shadowColor = color;
  context.beginPath();

  if (index === 0) {
    context.arc(point.x * width, point.y * height, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }

  const previous = points[index - 1];
  const start = finish
    ? midpoint(previous, point)
    : index === 1 ? previous : midpoint(points[index - 2], previous);
  context.moveTo(start.x * width, start.y * height);
  if (finish) {
    context.lineTo(point.x * width, point.y * height);
  } else {
    const end = midpoint(previous, point);
    context.quadraticCurveTo(previous.x * width, previous.y * height, end.x * width, end.y * height);
  }
  context.stroke();
}

function paintAll(context, strokes, width, height) {
  for (const stroke of strokes) {
    stroke.points.forEach((_, index) => paintStroke(context, stroke, width, height, index));
    if (stroke.points.length > 1) {
      paintStroke(context, stroke, width, height, stroke.points.length - 1, true);
    }
  }
}

function redrawStrokes() {
  strokesContext.clearRect(0, 0, boxWidth, boxHeight);
  paintAll(strokesContext, store.strokes, boxWidth, boxHeight);
}

function replaceStrokes(strokes) {
  undoStack.push(store.strokes);
  redoStack.length = 0;
  store.strokes = strokes;
}

function finishStroke() {
  const stroke = store.current;
  if (!stroke) return;

  if (stroke.points.length > 1) {
    paintStroke(strokesContext, stroke, boxWidth, boxHeight, stroke.points.length - 1, true);
  }
  replaceStrokes([...store.strokes, stroke]);
  store.current = null;
}

function updateDrawing(now) {
  const bounds = liveCanvas.getBoundingClientRect();
  const screenX = bounds.left + fingertip.x;
  const screenY = bounds.top + fingertip.y;
  const target = document.elementFromPoint(screenX, screenY);
  const overToolbar = toolbar.contains(target);
  const button = overToolbar ? target.closest('button:not(:disabled)') : null;
  const inside = fingertip.x >= 0 && fingertip.x <= boxWidth &&
    fingertip.y >= 0 && fingertip.y <= boxHeight;

  if (!inside || overToolbar || !gesture.drawing || gesture.erasing || store.eraser) {
    finishStroke();
  }

  updateDwell(gesture.drawing || gesture.erasing ? null : button, now);
  const erasing = gesture.erasing || (store.eraser && gesture.drawing);
  mode.textContent = overToolbar ? 'HOVER' : erasing || store.eraser ? 'ERASE' : gesture.drawing ? 'DRAW' : 'HOVER';
  if (!inside || overToolbar) return;

  if (erasing) {
    const remaining = store.strokes.filter(stroke => !stroke.points.some(point =>
      Math.hypot(point.x * boxWidth - fingertip.x, point.y * boxHeight - fingertip.y) <= 28,
    ));
    if (remaining.length !== store.strokes.length) {
      replaceStrokes(remaining);
      redrawStrokes();
    }
  } else if (gesture.drawing) {
    store.current ??= { color: store.color, width: 6, points: [] };
    const { points } = store.current;
    const last = points[points.length - 1];
    if (last && Math.hypot(last.x * boxWidth - fingertip.x, last.y * boxHeight - fingertip.y) < 2) return;

    points.push({ x: fingertip.x / boxWidth, y: fingertip.y / boxHeight });
    paintStroke(strokesContext, store.current, boxWidth, boxHeight, points.length - 1);
  }
}

function updateDwell(button, now) {
  if (!button) {
    dwell = null;
    return;
  }
  if (dwell?.button !== button) {
    dwell = { button, start: now, progress: 0, fired: false };
  }
  if (dwell.fired) return;
  dwell.progress = Math.min(1, (now - dwell.start) / 800);
  if (dwell.progress === 1) {
    dwell.fired = true;
    button.click();
  }
}

// Tool selection and edit history.
function updateTools() {
  for (const swatch of swatches) {
    const active = !store.eraser && swatch.dataset.color === store.color;
    swatch.classList.toggle('is-active', active);
    swatch.setAttribute('aria-pressed', String(active));
  }
  eraserButton.classList.toggle('is-active', store.eraser);
  eraserButton.setAttribute('aria-pressed', String(store.eraser));
}

for (const swatch of swatches) {
  swatch.addEventListener('click', () => {
    finishStroke();
    store.color = swatch.dataset.color;
    store.eraser = false;
    updateTools();
  });
}

eraserButton.addEventListener('click', () => {
  finishStroke();
  store.eraser = !store.eraser;
  updateTools();
});
updateTools();

function moveHistory(from, to) {
  finishStroke();
  if (!from.length) return;
  to.push(store.strokes);
  store.strokes = from.pop();
  redrawStrokes();
}

const undoButton = toolbar.querySelector('#btn-undo');
let redoButton = toolbar.querySelector('#btn-redo');
if (!redoButton) {
  redoButton = document.createElement('button');
  redoButton.type = 'button';
  redoButton.id = 'btn-redo';
  redoButton.textContent = 'Redo';
  undoButton.after(redoButton);
}
undoButton.addEventListener('click', () => moveHistory(undoStack, redoStack));
redoButton.addEventListener('click', () => moveHistory(redoStack, undoStack));
toolbar.querySelector('#btn-clear').addEventListener('click', () => {
  finishStroke();
  if (!store.strokes.length) return;
  replaceStrokes([]);
  redrawStrokes();
});

document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z' ||
      event.target.closest('input, textarea, select, [contenteditable]')) return;
  event.preventDefault();
  if (event.shiftKey) {
    moveHistory(redoStack, undoStack);
  } else {
    moveHistory(undoStack, redoStack);
  }
});

// Composite the mirrored camera and reverse the display's cover crop for the strokes.
function makeExport() {
  const canvas = document.createElement('canvas');
  const hasVideo = Boolean(video.videoWidth && video.videoHeight &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
  const width = canvas.width = hasVideo ? video.videoWidth : strokesCanvas.width;
  const height = canvas.height = hasVideo ? video.videoHeight : strokesCanvas.height;
  const context = canvas.getContext('2d');

  context.fillStyle = '#07080c';
  context.fillRect(0, 0, width, height);
  if (hasVideo) {
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    context.restore();
  }

  if (boxWidth && boxHeight) {
    const scale = Math.max(boxWidth / width, boxHeight / height);
    const offsetX = (width - boxWidth / scale) / 2;
    const offsetY = (height - boxHeight / scale) / 2;
    context.setTransform(1 / scale, 0, 0, 1 / scale, offsetX, offsetY);
    const strokes = store.current ? [...store.strokes, store.current] : store.strokes;
    paintAll(context, strokes, boxWidth, boxHeight);
  }

  return canvas;
}

toolbar.querySelector('#btn-export').addEventListener('click', () => {
  makeExport().toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CyberTrace_${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});

// Gallery storage and controls.
const galleryKey = 'cybertrace.traces';
const galleryGrid = document.querySelector('#gallery-grid');
const galleryEmpty = document.querySelector('#gallery-empty');
let traces = [];

try {
  const saved = JSON.parse(localStorage.getItem(galleryKey));
  if (Array.isArray(saved)) traces = saved.slice(0, 12);
} catch {
  // The gallery can still be used for this session.
}

function updateGallery(next) {
  try {
    localStorage.setItem(galleryKey, JSON.stringify(next));
    if (status.textContent === 'Gallery changes could only be saved for this session.') {
      status.textContent = '';
    }
  } catch {
    status.textContent = 'Gallery changes could only be saved for this session.';
  }
  traces = next;
  renderGallery();
}

function renderGallery() {
  galleryGrid.replaceChildren();
  galleryEmpty.hidden = traces.length > 0;

  for (const trace of traces) {
    const card = document.createElement('article');
    const load = document.createElement('button');
    const thumbnail = document.createElement('img');
    const remove = document.createElement('button');
    const date = new Date(trace.createdAt).toLocaleString();

    // Keep the thumbnail button visible independently of the delete-button hover style.
    load.type = 'button';
    load.setAttribute('aria-label', `Load trace from ${date}`);
    Object.assign(load.style, {
      inset: '0', width: '100%', height: '100%', opacity: '1',
      border: '0', borderRadius: '0', padding: '0',
    });
    thumbnail.src = trace.thumb;
    thumbnail.alt = '';
    load.append(thumbnail);
    load.addEventListener('click', () => {
      finishStroke();
      replaceStrokes(trace.strokes);
      redrawStrokes();
    });

    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete trace from ${date}`);
    remove.addEventListener('click', () => updateGallery(traces.filter(item => item.id !== trace.id)));
    card.append(load, remove);
    galleryGrid.append(card);
  }
}

document.querySelector('#btn-save').addEventListener('click', () => {
  finishStroke();
  const exported = makeExport();
  const thumbnail = document.createElement('canvas');
  thumbnail.width = 320;
  thumbnail.height = Math.max(1, Math.round(320 * exported.height / exported.width));
  thumbnail.getContext('2d').drawImage(exported, 0, 0, thumbnail.width, thumbnail.height);
  const trace = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    strokes: store.strokes,
    thumb: thumbnail.toDataURL('image/jpeg', 0.75),
  };
  updateGallery([trace, ...traces].slice(0, 12));
});

renderGallery();
