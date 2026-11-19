#!/usr/bin/env node
/*
 * Builds the 1280×800 store screenshots in assets/store/ from raw page captures in assets/raw/.
 *
 *   npm run screenshots
 *
 * Raw captures are screenshots of the real websites with the extension running, taken in a
 * signed-in browser (eBird and Macaulay Library show a bot check to automated browsers).
 * The ".claude/skills/store-screenshots" skill describes how Claude takes them with Claude in Chrome.
 * The toolbar menu is rendered here from popup/popup.html with stubbed browser APIs,
 * so it always matches the current code.
 *
 * Needs a Chrome or Chromium binary: set CHROME_PATH, otherwise Google Chrome on macOS is used.
 */
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(root, "assets/raw");
const OUT = join(root, "assets/store");
const WIDTH = 1280;
const HEIGHT = 800;

/**
 * One entry per store image.
 * - background: raw capture in assets/raw/ (PNG or JPEG), scaled to cover 1280×800
 * - position: which part of the capture to keep when cropping (CSS object-position, default "center top")
 * - popup: show the toolbar menu as it appears for this tab address (360×600, like Chrome's popup)
 * - highlight: [x, y, width, height] boxes around the extension's controls, in raw-capture pixels
 *   (measure them on the capture, e.g. with getBoundingClientRect() before taking it)
 */
const SCENES = [
  { name: "1-toolbar-menu", background: "ebird-targets.jpg", position: "left top", popup: { url: "https://ebird.org/targets?r1=CH" } },
  { name: "2-ebird-targets", background: "ebird-targets.jpg", position: "left top", highlight: [[607, 385, 103, 55], [1125, 610, 114, 30]] },
  { name: "3-ebird-trip-report", background: "ebird-tripreport.jpg", position: "left top", highlight: [[273, 389, 320, 190]] },
  { name: "4-macaulay-download", background: "macaulay-photo.jpg", highlight: [[1160, 556, 158, 32]] },
  { name: "5-biolovision-export", background: "biolovision-species.jpg", position: "left top", highlight: [[305, 244, 270, 28]] },
];

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.");
  return found;
}

/** Stand-ins for the extension APIs the popup uses, describing one browser tab. */
function popupStub(url, manifest) {
  return `
    window.chrome = {
      runtime: { getManifest: () => (${JSON.stringify(manifest)}), onMessage: { addListener() {} } },
      storage: { sync: { get: async (defaults) => ({ ...defaults }), set: async () => {} }, onChanged: { addListener() {} } },
      tabs: { query: async () => [{ id: 1, url: ${JSON.stringify(url)} }], sendMessage: async () => ({ active: true }), reload: async () => {} },
      permissions: { contains: async () => true, request: async () => true },
    };`;
}

async function renderPopup(browser, url) {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 600, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.evaluateOnNewDocument(popupStub(url, manifest));
  await page.goto(`file://${join(root, "popup/popup.html")}`);
  await page.waitForSelector(".feature");
  await new Promise((done) => setTimeout(done, 300));
  const png = await page.screenshot({ type: "png" });
  await page.close();
  return Buffer.from(png).toString("base64");
}

function sceneHTML({ background, position = "center top" }, popup) {
  const image = readFileSync(join(RAW, background)).toString("base64");
  const type = /\.jpe?g$/i.test(background) ? "image/jpeg" : "image/png";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #fff; }
    .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${position}; }
    .popup { position: absolute; top: 0; right: 24px; width: 360px; height: 600px; border-radius: 0 0 12px 12px;
      box-shadow: 0 18px 50px rgb(0 0 0 / .35), 0 2px 8px rgb(0 0 0 / .2); }
    .shade { position: absolute; inset: 0; background: rgb(0 0 0 / .18); }
    .highlight { position: absolute; border: 3px solid #f4b740; border-radius: 8px; box-shadow: 0 0 0 4px rgb(244 183 64 / .3); }
  </style></head><body>
    <img class="bg" src="data:${type};base64,${image}">
    ${popup ? `<div class="shade"></div><img class="popup" src="data:image/png;base64,${popup}">` : ""}
  </body></html>`;
}

/** Place highlight boxes given in capture pixels, following the object-fit: cover crop. */
function placeHighlights(boxes) {
  const img = document.querySelector(".bg");
  const scale = Math.max(innerWidth / img.naturalWidth, innerHeight / img.naturalHeight);
  const [px, py] = getComputedStyle(img).objectPosition.split(" ").map((value) => parseFloat(value) / 100);
  const dx = (innerWidth - img.naturalWidth * scale) * px;
  const dy = (innerHeight - img.naturalHeight * scale) * py;
  const pad = 6;
  for (const [x, y, w, h] of boxes) {
    const box = document.createElement("div");
    box.className = "highlight";
    Object.assign(box.style, { left: `${x * scale + dx - pad}px`, top: `${y * scale + dy - pad}px`, width: `${w * scale + 2 * pad}px`, height: `${h * scale + 2 * pad}px` });
    document.body.append(box);
  }
}

async function main() {
  const missing = [...new Set(SCENES.map((scene) => scene.background))].filter((file) => !existsSync(join(RAW, file)));
  if (missing.length) {
    throw new Error(`Missing raw captures in assets/raw/: ${missing.join(", ")}. See .claude/skills/store-screenshots/SKILL.md.`);
  }
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ["--allow-file-access-from-files"] });
  const scratch = join(tmpdir(), `zoziologie-screenshots-${process.pid}`);
  mkdirSync(scratch, { recursive: true });
  try {
    for (const scene of SCENES) {
      const popup = scene.popup ? await renderPopup(browser, scene.popup.url) : null;
      const file = join(scratch, `${scene.name}.html`);
      writeFileSync(file, sceneHTML(scene, popup));
      const page = await browser.newPage();
      await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
      await page.goto(`file://${file}`);
      await page.evaluate(() => Promise.all(Array.from(document.images, (img) => img.decode())));
      if (scene.highlight) await page.evaluate(placeHighlights, scene.highlight);
      await page.screenshot({ path: join(OUT, `${scene.name}.png`), type: "png" });
      await page.close();
      console.log(`assets/store/${scene.name}.png`);
    }
  } finally {
    await browser.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
