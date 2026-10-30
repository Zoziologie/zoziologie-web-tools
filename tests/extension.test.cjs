const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { Script } = require("node:vm");
const { JSDOM } = require("jsdom");
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const source = (path) => readFileSync(path, "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function page(t, html = "", url = "https://ebird.org/targets") {
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const window = dom.window;
  const downloads = [];
  const errors = [];
  window.alert = (message) => errors.push(message);
  window.console.error = () => {};
  window.eval(source("js/shared/core.js"));
  window.Zoziologie.downloadCSV = (...args) => downloads.push(JSON.parse(JSON.stringify(args)));
  return { window, document: window.document, downloads, errors, load: (path) => window.eval(source(path)) };
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
    if (entry.js.length > 1) assert.equal(entry.js[0], "js/shared/core.js");
  }
  for (const icon of Object.values(manifest.icons)) assert.ok(existsSync(icon));
  assert.deepEqual(manifest.permissions, []);
});

test("CSV preserves commas, quotes, newlines, Unicode, false, zero and later columns", (t) => {
  const { window } = page(t);
  assert.equal(window.Zoziologie.csv([
    { name: 'Épervier, "test"\nline', number: 0, lifer: false },
    { name: "Bird", extra: "# & %", number: null },
  ]), 'name,number,lifer,extra\r\n"Épervier, ""test""\nline",0,false,\r\nBird,,,# & %');
  assert.equal(window.Zoziologie.csv([{ b: 2, a: 1 }], ["a", "b"]), "a,b\r\n1,2");
});

test("downloads use UTF-8 Blob URLs and release them", (t) => {
  const { window, load } = page(t);
  load("js/shared/core.js");
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
  cleanup();
  assert.throws(() => window.Zoziologie.downloadCSV([], "empty"), /No data/);
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
  load("js/eBird-target.js");
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
  load("js/eBird-target.js");
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
  const { window, document, downloads, load } = page(t, '<div class="ReportMetaTools"></div><h1 class="ReportTitle-name">My Trip</h1>', "https://ebird.org/tripreport/123/456");
  const urls = [];
  window.fetch = async (url) => {
    urls.push(url);
    const data = url.includes("taxon-list") ? [{ speciesCode: "a" }, { speciesCode: "b" }] : { checklists: [{ subId: url.includes("/a?") ? "S1" : "S2" }] };
    return { ok: true, json: async () => data };
  };
  load("js/eBird-tripreport.js");
  document.querySelector("#zoziology-tripreport-observation").click();
  await tick();
  assert.equal(downloads[0][1], "my_trip_observations");
  assert.deepEqual(downloads[0][0].map((row) => [row.speciesCode, row.subId]), [["a", "S1"], ["b", "S2"]]);
  assert.ok(urls.every((url) => url.endsWith("?tripReportPersonId=456")));
  assert.equal(window.detail, undefined);
});

test("trip reports export one species and report empty checklists", async (t) => {
  const { window, document, downloads, errors, load } = page(t, '<div class="ReportMetaTools"></div><h1 class="ReportTitle-name">Trip</h1>', "https://ebird.org/tripreport/123");
  window.fetch = async (url) => ({ ok: true, json: async () => url.includes("taxon-list") ? [{ speciesCode: "a", numIndividuals: 0 }] : [] });
  load("js/eBird-tripreport.js");
  document.querySelector("#zoziology-tripreport-species").click();
  await tick();
  assert.equal(downloads[0][0].length, 1);
  load("js/shared/core.js");
  document.querySelector("#zoziology-tripreport-checklist").click();
  await tick();
  assert.match(errors[0], /No data/);
});

test("barchart exports a single taxon, normalization and all 48 periods", async (t) => {
  const { window, document, downloads, load } = page(t, '<div id="barchart-display"></div>', "https://ebird.org/barchart?r=FR&fmt=old");
  window.fetch = async (url) => {
    assert.equal(url.searchParams.getAll("fmt").length, 1);
    assert.equal(url.searchParams.get("fmt"), "json");
    return { ok: true, json: async () => ({ dataRows: [{ taxon: { speciesCode: "bird", commonName: 'Bird "one"' }, values: Array(48).fill(0.1), values_N: Array(48).fill(10) }] }) };
  };
  load("js/eBird-barchart.js");
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
  load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
  document.querySelector("#zoziology-export").click();
  await tick();
  assert.equal(downloads[0][0][0].date, "vendredi, 6 décembre 2024");
  assert.equal(downloads[0][0][0].remark, "A, B\nC");
  assert.equal(downloads[0][0][0].place_link, "https://www.ornitho.ch/place");
});

test("Biolovision installs dynamic export controls once", async (t) => {
  const { document, load } = page(t, "", "https://www.ornitho.ch/index.php?sp_FChoice=species");
  load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
  document.body.insertAdjacentHTML("beforeend", '<div class="box flex-box"></div>');
  await wait(200);
  assert.equal(document.querySelectorAll("#zoziology-export").length, 1);
  document.body.append(document.createElement("section"));
  await wait(200);
  assert.equal(document.querySelectorAll("#zoziology-export").length, 1);
});

test("page scripts tolerate absent site controls", (t) => {
  for (const entry of manifest.content_scripts) {
    const { load } = page(t);
    for (const script of entry.js) load(script);
  }
});

test("region map keeps US and Canada state codes and uses country elsewhere", (t) => {
  for (const [region, expected] of [["US-CA-001", "US-CA"], ["CA-QC", "CA-QC"], ["FR-IDF", "FR"]]) {
    const { document, load } = page(t, '<ul class="SectionMenu-section-list"></ul>', `https://ebird.org/region/${region}`);
    load("js/eBird-region.js");
    assert.equal(new URL(document.querySelector("a").href).searchParams.get("r"), expected);
    assert.equal(document.querySelector("a b").textContent, "Rare Bird Map");
  }
});

test("checklist copy works when clicking inside SVG and both location links are added", async (t) => {
  const { window, document, load } = page(t, `
    <div class="Observation" id="obs-123"><div class="Observation-species">Bird</div></div>
    <a href="/editloc?locID=L123&other=value">Edit Location</a>
    <div id="checklist-tools"><ul><li>Existing action</li></ul></div>`, "https://ebird.org/checklist/S123?view=all#old");
  let copied;
  window.navigator.clipboard = { writeText: async (text) => { copied = text; } };
  load("js/eBird-checklist.js");
  document.querySelector(".zoziology-ebird-link svg").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await tick();
  assert.equal(copied, "https://ebird.org/checklist/S123?view=all#obs-123");
  assert.equal(document.querySelectorAll('a[href="/mylocations/edit/L123"]').length, 2);
  assert.equal(document.querySelector("#zoziologie-copied").textContent, "Copied to clipboard.");
});

test("Biolovision species exports handle missing optional fields and breeding labels", async (t) => {
  const { document, downloads, load } = page(t, `<div class="box flex-box"></div>
    <div class="rowlight"><div class="text-right col-sm-1">31</div><b>Goose</b><i>06.01.2020</i><i>certain</i><a href="/observations"><span class="ba-list"></span></a></div>`, "https://www.ornitho.ch/index.php?sp_FChoice=species");
  load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
  document.querySelector("#zoziology-export").click();
  await tick();
  assert.deepEqual(downloads[0][0][0], { number: 31, common_name: "Goose", scientific_name: "", latest_date: "06.01.2020", breeding: "certain", link_observation: "https://www.ornitho.ch/observations", link_stat: "", link_info: "" });
});

test("Biolovision summary preserves column order and links", async (t) => {
  const { document, downloads, load } = page(t, `<div class="box flex-box"></div>
    <div class="rowdark"><span><span id="summary-verification-icon"></span>&nbsp;~40&nbsp;<b>Geese</b></span><div class="col-sm-4"></div><div class="col-sm-4">2 Observers</div><div class="col-sm-4">2 places</div><a href="/photo"><i class="fa-camera"></i></a><a href="/observations"><em class="fas fa-sp-obs"></em></a><a href="/stats"><em class="fas fa-sp-graph"></em></a></div>`, "https://www.ornitho.ch/index.php?sp_FChoice=synth");
  load("js/biolovision.js");
  document.dispatchEvent(new document.defaultView.Event("DOMContentLoaded"));
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
  load("js/biolovision.js");
  document.dispatchEvent(new window.Event("DOMContentLoaded"));
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

test("Macaulay photo and audio URLs retain their respective resolutions", (t) => {
  for (const [label, suffix] of [["Photo", "/2400"], ["Microphone", ""]]) {
    const { document, load } = page(t, `<main>${label}</main><div class="actions"></div>`, "https://macaulaylibrary.org/asset/123");
    load("js/macaulaylibrary.js");
    const link = document.querySelector("a");
    assert.equal(link.href, `https://cdn.download.ams.birds.cornell.edu/api/v1/asset/123${suffix}`);
    assert.equal(link.rel, "noopener");
  }
});

test("signed-out barcharts explain the login requirement without making a doomed request", async (t) => {
  const { window, document, errors, load } = page(t, '<a href="?forceLogin=true&r=FR">Sign In</a><div id="barchart-display"></div>', "https://ebird.org/barchart?r=FR&continue");
  window.fetch = () => assert.fail("signed-out JSON downloads redirect to a login origin");
  load("js/eBird-barchart.js");
  document.querySelector("button").click();
  await tick();
  assert.match(errors[0], /Sign in to eBird/);
  assert.equal(document.querySelector("button").hasAttribute("aria-busy"), false);
});
