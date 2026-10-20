/**
 * Every tunable value lives here (design brief section 15). Nothing else in the app hard-codes these.
 * Changing anything under `embed` changes the on-image format: bump FORMAT_VERSION if you do.
 */

export const FORMAT_VERSION = 1;

export const CONFIG = {
  payload: {
    /** The interface warns above this many UTF-8 bytes of message (brief 5.3: initial target). */
    softLimitBytes: 240,
    /** The interface refuses above this many UTF-8 bytes (brief 5.3: hard limit, subject to capacity). */
    hardLimitBytes: 512,
  },

  image: {
    /** Output is scaled down (never up) so its long edge is at most this. Kept low so the messenger has no reason to resize it. */
    maxLongEdge: 1280,
    /** Below this long edge the photo is refused as unsuitable. */
    minLongEdge: 640,
    /** Quality of the JPEG we hand to the share sheet. */
    outputQuality: 0.92,
    outputType: "image/jpeg",
    /** Reject absurd inputs before decoding them (pixels). */
    maxInputPixels: 120_000_000,
  },

  embed: {
    /**
     * Mid-frequency DCT positions (horizontal u, vertical v) carrying one bit per block each.
     * Chosen because the standard JPEG luma quantiser steps there are small (about 13 to 19 at quality 50)
     * and a change there is much less visible than in the low frequencies.
     */
    coefficients: [
      [1, 2],
      [2, 1],
      [2, 2],
      [1, 3],
      [3, 1],
    ] as ReadonlyArray<readonly [number, number]>,
    /**
     * Quantisation steps (QIM step, in DCT units) the encoder may use, weakest first.
     * The decoder tries each, so a step is never stored in the clear.
     * Larger = survives harder recompression, but is more visible.
     */
    steps: [20, 28, 38, 52] as ReadonlyArray<number>,
    /** Each header bit is repeated this many times. The header is read before anything else, so it gets the most redundancy. */
    headerRepeat: 36,
    /** Refuse a message if each body bit could be repeated fewer than this many times. */
    minBodyRepeat: 4,
    /** Largest Reed-Solomon data block (bytes). Parity per block is derived from block size, see payload/reed-solomon. */
    rsMaxData: 190,
    rsParityMin: 16,
    rsParityMax: 64,
    rsParityRatio: 0.35,
    /** Public constant that keys the slot order, whitening and dither. It is not a secret; it only stops the format being a fixed pattern. */
    seed: "hush/format-1",
    /** Long edges the decoder will also try if the image arrives at a different size (a messenger that rescaled it). */
    rescaleLongEdges: [1280, 1200, 1152, 1024, 960, 800, 640] as ReadonlyArray<number>,
  },

  /** The encoder proves its own output survives recompression before offering it (brief 5.2). */
  selfTest: {
    /** JPEG qualities (0..1, browser scale) the output must survive, harshest first so a weak step fails fast. Several in-between values matter: recovery is not monotonic in quality. */
    jpegQualities: [0.42, 0.5, 0.6, 0.7, 0.8] as ReadonlyArray<number>,
  },

  crypto: {
    /** PBKDF2-HMAC-SHA-256 iterations, stored by id so they can change later. Id 1 = 600000 (OWASP 2023 guidance for SHA-256). */
    kdf: { 1: { name: "PBKDF2-HMAC-SHA-256", iterations: 600_000 } } as Record<number, { name: string; iterations: number }>,
    currentKdf: 1,
    saltBytes: 16,
    nonceBytes: 12,
    minPasscodeLength: 8,
  },

  timeouts: {
    /** Give up on one encode or decode after this long (ms). */
    processingMs: 60_000,
  },
} as const;
