// pdf.js can't go through Next's bundler (it breaks at load with
// "Object.defineProperty called on non-object"), so the browser loads the
// library's prebuilt files directly from public/pdfjs. Runs before dev and
// build; the copies are git-ignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/pdfjs-dist/build");
const to = join(root, "public/pdfjs");
mkdirSync(to, { recursive: true });
for (const file of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
  copyFileSync(join(from, file), join(to, file));
}
