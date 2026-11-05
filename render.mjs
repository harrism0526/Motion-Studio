#!/usr/bin/env node
// Render a code-driven video to MP4 (or a few stills for a quick check).
//
//   node render.mjs videos/hello.html            -> out/hello.mp4
//   node render.mjs hello --stills 3             -> out/hello-still-1.png … -3.png
//   node render.mjs hello --fps 60               -> override frame rate (default 30)
//
// A video is an HTML file that sets window.DURATION (seconds), window.SIZE ([w, h])
// and window.render(t), which draws the exact frame at time t (seconds).

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Playwright: use a local install if there is one, otherwise the global one.
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const tries = ["playwright", "/opt/node-tools/node_modules/playwright"];
  for (const id of tries) {
    try { return require(id); } catch {}
  }
  console.error("Playwright not found. Install it with:  npm install playwright && npx playwright install chromium");
  process.exit(1);
}

// ── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  if (!Number.isFinite(v) || v <= 0) { console.error(`--${name} needs a positive number`); process.exit(1); }
  return v;
};
const stills = opt("stills", 0);
const fps = opt("fps", 30);
let input = args[0];
if (!input) {
  console.error("Usage: node render.mjs <video.html | name> [--stills N] [--fps N]");
  process.exit(1);
}
// Accept "hello", "hello.html" or a full path
if (!existsSync(input)) {
  const guess = path.join(ROOT, "videos", input.endsWith(".html") ? input : `${input}.html`);
  if (existsSync(guess)) input = guess;
  else { console.error(`Can't find video: ${args[0]}`); process.exit(1); }
}
const name = path.basename(input, ".html");
const outDir = path.join(ROOT, "out");
mkdirSync(outDir, { recursive: true });

// ── Browser ─────────────────────────────────────────────────────────────
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", e => console.error("  [page error]", e.message));
await page.goto(pathToFileURL(path.resolve(input)).href);

const meta = await page.evaluate(() => ({
  duration: window.DURATION, size: window.SIZE, hasRender: typeof window.render === "function",
}));
if (!meta.hasRender || !(meta.duration > 0) || !Array.isArray(meta.size)) {
  console.error("The video must set window.DURATION, window.SIZE = [w, h] and window.render(t).");
  await browser.close(); process.exit(1);
}
const [width, height] = meta.size;
await page.setViewportSize({ width, height });
await page.evaluate(() => document.fonts.ready);

async function frameAt(t) {
  await page.evaluate(async t => {
    await window.render(t);              // render may be sync or async
    await document.fonts.ready;
  }, t);
  return page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
}

const totalFrames = Math.round(meta.duration * fps);
const lastT = (totalFrames - 1) / fps;

// ── Stills mode ─────────────────────────────────────────────────────────
if (stills) {
  const { writeFileSync } = await import("node:fs");
  for (let i = 0; i < stills; i++) {
    // Evenly spaced through the video, snapped to real frame times
    const t = Math.round(((i + 0.5) / stills) * lastT * fps) / fps;
    const file = path.join(outDir, `${name}-still-${i + 1}.png`);
    writeFileSync(file, await frameAt(t));
    console.log(`  still ${i + 1}/${stills}  t=${t.toFixed(2)}s  → ${path.relative(ROOT, file)}`);
  }
  await browser.close();
  process.exit(0);
}

// ── Video mode: pipe PNG frames straight into ffmpeg ────────────────────
const outFile = path.join(outDir, `${name}.mp4`);
const ff = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  outFile,
], { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((res, rej) =>
  ff.on("close", code => code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}`))));

const started = Date.now();
for (let f = 0; f < totalFrames; f++) {
  const png = await frameAt(f / fps);
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once("drain", r));
  if (f % fps === 0 || f === totalFrames - 1)
    process.stdout.write(`\r  ${name}: frame ${f + 1}/${totalFrames}`);
}
ff.stdin.end();
await ffDone;
await browser.close();
console.log(`\n  ✓ ${path.relative(ROOT, outFile)}  (${width}×${height}, ${fps}fps, ${meta.duration}s, ` +
            `rendered in ${((Date.now() - started) / 1000).toFixed(1)}s)`);
