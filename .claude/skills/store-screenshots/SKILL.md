---
name: store-screenshots
description: Recreate the store screenshots (1280×800) and Chrome Web Store promo tiles (440×280, 1400×560) of Zoziologie Web Tools for the Chrome Web Store, Firefox Add-ons and README. Use when asked to update, redo or refresh the screenshots, promo tiles, store images or listing media.
---

# Store screenshots

The images in `assets/store/` (five screenshots, two promo tiles and the README's `toolbar-menu.png`) are built by `npm run screenshots` (`scripts/screenshots.mjs`) from raw page captures in `assets/raw/`. The toolbar menu is rendered from `popup/popup.html` by the script itself, so it always matches the code. The raw captures must come from the user's own signed-in Chrome: eBird and Macaulay Library show a bot check to automated browsers, and Targets, trip reports and bar charts need an eBird account.

## 1. Prepare

- The user's Chrome must run the current code: ask them to click ↻ on Zoziologie Web Tools in `chrome://extensions` if anything changed since their last reload.
- Use Claude in Chrome in a new tab of the session's group. Never navigate or resize a tab the user is working in.
- Do not click anything that saves a file (exports, Download 2400px/MP3): it would add files to the user's Downloads.

## 2. Capture each raw image

For every capture: wait until the page has settled, measure the extension's controls with `getBoundingClientRect()` (rounded `[x, y, width, height]`), park the pointer where the crop will remove it, then take a full-scale screenshot with `save_to_disk: true` (never with `scale`, which saves a small image). Copy the saved JPEG to `assets/raw/<name>.jpg`.

The screenshot tool draws its own pointer (CSS `cursor: none` does not hide it). The crop removes a strip on one side when the capture is wider than 16:10: hover at x ≈ viewport width − 5 for scenes anchored `left top` or centred, and at x ≈ 5 for scenes anchored `right top`.

| Raw file | Scene | Page | Before capturing |
| --- | --- | --- | --- |
| `ebird-barchart.jpg` | 1, toolbar menu (anchored `right top`) | `https://ebird.org/barchart?r=OM&bmo=1&emo=12&byr=1900&eyr=2026` | Scroll to top; pointer at the left edge. The menu drawn over it is rendered for the bar chart address set in `SCENES`. |
| `ebird-targets.jpg` | 2 | `https://ebird.org/targets?r1=CH&bmo=1&emo=12&r2=world&t2=life` | Scroll to top. Measure "Search regions" and "Download (csv)". |
| `ebird-tripreport.jpg` | 3 | The user's Oman trip report "Oh man!", `https://ebird.org/tripreport/468402` (the user's favourite; ask if they prefer another) | Click the extension's "Download (csv)" to open its menu, then measure the button and open panel together. **Hide co-participants** (the user's family, including children): set `display:none` on the items of `.ReportMetaPeople-list` that do not contain the user's name, and remove the list's `::after` commas with a style rule. |
| `macaulay-photo.jpg` | 4, and the marquee tile | A striking photo by the user, currently the Common Hoopoe ML651847032 from the Oman trip | Scroll so the whole bird and the actions bar show (`scrollTo(0, 135)` last time). Measure `#zoziologie-ml-download`. To pick another photo, list `assetIds` from `/tripreport-internal/v1/taxon-detail/<trip>/<species>` and preview them from `https://cdn.download.ams.birds.cornell.edu/api/v2/asset/<id>/480`. |
| `biolovision-species.jpg` | 5 | `https://www.faune-france.org/index.php?m_id=94&p_c=duration&p_cc=-1&sp_tg=1&sp_DChoice=offset&sp_DOffset=3&sp_SChoice=all&sp_PChoice=all&sp_FChoice=species` | **Hide the user's name, email and avatar** in the header: walk text nodes for their name or `@` and set `visibility:hidden` on the parent, plus avatar images in the top-left corner. Check that `document.body.innerText` no longer contains them. Measure the Export row. |

Check every capture for personal data (email addresses, private notes) before using it; the trip report and Macaulay pages show the user's public name, which they accepted.

## 3. Render and review

1. Put the measured boxes into `highlight` of the matching entries in `SCENES` at the top of `scripts/screenshots.mjs`. Adjust `position` if the crop cuts something important (`left top` keeps the left edge).
2. Run `npm run screenshots` (uses Google Chrome, or `CHROME_PATH`).
3. Look at every file in `assets/store/`: highlights on the right controls, no pointer, nothing important cropped, no personal data, and no two images built on the same page.
4. The promo tiles (`promo-small.png` 440×280, `promo-marquee.png` 1400×560) are designed in `smallTile()` and `marqueeTile()`; the marquee frames scene 4. All outputs are 24-bit RGB without alpha, as the Chrome Web Store requires (`file assets/store/*.png` should say `RGB`).

## 4. Publish

- **Firefox Add-ons:** with Claude in Chrome, open `https://addons.mozilla.org/en-US/developers/addon/zoziologie-web-tools/edit`, section Images/Media, remove outdated screenshots and upload the new ones (file inputs accept the paths directly). Confirm with the user before saving, since it changes the public listing.
- **Chrome Web Store:** Chrome blocks every extension, and the app's built-in browser refuses Web Store pages, so the user uploads them: Store listing → Graphic assets → Screenshots (1280×800, up to 5), Small promo tile (`promo-small.png`) and Marquee promo tile (`promo-marquee.png`).
- Commit `assets/raw/`, `assets/store/` and any `SCENES` changes.
