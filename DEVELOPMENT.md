# Development

Zoziologie is a Manifest V3 content-script extension. Keep it small: plain JavaScript, no bundler, no background service worker, and no runtime dependencies. Node and npm are only needed for tests.

## Layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Website matching, content-script order, and icons |
| `js/shared/core.js` | CSV serialization, Blob downloads, HTTP errors, action state, and bounded concurrent requests |
| `js/eBird-*.js` | One independently scoped script per eBird page feature |
| `js/biolovision.js` | Biolovision exports, menus, grid lookup, and dynamic controls |
| `js/macaulaylibrary.js` | Media download link |
| `css/biolovision-hide.css` | Hide decorative page elements before rendering |
| `logo/` | Extension icons |
| `assets/` | README screenshots; not needed in a release package |
| `tests/extension.test.cjs` | DOM fixtures, mocked API responses, and manifest checks |

Chrome loads shared utilities before each feature that uses them, as specified in `manifest.json`. Content scripts share the `Zoziologie` namespace in Chrome's isolated world. Each feature keeps its other variables inside an immediately invoked function. Add a feature by creating its page script and adding a narrowly matched manifest entry; put `js/shared/core.js` first if needed.

## Checks

Use Node 22.12 or newer:

```sh
npm ci
npm run check
```

The checks parse every manifest script, verify referenced files, and exercise CSV encoding, downloads, empty and single-row results, trip participants, request concurrency, failures, region search cancellation, and dynamic Biolovision controls. GitHub Actions runs them on pushes and pull requests. Test fixtures are local and do not need user credentials or network requests.

The extension does not depend on `node_modules`; do not include it in uploads.

## Integration choices

Export schemas and existing filenames are retained, with shared filename sanitization. CSV now preserves embedded newlines and punctuation. Biolovision list dates remain as displayed on the source page instead of passing through browser-dependent date parsing. Consumers needing dates should parse that field using the site's language.

Trip observation details use at most six simultaneous requests and retain species order. A failed response stops new requests and reports the error instead of downloading a partial file. No API results are cached, so a repeated export reflects the current trip.

Region search waits 250 ms after input and requires three characters. Changing the query or closing the search cancels the previous request. Region names are inserted as text, and selecting one updates the original select and emits a change event. The region finder retains the API key from the existing integration.

Biolovision styles load at document start; DOM changes wait until DOMContentLoaded. A debounced observer watches added elements to restore controls when the website replaces them. Grid lookup leaves an ordinary link available if Chrome blocks opening a new tab after the asynchronous request.

These features rely on the websites' markup and, for eBird exports, internal endpoints. Fixture tests cannot prove compatibility with future site changes. When a site changes, update the affected selector or response handling and its corresponding fixture.

## Manual browser checks

Load this folder using **Load unpacked** in `chrome://extensions`. Reload the extension after edits, then refresh website tabs so they receive the new scripts. Check the following with an account where needed:

- Targets: export native, exotic, and hybrid entries; try one result and an empty result. Search for a comparison region, select it with the mouse or keyboard, and submit the target form.
- Trip reports: export species, checklists, and observations; repeat on a participant-specific URL. Confirm the selected participant's data and optional fields in a spreadsheet or CSV reader.
- Barcharts: confirm the normalization row, the five metadata columns, and all 48 periods.
- Checklists: copy a species link by clicking its icon and open that URL; try both Manage Location links.
- Locations and regions: follow Target List, View in my eBird, and Rare Bird Map; check a US state, a Canadian province, and a country elsewhere.
- Macaulay Library: check a photo and an audio asset, including a URL on the `www` hostname.
- Biolovision: export species, summary, and observation lists; check names and remarks containing commas, quotes, accents, and line breaks. Navigate to module 620 and follow the grid link. Confirm dynamically replaced controls appear only once.
- Simulate an offline or failed API response and confirm an error appears and the export can be retried.

## Release

Complete the automated and manual checks, update the version in `manifest.json` and `package.json`, and refresh the lockfile with `npm install --package-lock-only`. Package only runtime files:

```sh
zip -r zoziologie.zip manifest.json js css logo
```

Upload the ZIP to the Chrome Web Store using the existing extension listing. Installation and releases remain manual.

## Browser validation — 30 October 2026

Tested the unpacked extension in Chrome for Testing and in the existing signed-in Chrome profile. Verified actual downloaded CSV files, rather than only the presence of buttons:

- Targets: 340 rows, including 52 hybrids and all four origin categories; live region search returned eight matches for Canada.
- Barchart: 931 data rows including normalization, with 53 columns in every row. Signed-out downloads now explain that eBird sign-in is required.
- Trip report: species (87 rows), checklists (12 rows), and observations (224 rows), with no extension errors.
- Biolovision: summary, observation-list, and single-species downloads; verified original date labels and corrected observation/statistics links for the current `fa-sp-obs` and `fa-sp-graph` icons. Empty results show an informative message.
- Public checklist: observation link copied successfully. Public region: Rare Bird Map link inserted correctly.

Macaulay Library asset controls, participant-specific trip exports, owner-only location controls, and grid lookup were not fully verified live during this pass. Their fixture checks pass. Chrome site access must be granted for each tested domain, and the extension must be reloaded after changing source files.
