const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { Script } = require("node:vm");
const { JSDOM } = require("jsdom");
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const source = (path) => readFileSync(path, "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function page(t, html = "", url = "https://ebird.org/targets", { stored, chrome, realDownload = false } = {}) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const window = dom.window;
  const downloads = [];
  const errors = [];
  const notes = [];
  window.console.error = () => {};
  window.console.warn = () => {};
  if (stored || chrome) window.chrome = fakeChrome(stored, chrome).chrome;
  window.eval(source("js/shared/core.js"));
  window.Zoziologie.notify = (message, { type = "info" } = {}) => {
    (type === "error" ? errors : notes).push(message);
    return { update: (next) => notes.push(next), close: () => {} };
  };
  if (!realDownload) window.Zoziologie.downloadCSV = (...args) => downloads.push(JSON.parse(JSON.stringify(args)));
  // Feature scripts wait for settings, so give them a turn of the event loop to install controls.
  const load = async (path) => {
    window.eval(source(path));
    await tick();
  };
  return { window, document: window.document, downloads, errors, notes, load };
}

function fakeChrome(stored = {}, extra = {}) {
  const data = { ...stored };
  const listeners = [];
  const chrome = {
    runtime: { onMessage: { addListener() {} }, getManifest: () => manifest },
    storage: {
      sync: {
        get: async (defaults) => ({ ...defaults, ...data }),
        set: async (changes) => {
          Object.assign(data, changes);
          listeners.forEach((listener) => listener(Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, { newValue: value }])), "sync"));
        },
      },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
    ...extra,
  };
  return { chrome, data };
}

test("manifest scripts parse and all referenced extension files exist", () => {
  assert.equal(manifest.version, JSON.parse(source("package.json")).version);
  for (const entry of manifest.content_scripts) {
    assert.equal(new Set(entry.matches).size, entry.matches.length);
    for (const match of entry.matches) {
      assert.equal(match, match.toLowerCase());
      assert.ok(!match.includes("//*"));
    }
    for (const path of [...entry.js, ...(entry.css ?? [])]) {
      assert.ok(existsSync(path), path);
      if (path.endsWith(".js")) new Script(source(path), { filename: path });
    }
    assert.equal(entry.js[0], "js/shared/core.js");
  }
  for (const icon of Object.values(manifest.icons)) assert.ok(existsSync(icon));
  assert.deepEqual(manifest.permissions, ["storage", "activeTab"]);
  assert.ok(existsSync(manifest.action.default_popup));
  assert.deepEqual(manifest.optional_permissions, ["downloads"]);
  assert.equal(manifest.background.service_worker, manifest.background.scripts[0]);
  new Script(source(manifest.background.service_worker), { filename: manifest.background.service_worker });
  assert.equal(manifest.browser_specific_settings.gecko.data_collection_permissions.required[0], "none");
});

test("CSV preserves commas, quotes, newlines, Unicode, false, zero and later columns", (t) => {
  const { window } = page(t);
  assert.equal(window.Zoziologie.csv([
    { name: 'Épervier, "test"\nline', number: 0, lifer: false },
    { name: "Bird", extra: "# & %", number: null },
  ]), 'name,number,lifer,extra\r\n"Épervier, ""test""\nline",0,false,\r\nBird,,,# & %');
  assert.equal(window.Zoziologie.csv([{ b: 2, a: 1 }], ["a", "b"]), "a,b\r\n1,2");
});

test("downloads use UTF-8 Blob URLs, release them and confirm the row count", (t) => {
  const { window, notes } = page(t, "", undefined, { realDownload: true });
  let blob;
  let clicked;
  let cleanup;
  window.URL.createObjectURL = (value) => { blob = value; return "blob:test"; };
  window.URL.revokeObjectURL = (url) => assert.equal(url, "blob:test");
  window.setTimeout = (callback) => { cleanup = callback; };
  window.HTMLAnchorElement.prototype.click = function () { clicked = { href: this.href, name: this.download }; };
  window.Zoziologie.downloadCSV([{ bird: "é#%" }], 'a/b?"test');
  assert.equal(blob.type, "text/csv;charset=utf-8");
  assert.deepEqual(clicked, { href: "blob:test", name: "a_b__test.csv" });
  assert.equal(window.document.querySelector("a"), null);
  assert.deepEqual(notes, ["Downloaded 1 row · a_b__test.csv"]);
  cleanup();
  assert.throws(() => window.Zoziologie.downloadCSV([], "empty"), /Nothing to download/);
});

test("bounded parallel requests preserve ordering", async (t) => {
  const { window } = page(t);
  let active = 0;
  let peak = 0;
  const result = await window.Zoziologie.mapConcurrent([0, 1, 2, 3, 4, 5, 6, 7], async (value) => {
    peak = Math.max(peak, ++active);
    await wait(value % 2 ? 2 : 8);
    active--;
    return value * 2;
  }, 3);
  assert.equal(peak, 3);
  assert.deepEqual(Array.from(result), [0, 2, 4, 6, 8, 10, 12, 14]);
});

test("HTTP failures are reported and action state is reset; repeated clicks are ignored", async (t) => {
  const { window, document, errors } = page(t, "<button><span class='LoadingAnimation'></span></button>");
  window.fetch = async () => ({ ok: false, status: 429 });
  const button = document.querySelector("button");
  const first = window.Zoziologie.runAction(button, () => window.Zoziologie.fetchJSON("/test"));
  await window.Zoziologie.runAction(button, () => assert.fail("duplicate action"));
  await first;
  assert.match(errors[0], /429/);
  assert.equal(button.hasAttribute("aria-busy"), false);
  assert.equal(button.firstChild.style.display, "none");
});

test("target CSV supports a single species and extracts text without HTML", async (t) => {
  const { document, downloads, load } = page(t, `
    <div><button class="Button Button--small Button--hollow">Print</button></div>
    <section aria-labelledby="native-and-naturalized"><ol><li>
      <div class="ResultsStats-index"><span>1.</span></div>
      <div class="ResultsStats-action"><a href="/map/brant?x=y">Map</a></div>
      <div class="SpecimenHeader-joined"><a><span>Brent, Goose</span> <em>Branta bernicla</em></a></div>
      <div class="ResultsStats-stats"><span class="Heading">1.77%</span></div>
    </li></ol></section>`);
  await load("js/eBird-target.js");
  Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Download (csv)").click();
  await tick();
  assert.equal(downloads.length, 1);
  assert.deepEqual(downloads[0][0], [{ rank: "1", speciesCode: "brant", commonName: "Brent, Goose", sciName: "Branta bernicla", frequency: "1.77%", exoticCategory: "Native" }]);
  assert.equal(downloads[0][1], "targets");
});

test("region lookup debounces, cancels stale results, uses text and dispatches select changes", async (t) => {
  const { window, document, load } = page(t, '<div class="GridFlex-cell"><select id="targets-comparison-region"><option value="FR">France</option></select></div>');
  const requests = [];
  window.fetch = (url, options) => new Promise((resolve) => requests.push({ url, options, resolve }));
  await load("js/eBird-target.js");
  document.querySelector("button").click();
  const input = document.querySelector("input");
  const type = (value) => { input.value = value; input.dispatchEvent(new window.Event("input")); };
  type("Fra"); type("Franc");
  await wait(280);
  assert.equal(requests.length, 1);
  type("Can");
  assert.equal(requests[0].options.signal.aborted, true);
  requests[0].resolve({ ok: true, json: async () => [{ name: "Old result", code: "OLD" }] });
  await wait(280);
  assert.equal(requests.length, 2);
  requests[1].resolve({ ok: true, json: async () => [{ name: "Canada <b>literal</b>", code: "CA" }] });
  await tick();
  const option = document.querySelector(".Suggest-suggestion");
  assert.equal(option.textContent, "Canada <b>literal</b>");
  assert.equal(option.querySelector("b"), null);
  let changes = 0;
  document.querySelector("select").addEventListener("change", () => changes++);
  option.click();
  assert.equal(document.querySelector("select").value, "CA");
  assert.equal(changes, 1);
  assert.equal(document.querySelector(".Suggest-dropdown").hidden, true);
});

test("trip exports keep participant context and independent observation details", async (t) => {
  const { window, document, downloads, notes, load } = page(t, '<div class="ReportMetaTools"></div><h1 class="ReportTitle-name">My Trip</h1>', "https://ebird.org/tripreport/123/456");
  const urls = [];
  window.fetch = async (url) => {
    urls.push(url);
    const data = url.includes("taxon-list") ? [{ speciesCode: "a" }, { speciesCode: "b" }] : { checklists: [{ subId: url.includes("/a?") ? "S1" : "S2" }] };
    return { ok: true, json: async () => data };
  };
  await load("js/eBird-tripreport.js");
  document.querySelector("#zoziology-tripreport-observation").click();
  await tick();
  assert.equal(downloads[0][1], "my_trip_observations");
  assert.ok(notes.includes("Loading observations… 2 of 2 species"));
  assert.deepEqual(downloads[0][0].map((row) => [row.speciesCode, row.subId]), [["a", "S1"], ["b", "S2"]]);
  assert.ok(urls.every((url) => url.endsWith("?tripReportPersonId=456")));
  assert.equal(window.detail, undefined);
});

test("trip reports export one species and report empty checklists", async (t) => {
  const { window, document, downloads, load } = page(t, '<div class="ReportMetaTools"></div><h1 class="ReportTitle-name">Trip</h1>', "https://ebird.org/tripreport/123");
  window.fetch = async (url) => ({ ok: true, json: async () => url.includes("taxon-list") ? [{ speciesCode: "a", numIndividuals: 0 }] : [] });
  await load("js/eBird-tripreport.js");
  document.querySelector("#zoziology-tripreport-species").click();
  await tick();
  assert.equal(downloads[0][0].length, 1);
  const empty = page(t, '<div class="ReportMetaTools"></div><h1 class="ReportTitle-name">Trip</h1>', "https://ebird.org/tripreport/123", { realDownload: true });
  empty.window.fetch = async () => ({ ok: true, json: async () => [] });
  await empty.load("js/eBird-tripreport.js");
  empty.document.querySelector("#zoziology-tripreport-checklist").click();
  await tick();
  assert.match(empty.errors[0], /Nothing to download/);
});

test("barchart exports a single taxon, normalization and all 48 periods", async (t) => {
  const { window, document, downloads, load } = page(t, '<div id="barchart-display"></div>', "https://ebird.org/barchart?r=FR&fmt=old");
  window.fetch = async (url) => {
    assert.equal(url.searchParams.getAll("fmt").length, 1);
    assert.equal(url.searchParams.get("fmt"), "json");
    return { ok: true, json: async () => ({ dataRows: [{ taxon: { speciesCode: "bird", commonName: 'Bird "one"' }, values: Array(48).fill(0.1), values_N: Array(48).fill(10) }] }) };
  };
  await load("js/eBird-barchart.js");
  document.querySelector("button").click();
  await tick();
  assert.equal(downloads[0][0].length, 2);
  assert.equal(downloads[0][0][0].Jan1, 10);
  assert.equal(downloads[0][0][1].Dec4, 0.1);
  assert.equal(downloads[0][2].length, 53);
});

test("Biolovision list exports preserve localized dates and original remarks", async (t) => {
  const { document, downloads, load } = page(t, `<div class="box flex-box"></div>
    <div class="listContainer"><div class="listTop">vendredi, 6 décembre 2024</div>
      <div class="obs_level_2_i_content"><div class="listSubmenu"><a href="/place">Place, FR</a></div>
        <div class="observation_container"><span class="sighting_count">2</span><b>Bird</b><span class="sci_name">(Aves)</span><div class="remark">A, B\nC</div></div>
      </div>
    </div>`, "https://www.ornitho.ch/index.php?sp_FChoice=list");
  await load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
  await tick();
  document.querySelector("#zoziology-export").click();
  await tick();
  assert.equal(downloads[0][0][0].date, "vendredi, 6 décembre 2024");
  assert.equal(downloads[0][0][0].remark, "A, B\nC");
  assert.equal(downloads[0][0][0].place_link, "https://www.ornitho.ch/place");
  assert.match(downloads[0][1], /^ornitho\.ch_observations_\d{4}-\d{2}-\d{2}$/);
});

test("Biolovision installs dynamic export controls once", async (t) => {
  const { document, load } = page(t, "", "https://www.ornitho.ch/index.php?sp_FChoice=species");
  await load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
  await tick();
  document.body.insertAdjacentHTML("beforeend", '<div class="box flex-box"></div>');
  await wait(200);
  assert.equal(document.querySelectorAll("#zoziology-export").length, 1);
  document.body.append(document.createElement("section"));
  await wait(200);
  assert.equal(document.querySelectorAll("#zoziology-export").length, 1);
});

test("page scripts tolerate absent site controls", async (t) => {
  for (const entry of manifest.content_scripts) {
    const { load } = page(t);
    for (const script of entry.js.slice(1)) await load(script);
  }
});

test("region map keeps US and Canada state codes and uses country elsewhere", async (t) => {
  for (const [region, expected] of [["US-CA-001", "US-CA"], ["CA-QC", "CA-QC"], ["FR-IDF", "FR"]]) {
    const { document, load } = page(t, '<ul class="SectionMenu-section-list"></ul>', `https://ebird.org/region/${region}`);
    await load("js/eBird-region.js");
    assert.equal(new URL(document.querySelector("a").href).searchParams.get("r"), expected);
    assert.equal(document.querySelector("a b").textContent, "Rare Bird Map");
  }
});

test("checklist copy works when clicking inside SVG and both location links are added", async (t) => {
  const { window, document, notes, load } = page(t, `
    <div class="Observation" id="obs-123"><div class="Observation-species">Bird</div></div>
    <a href="/editloc?locID=L123&other=value">Edit Location</a>
    <div id="checklist-tools"><ul><li>Existing action</li></ul></div>`, "https://ebird.org/checklist/S123?view=all#old");
  let copied;
  window.navigator.clipboard = { writeText: async (text) => { copied = text; } };
  await load("js/eBird-checklist.js");
  document.querySelector(".zoziology-ebird-link svg").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await tick();
  assert.equal(copied, "https://ebird.org/checklist/S123?view=all#obs-123");
  assert.equal(document.querySelectorAll('a[href="/mylocations/edit/L123"]').length, 2);
  assert.match(notes[0], /copied to the clipboard/);
});

test("checklist adds Manage Location after Edit Location in eBird's current tools list", async (t) => {
  const { document, load } = page(t, `
    <a class="Button" href="/editloc?locID=L77&x=1">Edit Location</a>
    <ul id="checklist-tools"><li><a href="/editloc?locID=L77"><strong>Edit Location</strong></a></li><li><a href="/edit"><strong>Edit Date and Effort</strong></a></li></ul>`, "https://ebird.org/checklist/S1");
  await load("js/eBird-checklist.js");
  const items = Array.from(document.querySelectorAll("#checklist-tools > li"), (li) => li.textContent);
  assert.deepEqual(items, ["Edit Location", "Manage Location", "Edit Date and Effort"]);
  assert.equal(document.querySelectorAll('a[href="/mylocations/edit/L77"]').length, 2);
});

test("region links come back when eBird re-renders its menus after load", async (t) => {
  const { document, load } = page(t, '<nav><ul class="SectionMenu-section-list"><li>Bar Charts</li></ul></nav>', "https://ebird.org/region/CH");
  await load("js/eBird-region.js");
  assert.equal(document.querySelectorAll("#zoziologie-rare-map").length, 1);
  document.querySelector("nav").innerHTML = '<ul class="SectionMenu-section-list"><li>Bar Charts</li></ul>';
  await wait(10);
  assert.equal(document.querySelectorAll("#zoziologie-rare-map").length, 1);
  assert.equal(new URL(document.querySelector("#zoziologie-rare-map").href).searchParams.get("r"), "CH");
});

test("file names drop the continue flag added by eBird's bot check", (t) => {
  const { window } = page(t, "", "https://ebird.org/targets?r1=CH&t2=life&continue");
  assert.equal(window.Zoziologie.pageQuery(), "r1=CH&t2=life");
});

test("Macaulay saves through the background when allowed and opens a tab otherwise", async (t) => {
  const html = '<img src="https://cdn.download.ams.birds.cornell.edu/api/v2/asset/123/1200"><div class="actions"></div>';
  const messages = [];
  const allowed = page(t, html, "https://macaulaylibrary.org/asset/123", { chrome: { runtime: { onMessage: { addListener() {} }, sendMessage: async (message) => { messages.push(JSON.parse(JSON.stringify(message))); return { ok: true }; } } } });
  let opened = [];
  allowed.window.open = (...args) => opened.push(args);
  await allowed.load("js/macaulaylibrary.js");
  // Macaulay's analytics decorates link addresses; the saved address must stay clean.
  allowed.document.querySelector("#zoziologie-ml-download").href += "?_gl=1*abc";
  allowed.document.querySelector("#zoziologie-ml-download").dispatchEvent(new allowed.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  await tick();
  assert.deepEqual(messages, [{ type: "zoziologie:download", url: "https://cdn.download.ams.birds.cornell.edu/api/v2/asset/123/2400", filename: "ML123.jpg" }]);
  assert.deepEqual(allowed.notes, ["Saving ML123.jpg"]);
  assert.equal(opened.length, 0);

  const blocked = page(t, html, "https://macaulaylibrary.org/asset/123", { chrome: { runtime: { onMessage: { addListener() {} }, sendMessage: async () => ({ ok: false, reason: "permission" }) } } });
  opened = [];
  blocked.window.open = (...args) => opened.push(args);
  await blocked.load("js/macaulaylibrary.js");
  const link = blocked.document.querySelector("#zoziologie-ml-download");
  link.dispatchEvent(new blocked.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  await tick();
  assert.deepEqual(opened, [["https://cdn.download.ams.birds.cornell.edu/api/v2/asset/123/2400", "_blank", "noopener"]]);
  assert.match(blocked.notes[0], /Allow downloads/);
  const modified = new blocked.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true });
  link.dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false);
});

test("background saves only Macaulay media under ML names and only with the permission", async () => {
  const { runInNewContext } = require("node:vm");
  let listener;
  const downloads = [];
  let granted = true;
  const chrome = {
    runtime: { id: "zoz", onMessage: { addListener: (fn) => { listener = fn; } } },
    permissions: { contains: async () => granted },
    downloads: { download: async (options) => { downloads.push(JSON.parse(JSON.stringify(options))); return 1; } },
  };
  runInNewContext(source("js/background.js"), { chrome });
  const send = (message, sender = { id: "zoz" }) => new Promise((resolve) => {
    const async = listener(message, sender, (response) => resolve(JSON.parse(JSON.stringify(response))));
    if (!async) resolve("ignored");
  });
  const url = "https://cdn.download.ams.birds.cornell.edu/api/v2/asset/123/2400";
  assert.deepEqual(await send({ type: "zoziologie:download", url, filename: "ML123.jpg" }), { ok: true });
  assert.deepEqual(downloads, [{ url, filename: "ML123.jpg", conflictAction: "uniquify", saveAs: false }]);
  assert.deepEqual(await send({ type: "zoziologie:download", url: "https://example.org/x", filename: "ML123.jpg" }), { ok: false, reason: "invalid" });
  assert.deepEqual(await send({ type: "zoziologie:download", url, filename: "../evil.exe" }), { ok: false, reason: "invalid" });
  assert.equal(await send({ type: "zoziologie:download", url, filename: "ML123.jpg" }, { id: "other" }), "ignored");
  granted = false;
  assert.deepEqual(await send({ type: "zoziologie:download", url, filename: "ML123.jpg" }), { ok: false, reason: "permission" });
  assert.equal(downloads.length, 1);
});

test("Biolovision species exports handle missing optional fields and breeding labels", async (t) => {
  const { document, downloads, load } = page(t, `<div class="box flex-box"></div>
    <div class="rowlight"><div class="text-right col-sm-1">31</div><b>Goose</b><i>06.01.2020</i><i>certain</i><a href="/observations"><span class="ba-list"></span></a></div>`, "https://www.ornitho.ch/index.php?sp_FChoice=species");
  await load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
  await tick();
  document.querySelector("#zoziology-export").click();
  await tick();
  assert.deepEqual(downloads[0][0][0], { number: 31, common_name: "Goose", scientific_name: "", latest_date: "06.01.2020", breeding: "certain", link_observation: "https://www.ornitho.ch/observations", link_stat: "", link_info: "" });
});

test("Biolovision summary preserves column order and links", async (t) => {
  const { document, downloads, load } = page(t, `<div class="box flex-box"></div>
    <div class="rowdark"><span><span id="summary-verification-icon"></span>&nbsp;~40&nbsp;<b>Geese</b></span><div class="col-sm-4"></div><div class="col-sm-4">2 Observers</div><div class="col-sm-4">2 places</div><a href="/photo"><i class="fa-camera"></i></a><a href="/observations"><em class="fas fa-sp-obs"></em></a><a href="/stats"><em class="fas fa-sp-graph"></em></a></div>`, "https://www.ornitho.ch/index.php?sp_FChoice=synth");
  await load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
  await tick();
  document.querySelector("#zoziology-export").click();
  await tick();
  assert.deepEqual(downloads[0][0][0], { number: "~40", common_name: "Geese", observers: "2 Observers", place: "2 places", link_photo: "https://www.ornitho.ch/photo", link_observations: "https://www.ornitho.ch/observations", link_stat: "https://www.ornitho.ch/stats", link_info: "" });
});

test("Biolovision grid lookup encodes the query and leaves a usable result link", async (t) => {
  const { window, document, load } = page(t, '<div class="box"></div><div class="no_access"></div><span id="polygon_code_name">E085 N655</span><div id="gsearch"><a href="/index.php?sp_Polygon=old&sp_S=0">Search</a></div>', "https://www.ornitho.ch/index.php?m_id=620");
  let opened;
  window.HTMLAnchorElement.prototype.click = function () { opened = this.href; };
  window.fetch = async (url) => {
    assert.equal(new URL(url, window.location.href).searchParams.get("query"), "E085 N655");
    return { ok: true, text: async () => '<results><name id="4512">Grid</name></results>' };
  };
  await load("js/biolovision.js");
  document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await tick();
  document.querySelector("#zoziology-grid-open").click();
  await tick();
  const url = new URL(opened);
  assert.equal(url.searchParams.get("sp_Grid"), "4512");
  assert.equal(url.searchParams.get("sp_Grid_Info"), "E085 N655");
  assert.equal(url.searchParams.get("sp_SChoice"), "all");
  assert.equal(url.searchParams.has("sp_Polygon"), false);
  assert.equal(document.querySelector("#zoziology-grid-open").tagName, "A");
  assert.equal(document.querySelector(".no_access"), null);
});

test("Macaulay detects photos and sounds from the page, not from the word microphone", async (t) => {
  for (const [media, expected, label] of [
    ['<img src="https://cdn.download.ams.birds.cornell.edu/api/v2/asset/123/1200">', "/api/v2/asset/123/2400", "Download 2400px"],
    ["<audio></audio>", "/api/v2/asset/123/mp3", "Download MP3"],
  ]) {
    const { document, load } = page(t, `<script type="application/json">{"microphone":12}</script>${media}<div class="actions"></div>`, "https://macaulaylibrary.org/asset/123");
    await load("js/macaulaylibrary.js");
    const link = document.querySelector("#zoziologie-ml-download");
    assert.equal(new URL(link.href).pathname, expected);
    assert.equal(link.textContent.trim(), label);
    assert.equal(link.rel, "noopener");
  }
});

test("Macaulay waits for late-rendered pages, survives re-renders and leaves videos alone", async (t) => {
  const late = page(t, "<main></main>", "https://www.macaulaylibrary.org/asset/456");
  await late.load("js/macaulaylibrary.js");
  assert.equal(late.document.querySelector("#zoziologie-ml-download"), null);
  late.document.querySelector("main").innerHTML = '<header><div class="actions"></div></header><img src="https://cdn.download.ams.birds.cornell.edu/api/v2/asset/456/1200">';
  await wait(10);
  assert.equal(late.document.querySelectorAll("#zoziologie-ml-download").length, 1);
  // A re-rendered header loses the button; it comes back.
  late.document.querySelector("header").innerHTML = '<div class="actions"></div>';
  await wait(10);
  assert.equal(late.document.querySelectorAll("#zoziologie-ml-download").length, 1);

  const video = page(t, '<video></video><div class="actions"></div>', "https://macaulaylibrary.org/asset/789");
  await video.load("js/macaulaylibrary.js");
  assert.equal(video.document.querySelector("#zoziologie-ml-download"), null);
});

test("signed-out barcharts explain the login requirement without making a doomed request", async (t) => {
  const { window, document, errors, load } = page(t, '<a href="?forceLogin=true&r=FR">Sign In</a><div id="barchart-display"></div>', "https://ebird.org/barchart?r=FR&continue");
  window.fetch = () => assert.fail("signed-out JSON downloads redirect to a login origin");
  await load("js/eBird-barchart.js");
  document.querySelector("button").click();
  await tick();
  assert.match(errors[0], /Sign in to eBird/);
  assert.equal(document.querySelector("button").hasAttribute("aria-busy"), false);
});

function catalog() {
  const dom = new JSDOM("", { runScripts: "outside-only" });
  dom.window.eval(source("js/shared/features.js"));
  return dom.window.ZoziologieCatalog;
}

test("Biolovision portals match the catalog and every feature id used by a page script exists", () => {
  const { biolovisionHosts, features, featuresFor, siteFor } = catalog();
  const biolovision = manifest.content_scripts.find((entry) => entry.js.includes("js/biolovision.js"));
  assert.deepEqual(biolovision.matches, Array.from(biolovisionHosts, (host) => `*://${host}/*`));
  const ids = new Set(features.map((feature) => feature.id));
  for (const entry of manifest.content_scripts) {
    for (const script of entry.js.slice(1)) {
      for (const [, id] of source(script).matchAll(/feature\("([^"]+)"/g)) assert.ok(ids.has(id), `${script}: ${id}`);
    }
  }
  assert.deepEqual(Array.from(featuresFor("https://ebird.org/targets?r1=CH"), (feature) => feature.id), ["ebirdTargets", "ebirdRegionSearch"]);
  assert.deepEqual(Array.from(featuresFor("https://www.ornitho.ch/index.php?m_id=94&sp_FChoice=list"), (feature) => feature.id), ["biolovisionExport", "biolovisionTidy"]);
  assert.equal(siteFor("https://www.faune-alsace.org/"), undefined);
  assert.equal(siteFor("https://www.macaulaylibrary.org/asset/1").id, "macaulay");
});

test("features turned off in settings are not installed; the others still are", async (t) => {
  const { document, load } = page(t, `<div><button class="Button Button--small Button--hollow">Print</button></div>
    <div class="GridFlex-cell"><select id="targets-comparison-region"></select></div>`, "https://ebird.org/targets", { stored: { disabled: ["ebirdTargets"] } });
  await load("js/eBird-target.js");
  const labels = Array.from(document.querySelectorAll("button"), (button) => button.textContent);
  assert.ok(!labels.includes("Download (csv)"));
  assert.ok(labels.includes("Search regions"));
});

test("Biolovision tidy layout can be turned off without affecting exports", async (t) => {
  const { document, load } = page(t, `<ul><li id="8">Search</li><li id="1">Home</li></ul><div class="box flex-box"></div>`,
    "https://www.ornitho.ch/index.php?sp_FChoice=species", { stored: { disabled: ["biolovisionTidy"] } });
  await load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
  await tick();
  assert.equal(document.documentElement.classList.contains("zoziologie-tidy"), false);
  assert.equal(document.querySelectorAll("#zoziology-export").length, 1);
});

test("toasts render in a shadow root, announce errors and can be dismissed", (t) => {
  const dom = new JSDOM("<body></body>", { url: "https://ebird.org/", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  dom.window.eval(source("js/shared/core.js"));
  const toast = dom.window.Zoziologie.notify("Request failed <b>", { type: "error", timeout: 0 });
  const root = dom.window.document.querySelector("zoziologie-toasts").shadowRoot;
  const element = root.querySelector(".toast");
  assert.equal(element.getAttribute("role"), "alert");
  assert.equal(element.querySelector(".message").textContent, "Request failed <b>");
  toast.update("Changed");
  assert.equal(element.querySelector(".message").textContent, "Changed");
  root.querySelector("button").click();
  assert.equal(root.querySelector(".toast"), null);
});

async function popup(t, { url, ping = true, granted = true, stored = {} } = {}) {
  const html = source("popup/popup.html").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { url: "chrome-extension://test/popup/popup.html", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const calls = { reloaded: [], requested: [] };
  const { chrome, data } = fakeChrome(stored, {
    tabs: {
      query: async () => (url ? [{ id: 7, url }] : []),
      sendMessage: async () => { if (!ping) throw new Error("Receiving end does not exist."); return { active: true }; },
      reload: async (id) => calls.reloaded.push(id),
    },
    permissions: {
      contains: async () => granted,
      request: async (request) => { calls.requested.push(request.origins ?? request); return true; },
    },
  });
  dom.window.chrome = chrome;
  dom.window.close = () => {};
  for (const path of ["js/shared/features.js", "js/shared/core.js", "popup/popup.js"]) dom.window.eval(source(path));
  await wait(20);
  return { document: dom.window.document, window: dom.window, data, calls };
}

test("popup lists every feature, explains the current page and saves toggles", async (t) => {
  const { document, data, window } = await popup(t, { url: "https://ebird.org/targets?r1=CH" });
  assert.equal(document.querySelectorAll(".feature").length, catalog().features.length);
  assert.equal(document.querySelector("#version").textContent, `v${manifest.version}`);
  const here = document.querySelector("#here");
  assert.ok(here.classList.contains("ready"));
  assert.match(here.textContent, /Target list export/);
  assert.equal(document.querySelectorAll(".feature.current").length, 2);
  assert.equal(document.querySelector("#applybar").hidden, true);
  const toggle = document.querySelector("#feature-ebirdTargets");
  toggle.checked = false;
  toggle.dispatchEvent(new window.Event("change"));
  await wait(10);
  assert.deepEqual(Array.from(data.disabled), ["ebirdTargets"]);
  assert.equal(document.querySelector("#applybar").hidden, false);
  assert.match(here.textContent, /Target list export \(off\)/);
});

test("popup offers a reload when the tab predates the extension and access when it is blocked", async (t) => {
  const stale = await popup(t, { url: "https://www.ornitho.ch/index.php?m_id=1", ping: false });
  assert.match(stale.document.querySelector("#here").textContent, /Not running in this tab yet/);
  stale.document.querySelector("#here button").click();
  await wait(10);
  assert.deepEqual(stale.calls.reloaded, [7]);
  assert.deepEqual(stale.calls.requested, []);

  const blocked = await popup(t, { url: "https://ebird.org/checklist/S1", ping: false, granted: false });
  assert.match(blocked.document.querySelector("#here").textContent, /No access to ebird\.org/);
  blocked.document.querySelector("#here button").click();
  await wait(10);
  assert.deepEqual(Array.from(blocked.calls.requested[0]), ["*://ebird.org/*checklist/*"]);
  assert.deepEqual(blocked.calls.reloaded, [7]);
});

test("popup offers to allow downloads for Macaulay files and shows when it is granted", async (t) => {
  const { document, calls } = await popup(t, { url: "https://macaulaylibrary.org/asset/1", granted: false });
  const box = document.querySelector("#feature-macaulayDownload").closest(".feature").querySelector(".permission");
  assert.match(box.textContent, /Allow downloads/);
  box.querySelector("button").click();
  await wait(10);
  assert.deepEqual(Array.from(calls.requested.at(-1).permissions ?? []), ["downloads"]);
  assert.ok(box.classList.contains("granted"));
  assert.equal(box.querySelector("button").hidden, true);
});

test("popup gives a hint on unsupported pages and on site pages without tools", async (t) => {
  const none = await popup(t, { url: "https://example.org/" });
  assert.match(none.document.querySelector("#here").textContent, /Nothing to do on this page/);
  const home = await popup(t, { url: "https://ebird.org/home", ping: false });
  assert.match(home.document.querySelector("#here").textContent, /Open Targets/);
});
