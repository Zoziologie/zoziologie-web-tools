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
  { name: "1-toolbar-menu", background: "ebird-barchart.jpg", position: "right top", popup: { url: "https://ebird.org/barchart?r=OM" } },
  { name: "2-ebird-targets", background: "ebird-targets.jpg", position: "left top", highlight: [[607, 385, 103, 55], [1125, 610, 114, 30]] },
  { name: "3-ebird-trip-report", background: "ebird-tripreport.jpg", position: "left top", highlight: [[273, 305, 320, 190]] },
  { name: "4-macaulay-download", background: "macaulay-photo.jpg", highlight: [[1166, 716, 145, 24]] },
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

/*
 * Chrome Web Store promo tiles: small 440×280 and marquee 1400×560 (24-bit, no transparency).
 * They reuse the logo, the rendered toolbar menu and the Targets capture.
 */
const TILES = [
  { name: "promo-small", width: 440, height: 280, html: smallTile },
  { name: "promo-marquee", width: 1400, height: 560, html: marqueeTile },
];

const TILE_CSS = `
  html, body { margin: 0; overflow: hidden; }
  body { background: radial-gradient(120% 140% at 0% 0%, #2c4256 0%, #18232e 60%, #121a22 100%); color: #fff;
    font-family: -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
  .accent { color: #f4b740; }`;

function smallTile({ logo }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${TILE_CSS}
    body { width: 440px; height: 280px; display: grid; grid-template-columns: 132px 1fr; align-items: center; gap: 18px; padding: 0 30px; box-sizing: border-box; }
    img { width: 132px; height: 132px; }
    h1 { margin: 0; font-size: 38px; line-height: 1; font-weight: 800; letter-spacing: -.02em; }
    h2 { margin: 4px 0 14px; font-size: 25px; line-height: 1.1; font-weight: 500; color: #dfe6ec; }
    p { margin: 0; font-size: 15px; line-height: 1.35; font-weight: 600; }
  </style></head><body>
    <img src="data:image/png;base64,${logo}">
    <div><h1>Zoziologie</h1><h2>Web Tools</h2><p class="accent">eBird · Macaulay Library<br>ornitho · faune-france</p></div>
  </body></html>`;
}

function marqueeTile({ logo, screenshot }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${TILE_CSS}
    body { width: 1400px; height: 560px; position: relative; }
    .text { position: absolute; left: 72px; top: 70px; width: 560px; }
    .brand { display: flex; align-items: center; gap: 22px; }
    .brand img { width: 104px; height: 104px; }
    h1 { margin: 0; font-size: 58px; line-height: 1; font-weight: 800; letter-spacing: -.02em; }
    h2 { margin: 6px 0 0; font-size: 30px; font-weight: 500; color: #dfe6ec; }
    ul { list-style: none; margin: 44px 0 0; padding: 0; display: grid; gap: 16px; font-size: 25px; line-height: 1.25; font-weight: 500; }
    li { display: flex; gap: 14px; }
    li::before { content: "✓"; color: #f4b740; font-weight: 800; }
    .window { position: absolute; left: 640px; top: 52px; width: 704px; border-radius: 12px; overflow: hidden; background: #f3f3f3;
      box-shadow: 0 24px 60px rgb(0 0 0 / .5), 0 2px 10px rgb(0 0 0 / .3); }
    .bar { height: 28px; display: flex; align-items: center; gap: 7px; padding: 0 12px; }
    .bar i { width: 11px; height: 11px; border-radius: 50%; background: #ff5f57; }
    .bar i:nth-child(2) { background: #febc2e; } .bar i:nth-child(3) { background: #28c840; }
    .window img { display: block; width: 704px; height: 440px; }
  </style></head><body>
    <div class="text">
      <div class="brand"><img src="data:image/png;base64,${logo}"><div><h1>Zoziologie</h1><h2>Web Tools</h2></div></div>
      <ul>
        <li>CSV exports of eBird targets, trip reports and bar charts</li>
        <li>Macaulay Library photo and sound downloads</li>
        <li>Exports for ornitho and faune-france portals</li>
      </ul>
    </div>
    <div class="window"><div class="bar"><i></i><i></i><i></i></div><img src="data:image/png;base64,${screenshot}"></div>
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

    const assets = {
      logo: readFileSync(join(root, "logo/logo_300.png")).toString("base64"),
      // The marquee shows the finished Macaulay scene (photo plus highlighted button).
      screenshot: readFileSync(join(OUT, "4-macaulay-download.png")).toString("base64"),
    };
    for (const tile of TILES) {
      const file = join(scratch, `${tile.name}.html`);
      writeFileSync(file, tile.html(assets));
      const page = await browser.newPage();
      await page.setViewport({ width: tile.width, height: tile.height, deviceScaleFactor: 1 });
      await page.goto(`file://${file}`);
      await page.evaluate(() => Promise.all(Array.from(document.images, (img) => img.decode())));
      // Opaque page, so the PNG is 24-bit RGB as the Chrome Web Store requires.
      await page.screenshot({ path: join(OUT, `${tile.name}.png`), type: "png" });
      await page.close();
      console.log(`assets/store/${tile.name}.png`);
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
