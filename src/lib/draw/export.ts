import type { Stroke } from "@/store/studio";

import { redrawAll } from "./renderer";

interface ExportOptions {
  strokesOnly?: boolean;
  frameWidth?: number;
  frameHeight?: number;
}

export async function exportPng(
  video: HTMLVideoElement,
  strokes: readonly Stroke[],
  { strokesOnly = false, frameWidth, frameHeight }: ExportOptions = {},
): Promise<void> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height || (!strokesOnly && video.readyState < 2)) {
    throw new Error("Wait for the camera to be ready before exporting.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the export canvas.");

  // Reverse the preview's centered cover crop in native camera coordinates.
  const previewWidth = frameWidth || width;
  const previewHeight = frameHeight || previewWidth * 9 / 16;
  const scale = Math.max(previewWidth / width, previewHeight / height);
  ctx.setTransform(1 / scale, 0, 0, 1 / scale, (width - previewWidth / scale) / 2, (height - previewHeight / scale) / 2);
  redrawAll(ctx, strokes, previewWidth, previewHeight);

  if (!strokesOnly) {
    // Place the mirrored camera behind the already projected strokes.
    ctx.resetTransform();
    ctx.globalCompositeOperation = "destination-over";
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((image) => {
      if (image) resolve(image);
      else reject(new Error("Could not encode the PNG."));
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CyberTrace_${Date.now()}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
