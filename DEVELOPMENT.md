# Development

Zoziologie is a Manifest V3 content-script extension for Chrome and Firefox, built from one source folder and one manifest. Keep it small: plain JavaScript, no bundler, and no runtime dependencies. The only background script saves Macaulay files (see below). Node and npm are only needed for tests, linting and packaging.

## Layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Website matching, content-script order, popup, permissions, icons, and Firefox settings |
| `js/shared/core.js` | Settings, CSV serialization, Blob downloads, toasts, HTTP errors, action state, and bounded concurrent requests |
| `js/shared/features.js` | Feature catalog (ids, names, help text, page tests) and the Biolovision portal list; used by the popup and tests |
| `popup/` | Toolbar menu: status of the current tab and feature switches |
| `js/eBird-*.js` | One independently scoped script per eBird page feature |
| `js/biolovision.js` | Biolovision exports, menus, grid lookup, and dynamic controls |
| `js/macaulaylibrary.js` | Media download link |
| `js/background.js` | Saves Macaulay media as `ML<number>.jpg/.mp3` with the optional `downloads` permission |
| `css/biolovision-hide.css` | Hide decorative page elements before rendering |
| `logo/` | Extension icons |
| `assets/` | README and store images; not needed in a release package. `assets/store/` is generated, `assets/raw/` holds the page captures it is built from |
| `scripts/screenshots.mjs` | Builds the 1280×800 store screenshots (`npm run screenshots`) |
| `.claude/skills/store-screenshots/` | How Claude recaptures the raw pages in a signed-in Chrome and republishes the screenshots |
| `tests/extension.test.cjs` | DOM fixtures, mocked API responses, and manifest checks |

Every manifest entry loads `js/shared/core.js` first. Content scripts share the `Zoziologie` namespace in the extension's isolated world; `core.js` only initialises once per page. Each feature keeps its other variables inside an immediately invoked function.

To add a feature:

1. Add an entry to `js/shared/features.js` (id, site, name, one-line `how`, optional `open` link, `test(url)` for the pages where it appears).
2. Create its page script and wrap the work in `Zoziologie.feature("<id>", () => { ... })`, so the popup switch can turn it off.
3. Add a narrowly matched manifest entry with `js/shared/core.js` first.
4. Use `Zoziologie.runAction` for buttons (busy state, errors as toasts) and `Zoziologie.downloadCSV` for files. Build HTML from static strings or with DOM methods; never interpolate page data into `innerHTML` (Firefox review flags it).

## Settings

Settings live in `storage.sync` as `{ disabled: [featureIds] }`. `Zoziologie.settings` resolves to them, with defaults when storage is unavailable (tests). Content scripts read them once per page load. The popup writes them with `Zoziologie.saveSettings` and offers to reload the tab, since controls are added at page load. Biolovision's tidy layout is a class on `<html>` added at document start and removed if the setting is off, so banners never flash.

The popup asks the content script in the active tab whether it is running (`zoziologie:ping`). If a supported page does not answer, it offers either a reload (tab opened before install or update) or a site-access request (`permissions.request` with that host's manifest patterns). `activeTab` lets the popup read the current tab's address only when it is opened.

Pages that re-render after load (eBird region and location menus) use `Zoziologie.keep(insert)`: `insert` runs now and on DOM changes for 10 s, and must do nothing when its element already exists. File names use `Zoziologie.pageQuery()`, which drops the `continue` flag eBird's bot check adds to addresses.

## Macaulay downloads

Cornell's media CDN sends no CORS headers, so a cross-origin `<a download>` only opens the file, and content scripts cannot fetch it. The content script therefore asks `js/background.js` to call `downloads.download` with the name `ML<number>.jpg` or `.mp3`. The background accepts only `cdn.download.ams.birds.cornell.edu/api/v2/asset/<id>/2400|mp3` addresses and `ML<digits>.jpg|mp3` names from the extension's own scripts. The content script sends its own copy of the address, because Macaulay's analytics adds a `?_gl=` parameter to link addresses on the page.

`downloads` is an optional permission, so updating does not add an install warning or disable the extension in Chrome. The popup's **Allow downloads** button requests it; until then the link opens the file in a new tab and a toast explains how to allow it. The media type comes from the page (an `<audio>` player or spectrogram means sound; an image of that asset means photo; videos get no button), not from page text: every asset page mentions "microphone" in its embedded data.

The manifest lists the background file under both `service_worker` (Chrome) and `scripts` (Firefox). `web-ext lint` reports one expected warning that Firefox does not support `service_worker`.

## Biolovision portals

Regional French portals were merged in recent years; old domains such as faune-alsace.org or faune-lr.org now redirect to hosts the extension must list explicitly. The list in `js/shared/features.js` must equal the Biolovision `matches` in `manifest.json` (a test enforces this). To re-check it, request each host and look for a redirect to an unlisted host, and for a working result list (`index.php?m_id=94&...&sp_FChoice=species`). On 18 November 2026 all 30 listed portals answered, and faune-martinique.org only showed a placeholder page, so it was dropped.

## Checks

Use Node 22.12 or newer:

```sh
npm ci
npm run check
npm run lint:firefox   # Mozilla's validator (web-ext lint); one expected background warning
```

The checks parse every manifest script, verify referenced files, and exercise CSV encoding, downloads, empty and single-row results, trip participants, request concurrency, failures, region search cancellation, and dynamic Biolovision controls. GitHub Actions runs them on pushes and pull requests. Test fixtures are local and do not need user credentials or network requests.

The extension does not depend on `node_modules`; do not include it in uploads.

## Firefox

The same folder runs in Firefox 140 or newer. `browser_specific_settings.gecko` holds the add-on id `zoziologie-web-tools@raphaelnussbaumer.com` (permanent once published on addons.mozilla.org) and declares that no data is collected (`data_collection_permissions: none`), as AMO requires for new add-ons. Chrome ignores this key.

To try it: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and select `manifest.json`. It stays loaded until Firefox restarts. Firefox may ask to allow the extension on the supported sites; the toolbar menu also offers this per site.

Firefox MV3 content scripts make page-context requests like Chrome, so the relative eBird and Biolovision requests and Blob downloads use the same code.

## Integration choices

Export schemas and existing filenames are retained, with shared filename sanitization. CSV now preserves embedded newlines and punctuation. Biolovision list dates remain as displayed on the source page instead of passing through browser-dependent date parsing. Consumers needing dates should parse that field using the site's language.

Trip observation details use at most six simultaneous requests and retain species order. A failed response stops new requests and reports the error instead of downloading a partial file. No API results are cached, so a repeated export reflects the current trip.

Region search waits 250 ms after input and requires three characters. Changing the query or closing the search cancels the previous request. Region names are inserted as text, and selecting one updates the original select and emits a change event. The region finder retains the API key from the existing integration.

Biolovision styles load at document start; DOM changes wait until DOMContentLoaded. A debounced observer watches added elements to restore controls when the website replaces them. Grid lookup leaves an ordinary link available if Chrome blocks opening a new tab after the asynchronous request.

These features rely on the websites' markup and, for eBird exports, internal endpoints. Fixture tests cannot prove compatibility with future site changes. When a site changes, update the affected selector or response handling and its corresponding fixture.

## Manual browser checks

Load this folder using **Load unpacked** in `chrome://extensions` (or as a temporary add-on in Firefox, see above). Reload the extension after edits, then refresh website tabs so they receive the new scripts. Check the following with an account where needed:

- Targets: export native, exotic, and hybrid entries; try one result and an empty result. Search for a comparison region, select it with the mouse or keyboard, and submit the target form.
- Trip reports: export species, checklists, and observations; repeat on a participant-specific URL. Confirm the selected participant's data and optional fields in a spreadsheet or CSV reader.
- Barcharts: confirm the normalization row, the five metadata columns, and all 48 periods.
- Checklists: copy a species link by clicking its icon and open that URL; try both Manage Location links.
- Locations and regions: follow Target List, View in my eBird, and Rare Bird Map; check a US state, a Canadian province, and a country elsewhere.
- Macaulay Library: check a photo and an audio asset, including a URL on the `www` hostname.
- Biolovision: export species, summary, and observation lists; check names and remarks containing commas, quotes, accents, and line breaks. Navigate to module 620 and follow the grid link. Confirm dynamically replaced controls appear only once.
- Simulate an offline or failed API response and confirm an error appears and the export can be retried.
- Toolbar menu: on a Targets page it shows "Active on this eBird page"; on a tab opened before reloading the extension it offers Reload page. Turn a tool off, reload the page and confirm its control is gone.
- Repeat the export checks once in Firefox (temporary add-on), including a download and the clipboard link on a checklist.

## Store screenshots

`npm run screenshots` turns the captures in `assets/raw/` into the five 1280×800 screenshots and the two Chrome Web Store promo tiles (440×280 and 1400×560) in `assets/store/`. The toolbar menu image is rendered from `popup/popup.html` with stubbed browser APIs, so it follows the code. Each scene in `scripts/screenshots.mjs` sets its capture, the crop anchor and amber boxes around the extension's controls. The raw captures need a signed-in browser (eBird's bot check and account pages), so they are retaken by hand or by Claude following `.claude/skills/store-screenshots/SKILL.md`; ask Claude to "update the store screenshots".

## Release

Complete the automated and manual checks, update the version in `manifest.json` and `package.json`, and refresh the lockfile with `npm install --package-lock-only`. Package only runtime files:

```sh
npm run package       # zoziologie.zip with manifest.json, js, css, logo and popup
npm run screenshots   # if the pages or menu changed: refresh assets/store/
```

Upload the same ZIP to the Chrome Web Store (existing listing) and to addons.mozilla.org. AMO asks for source code only for minified or generated files; this extension ships its sources as is. Installation and releases remain manual.

## Browser validation — 30 October 2026

Tested the unpacked extension in Chrome for Testing and in the existing signed-in Chrome profile. Verified actual downloaded CSV files, rather than only the presence of buttons:

- Targets: 340 rows, including 52 hybrids and all four origin categories; live region search returned eight matches for Canada.
- Barchart: 931 data rows including normalization, with 53 columns in every row. Signed-out downloads now explain that eBird sign-in is required.
- Trip report: species (87 rows), checklists (12 rows), and observations (224 rows), with no extension errors.
- Biolovision: summary, observation-list, and single-species downloads; verified original date labels and corrected observation/statistics links for the current `fa-sp-obs` and `fa-sp-graph` icons. Empty results show an informative message.
- Public checklist: observation link copied successfully. Public region: Rare Bird Map link inserted correctly.

Macaulay Library asset controls, participant-specific trip exports, owner-only location controls, and grid lookup were not fully verified live during this pass. Their fixture checks pass. Chrome site access must be granted for each tested domain, and the extension must be reloaded after changing source files.

## Browser validation — 18 November 2026

Automated with puppeteer-core and the unpacked extension in Chrome for Testing:

- faune-france.org and the newly added faune-occitanie.org: export control and tidy layout present; species export downloaded a 264-row CSV with BOM, named `faune-occitanie.org_species_2026-11-18.csv`, and the toast reported the row count.
- Popup: rendered all 10 features, reached the content script with `zoziologie:ping`, saved settings to `storage.sync`; turning off Result exports removed the control after reload.
- Popup layout checked in light and dark mode for the active, feature-off, stale-tab, blocked-site and unsupported-page states.

Not verified live: eBird and Macaulay Library pages now show a bot-check page to automated browsers, so those features were checked with fixtures only; sign-in-only pages (Targets, bar charts, trip reports) need a manual check in a signed-in browser. Firefox passed `web-ext lint` with no warnings, but could not be started from the development environment, so a manual Firefox run is still needed.


## Signed-in Chrome validation — 19 November 2026

In a signed-in Chrome profile with the unpacked extension (after eBird's bot check cleared on its own):

- Targets (Switzerland, world life list): 81 rows with exotic categories and hybrids; region search found Vaud and set `r2=CH-VD`.
- Trip report: species (116 rows), checklists (40, including the new subnational2 columns) and observations (430, with progress toast and `obsComments`).
- Bar chart (Switzerland 2020–2026): normalisation row plus 574 species, 53 columns each.
- Checklist: copy-link buttons; Manage Location in the header and right after Edit Location in eBird's tools list. Region (CH, CH-VD, DE, FR, US-NY) and location shortcuts present on repeated loads.
- Macaulay Library: without the downloads permission the link opened the 2400 px image in a new tab; with it, the photo saved as `ML664758856.jpg` (2400×1800 JPEG) and the sound as `ML664727511.mp3`.
