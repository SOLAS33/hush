/** Browser-only image I/O: file -> pixels, pixels -> JPEG. Everything stays in memory on the device. */
import { CONFIG } from "../config";
import { AppError } from "../app/errors";
import type { JpegCodec } from "./engine";
import type { Raster } from "./pixels";

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function decodeBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    // 'from-image' applies the phone's rotation so the pixels we embed in are the pixels people see
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new AppError("unsupported-format");
  }
}

function pixelsOf(bitmap: ImageBitmap, w: number, h: number): Raster {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  canvas.width = canvas.height = 0; // release the backing store
  return { data: id.data, width: w, height: h };
}

/** For hiding: scale down to the working size (multiples of 8) while decoding, so a 48 MP photo never sits in memory at full size. */
export async function loadForEncoding(file: Blob): Promise<Raster> {
  const bitmap = await decodeBitmap(file);
  try {
    const { width, height } = bitmap;
    if (width * height > CONFIG.image.maxInputPixels) throw new AppError("out-of-memory");
    const long = Math.max(width, height);
    if (long < CONFIG.image.minLongEdge) throw new AppError("image-too-small");
    const s = Math.min(1, CONFIG.image.maxLongEdge / long);
    const w = Math.max(8, Math.floor((width * s) / 8) * 8);
    const h = Math.max(8, Math.floor((height * s) / 8) * 8);
    return pixelsOf(bitmap, w, h);
  } finally {
    bitmap.close();
  }
}

/** For revealing: the received picture at its own size, untouched. */
export async function loadForDecoding(file: Blob): Promise<Raster> {
  const bitmap = await decodeBitmap(file);
  try {
    if (bitmap.width * bitmap.height > CONFIG.image.maxInputPixels) throw new AppError("out-of-memory");
    return pixelsOf(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** The phone's own JPEG encoder, used both to make the shared file and to rehearse a messenger's recompression. */
export const canvasCodec: JpegCodec = {
  async roundTrip(img, quality) {
    const canvas = makeCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, CONFIG.image.outputType, quality));
    canvas.width = canvas.height = 0;
    if (!blob || blob.type !== CONFIG.image.outputType) throw new AppError("encoding-failed");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const bitmap = await createImageBitmap(blob);
    try {
      return { bytes, decoded: pixelsOf(bitmap, bitmap.width, bitmap.height) };
    } finally {
      bitmap.close();
    }
  },
};
