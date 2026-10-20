import sharp from "sharp";
import type { JpegCodec } from "../../src/image/engine";

/** libjpeg (via sharp) standing in for a phone's JPEG encoder. */
export const nodeCodec: JpegCodec = {
  async roundTrip(img, quality) {
    const jpg = await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } })
      .removeAlpha()
      .jpeg({ quality: Math.round(quality * 100), chromaSubsampling: "4:2:0" })
      .toBuffer();
    const out = await sharp(jpg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      bytes: new Uint8Array(jpg),
      decoded: { data: new Uint8ClampedArray(out.data.buffer, out.data.byteOffset, out.data.byteLength), width: out.info.width, height: out.info.height },
    };
  },
};
