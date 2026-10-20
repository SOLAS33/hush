/** Prints the user guide as JSON for the Solas33 products page (products.json "guide"). Same source as the in-app Guide screen. */
import { GUIDE } from "../src/components/guide-content";

const sections = GUIDE.map((s) => ({ heading: s.heading, ...(s.intro ? { intro: s.intro } : {}), ...(s.steps ? { steps: s.steps } : {}), ...(s.bullets ? { bullets: s.bullets } : {}) }));
if (!process.argv.includes("--md")) console.log(JSON.stringify({ title: "Get Hush on your phone", sections }, null, 2));

if (process.argv.includes("--md")) {
  const lines = ["# Hush user guide", "", "Free. No account. Everything happens on your phone. Open https://hush.solas33.com on your phone to start.", ""];
  for (const s of GUIDE) {
    lines.push(`## ${s.heading}`, "");
    if (s.intro) lines.push(s.intro, "");
    s.steps?.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    if (s.steps) lines.push("");
    s.bullets?.forEach((t) => lines.push(`* ${t}`));
    if (s.bullets) lines.push("");
  }
  console.error("markdown below");
  console.log(lines.join("\n"));
}
