import { getStroke } from "perfect-freehand";

import type { Stroke } from "../../store/studio";

/** Glow radius in pixels around finished strokes. 0 turns the glow off. */
const GLOW_BLUR = 0;

/** Line width in pixels. Every stroke uses it, whatever the drawing speed. */
const STROKE_SIZE = 8;

function outlinePath(stroke: Stroke, w: number, h: number, isFinished: boolean): Path2D | null {
  const points = stroke.points.map(({ x, y }) => [x * w, y * h]);
  const outline = getStroke(points, {
    size: STROKE_SIZE,
    thinning: 0,
    smoothing: 0.6,
    streamline: 0.35,
    simulatePressure: false,
    start: { taper: 0 },
    end: { taper: 0 },
    last: isFinished,
  });
  const first = outline[0];
  const last = outline.at(-1);
  if (!first || !last) return null;

  const path = new Path2D();
  path.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  for (let index = 0; index < outline.length; index++) {
    const [x, y] = outline[index];
    const [nextX, nextY] = outline[index + 1] ?? first;
    path.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
  }
  path.closePath();
  return path;
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number,
  isFinished: boolean,
): void {
  const body = outlinePath(stroke, w, h, isFinished);
  if (!body) return;

  ctx.save();
  ctx.fillStyle = stroke.color;
  if (isFinished && GLOW_BLUR > 0) {
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = GLOW_BLUR;
  }
  ctx.fill(body);
  ctx.restore();
}

/** Clears the canvas and replays the committed strokes at the current size. */
export function redrawAll(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  for (const stroke of strokes) {
    drawStroke(ctx, stroke, w, h, true);
  }
}

/** Tests the distance to the sampled stroke, including between successive points. */
export function strokeHitsPoint(stroke: Stroke, x: number, y: number, radiusPx: number, w: number, h: number): boolean {
  return stroke.points.some((point, index) => {
    const previous = stroke.points[index - 1] ?? point;
    const ax = previous.x * w;
    const ay = previous.y * h;
    const dx = point.x * w - ax;
    const dy = point.y * h - ay;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared ? ((x - ax) * dx + (y - ay) * dy) / lengthSquared : 0;
    const fraction = Math.max(0, Math.min(1, projection));
    return Math.hypot(x - ax - fraction * dx, y - ay - fraction * dy) <= radiusPx;
  });
}
