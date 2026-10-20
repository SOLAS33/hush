import { describe, expect, it } from "vitest";
import { rsDecode, rsEncode } from "../../src/payload/reed-solomon";
import { rng } from "../../src/image/prng";

describe("Reed-Solomon", () => {
  const r = rng("rs-test");
  const randomBytes = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(r() * 256));

  it("round-trips clean data", () => {
    const d = randomBytes(100);
    expect(Array.from(rsDecode(rsEncode(d, 16), 16)!)).toEqual(Array.from(d));
  });

  it("corrects up to nsym/2 byte errors in random positions", () => {
    for (let trial = 0; trial < 200; trial++) {
      const nsym = [8, 16, 32, 64][trial % 4];
      const d = randomBytes(1 + Math.floor(r() * (255 - nsym)));
      const cw = rsEncode(d, nsym);
      const bad = Uint8Array.from(cw);
      const errs = Math.floor(r() * (nsym / 2 + 1));
      const used = new Set<number>();
      while (used.size < errs) used.add(Math.floor(r() * bad.length));
      for (const p of used) bad[p] ^= 1 + Math.floor(r() * 255);
      const out = rsDecode(bad, nsym);
      expect(out, `trial ${trial} nsym ${nsym} errs ${errs}`).not.toBeNull();
      expect(Array.from(out!)).toEqual(Array.from(d));
    }
  });

  it("refuses (never returns wrong data) beyond capacity", () => {
    let wrong = 0;
    for (let trial = 0; trial < 300; trial++) {
      const d = randomBytes(40);
      const bad = Uint8Array.from(rsEncode(d, 8));
      for (let i = 0; i < 9; i++) bad[i * 5] ^= 0x55;
      const out = rsDecode(bad, 8);
      if (out && Array.from(out).join() !== Array.from(d).join()) wrong++;
    }
    expect(wrong).toBe(0);
  });
});
