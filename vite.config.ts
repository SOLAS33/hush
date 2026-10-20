import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/** After the build, put the list of built files into the service worker so the app shell works offline. */
function precacheList(): Plugin {
  let outDir = "dist";
  return {
    name: "hush-precache",
    apply: "build",
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (d: string) => {
        for (const n of readdirSync(d)) {
          const p = join(d, n);
          if (statSync(p).isDirectory()) walk(p);
          else files.push("/" + relative(outDir, p).replaceAll("\\", "/"));
        }
      };
      walk(outDir);
      const keep = files.filter((f) => !/^\/(sw\.js|_headers|\.assetsignore)$/.test(f));
      const swPath = join(outDir, "sw.js");
      const version = String(keep.reduce((h, f) => (h * 31 + f.length + statSync(join(outDir, f)).size) >>> 0, 7));
      writeFileSync(swPath, readFileSync(swPath, "utf8").replace("/*PRECACHE*/[]", JSON.stringify(["/", ...keep])).replace("__VERSION__", version));
    },
  };
}

export default defineConfig({
  plugins: [react(), precacheList()],
  build: { target: "es2022", sourcemap: false },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000 },
});
