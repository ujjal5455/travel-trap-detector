"use client";
// Shrinks a phone photo to a JPEG under maxBytes in the browser before upload.
// Re-encoding through a canvas also drops EXIF metadata, including GPS location and camera details.
import { EVIDENCE_PHOTO } from "../config";

type Drawable = ImageBitmap | HTMLImageElement;

async function loadImage(file: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Some formats (e.g. HEIC on some browsers) only decode through <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the photo"))), "image/jpeg", quality),
  );
}

export async function compressImage(
  file: Blob,
  maxBytes: number = EVIDENCE_PHOTO.targetBytes,
  maxDimension: number = EVIDENCE_PHOTO.maxDimension,
): Promise<Blob> {
  const image = await loadImage(file);
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  if (!width || !height) throw new Error("That file doesn't look like a photo.");

  for (let dim = maxDimension; dim >= 400; dim = Math.round(dim * 0.75)) {
    const scale = Math.min(1, dim / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can't process photos.");
    ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4]) {
      const blob = await toJpeg(canvas, quality);
      if (blob.size <= maxBytes) return blob;
    }
  }
  throw new Error("This photo is too detailed to shrink enough. Try a different one.");
}
