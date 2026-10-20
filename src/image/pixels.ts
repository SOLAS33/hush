/** Plain pixel-buffer helpers that need no browser APIs, so the engine runs the same in Node tests and on the phone. */

export interface Raster {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

export function luma(r: Raster): Float32Array {
  const { data, width, height } = r;
  const y = new Float32Array(width * height);
  for (let i = 0, p = 0; i < y.length; i++, p += 4) y[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  return y;
}

/** Area-average when shrinking, bilinear when enlarging. Used to bring a rescaled image back to a size we know. */
export function resize(src: Raster, nw: number, nh: number): Raster {
  const out = new Uint8ClampedArray(nw * nh * 4);
  const sx = src.width / nw;
  const sy = src.height / nh;
  for (let oy = 0; oy < nh; oy++) {
    for (let ox = 0; ox < nw; ox++) {
      const o = (oy * nw + ox) * 4;
      if (sx >= 1 && sy >= 1) {
        const x0 = ox * sx, x1 = (ox + 1) * sx, y0 = oy * sy, y1 = (oy + 1) * sy;
        let r = 0, g = 0, b = 0, wsum = 0;
        for (let yy = Math.floor(y0); yy < Math.min(src.height, Math.ceil(y1)); yy++) {
          const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
          for (let xx = Math.floor(x0); xx < Math.min(src.width, Math.ceil(x1)); xx++) {
            const w = wy * (Math.min(xx + 1, x1) - Math.max(xx, x0));
            const p = (yy * src.width + xx) * 4;
            r += src.data[p] * w; g += src.data[p + 1] * w; b += src.data[p + 2] * w; wsum += w;
          }
        }
        out[o] = r / wsum; out[o + 1] = g / wsum; out[o + 2] = b / wsum; out[o + 3] = 255;
      } else {
        const fx = Math.min(src.width - 1, Math.max(0, (ox + 0.5) * sx - 0.5));
        const fy = Math.min(src.height - 1, Math.max(0, (oy + 0.5) * sy - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = Math.min(src.width - 1, x0 + 1), y1 = Math.min(src.height - 1, y0 + 1);
        const tx = fx - x0, ty = fy - y0;
        for (let c = 0; c < 3; c++) {
          const a = src.data[(y0 * src.width + x0) * 4 + c], b = src.data[(y0 * src.width + x1) * 4 + c];
          const d = src.data[(y1 * src.width + x0) * 4 + c], e = src.data[(y1 * src.width + x1) * 4 + c];
          out[o + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
        }
        out[o + 3] = 255;
      }
    }
  }
  return { data: out, width: nw, height: nh };
}

/** Crop to the largest size that is a multiple of 8 in both directions (top-left anchored). */
export function cropToBlocks(src: Raster): Raster {
  const w = src.width - (src.width % 8);
  const h = src.height - (src.height % 8);
  if (w === src.width && h === src.height) return src;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(src.data.subarray(y * src.width * 4, y * src.width * 4 + w * 4), y * w * 4);
  return { data: out, width: w, height: h };
}

export function psnr(a: Raster, b: Raster): number {
  let se = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const d = a.data[i * 4 + c] - b.data[i * 4 + c];
      se += d * d;
    }
  }
  const mse = se / (n * 3);
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

/** Mean SSIM on luma over non-overlapping 8x8 windows (a cheap, standard-constants approximation). */
export function ssim(a: Raster, b: Raster): number {
  const ya = luma(a), yb = luma(b);
  const c1 = (0.01 * 255) ** 2, c2 = (0.03 * 255) ** 2;
  let total = 0, count = 0;
  for (let by = 0; by + 8 <= a.height; by += 8) {
    for (let bx = 0; bx + 8 <= a.width; bx += 8) {
      let ma = 0, mb = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = (by + y) * a.width + bx + x; ma += ya[i]; mb += yb[i]; }
      ma /= 64; mb /= 64;
      let va = 0, vb = 0, cov = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = (by + y) * a.width + bx + x; va += (ya[i] - ma) ** 2; vb += (yb[i] - mb) ** 2; cov += (ya[i] - ma) * (yb[i] - mb); }
      va /= 63; vb /= 63; cov /= 63;
      total += ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2));
      count++;
    }
  }
  return total / count;
}
