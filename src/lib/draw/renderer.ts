import type { Point } from "../hand/types";
import type { Stroke } from "../../store/studio";

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Paints the newest point or completes the curve to the final point. */
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number,
  index = stroke.points.length - 1,
  finish = false,
): void {
  const { points, width, color } = stroke;
  const point = points[index];
  if (!point) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 15;
  ctx.shadowColor = color;
  ctx.beginPath();

  if (index === 0) {
    ctx.arc(point.x * w, point.y * h, width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const previous = points[index - 1];
    const end = midpoint(previous, point);
    const start = finish ? end : index === 1 ? previous : midpoint(points[index - 2], previous);
    ctx.moveTo(start.x * w, start.y * h);
    if (finish) ctx.lineTo(point.x * w, point.y * h);
    else ctx.quadraticCurveTo(previous.x * w, previous.y * h, end.x * w, end.y * h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Clears the canvas and replays the committed strokes at the current size. */
export function redrawAll(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  for (const stroke of strokes) {
    stroke.points.forEach((_, index) => drawSegment(ctx, stroke, w, h, index));
    if (stroke.points.length > 1) drawSegment(ctx, stroke, w, h, stroke.points.length - 1, true);
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
