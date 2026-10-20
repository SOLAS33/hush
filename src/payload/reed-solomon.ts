/**
 * Reed-Solomon over GF(2^8), primitive polynomial 0x11d, generator roots alpha^0 .. alpha^(nsym-1).
 * Errors only (no erasures). Shortened codes are fine: the data may be any length up to 255 - nsym.
 * This is error correction, not cryptography.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
const div = (a: number, b: number): number => {
  if (b === 0) throw new Error("division by zero");
  return a === 0 ? 0 : EXP[(LOG[a] + 255 - LOG[b]) % 255];
};

/** Polynomials are arrays with the highest power first. */
function polyMul(p: number[], q: number[]): number[] {
  const r = new Array<number>(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) r[i + j] ^= mul(p[i], q[j]);
  return r;
}

function polyEval(p: ArrayLike<number>, x: number): number {
  let y = p[0];
  for (let i = 1; i < p.length; i++) y = mul(y, x) ^ p[i];
  return y;
}

const generatorCache = new Map<number, number[]>();
function generator(nsym: number): number[] {
  let g = generatorCache.get(nsym);
  if (!g) {
    g = [1];
    for (let i = 0; i < nsym; i++) g = polyMul(g, [1, EXP[i]]);
    generatorCache.set(nsym, g);
  }
  return g;
}

/** Returns data followed by nsym parity bytes. */
export function rsEncode(data: Uint8Array, nsym: number): Uint8Array {
  if (data.length + nsym > 255) throw new Error("Reed-Solomon block too long");
  const gen = generator(nsym);
  const out = new Uint8Array(data.length + nsym);
  out.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = out[i];
    if (coef !== 0) for (let j = 1; j < gen.length; j++) out[i + j] ^= mul(gen[j], coef);
  }
  out.set(data); // the loop above destroyed the data part; restore it, parity is already in place
  return out;
}

/** Corrects up to nsym/2 byte errors. Returns the data bytes, or null if the block is unrecoverable. */
export function rsDecode(block: Uint8Array, nsym: number): Uint8Array | null {
  const n = block.length;
  if (n <= nsym || n > 255) return null;
  const msg = Array.from(block);

  const synd = new Array<number>(nsym);
  let clean = true;
  for (let i = 0; i < nsym; i++) {
    synd[i] = polyEval(msg, EXP[i]);
    if (synd[i] !== 0) clean = false;
  }
  if (clean) return block.slice(0, n - nsym);

  // Berlekamp-Massey: error locator polynomial (lowest power first inside this routine)
  let sigma = [1];
  let prev = [1];
  let L = 0;
  let m = 1;
  let b = 1;
  for (let i = 0; i < nsym; i++) {
    let d = synd[i];
    for (let j = 1; j <= L; j++) d ^= mul(sigma[j] ?? 0, synd[i - j]);
    if (d === 0) {
      m++;
    } else {
      const t = sigma.slice();
      const coef = div(d, b);
      const shifted = new Array<number>(m).fill(0).concat(prev.map((v) => mul(v, coef)));
      const len = Math.max(sigma.length, shifted.length);
      const next = new Array<number>(len).fill(0);
      for (let k = 0; k < len; k++) next[k] = (sigma[k] ?? 0) ^ (shifted[k] ?? 0);
      if (2 * L <= i) {
        L = i + 1 - L;
        prev = t;
        b = d;
        m = 1;
      } else {
        m++;
      }
      sigma = next;
    }
  }
  while (sigma.length > 1 && sigma[sigma.length - 1] === 0) sigma.pop();
  if (L > nsym / 2 || sigma.length - 1 !== L) return null;

  // Chien search: roots of sigma are inverses of error locators.
  const positions: number[] = [];
  for (let pos = 0; pos < n; pos++) {
    // error at array index pos has locator alpha^(n-1-pos); evaluate sigma at its inverse
    const xInv = EXP[(255 - ((n - 1 - pos) % 255)) % 255];
    let acc = 0;
    let xp = 1;
    for (let k = 0; k < sigma.length; k++) {
      acc ^= mul(sigma[k], xp);
      xp = mul(xp, xInv);
    }
    if (acc === 0) positions.push(pos);
  }
  if (positions.length !== L) return null;

  // Forney: error evaluator omega = (S(x) * sigma(x)) mod x^nsym, lowest power first
  const omega = new Array<number>(nsym).fill(0);
  for (let i = 0; i < nsym; i++) for (let j = 0; j <= i && j < sigma.length; j++) omega[i] ^= mul(sigma[j], synd[i - j]);

  const fixed = Uint8Array.from(block);
  for (const pos of positions) {
    const xi = EXP[(n - 1 - pos) % 255];
    const xiInv = EXP[(255 - ((n - 1 - pos) % 255)) % 255];
    let num = 0;
    let xp = 1;
    for (let k = 0; k < omega.length; k++) {
      num ^= mul(omega[k], xp);
      xp = mul(xp, xiInv);
    }
    // formal derivative of sigma at xiInv: only odd powers survive in characteristic 2
    // den = sum over odd k of sigma[k] * xiInv^(k-1)
    let den = 0;
    xp = 1;
    const step = mul(xiInv, xiInv);
    for (let k = 1; k < sigma.length; k += 2) {
      den ^= mul(sigma[k], xp);
      xp = mul(xp, step);
    }
    if (den === 0) return null;
    fixed[pos] ^= mul(xi, div(num, den));
  }

  // verify the result really is a codeword
  for (let i = 0; i < nsym; i++) if (polyEval(Array.from(fixed), EXP[i]) !== 0) return null;
  return fixed.slice(0, n - nsym);
}

/** Parity bytes for a block with `dataLen` data bytes. Deterministic so the decoder can recompute it. */
export function parityFor(dataLen: number, min: number, max: number, ratio: number): number {
  return Math.min(max, Math.max(min, Math.ceil(dataLen * ratio)));
}
