---
name: store-screenshots
description: Recreate the 1280×800 store screenshots of Zoziologie Web Tools (Chrome Web Store, Firefox Add-ons, README) after a release. Use when asked to update, redo or refresh the screenshots, store images or listing media.
---

# Store screenshots

The images in `assets/store/` are built by `npm run screenshots` (`scripts/screenshots.mjs`) from raw page captures in `assets/raw/`. The toolbar menu is rendered from `popup/popup.html` by the script itself, so it always matches the code. The raw captures must come from the user's own signed-in Chrome: eBird and Macaulay Library show a bot check to automated browsers, and Targets, trip reports and bar charts need an eBird account.

## 1. Prepare

- The user's Chrome must run the current code: ask them to click ↻ on Zoziologie Web Tools in `chrome://extensions` if anything changed since their last reload.
- Use Claude in Chrome in a new tab of the session's group. Never navigate or resize a tab the user is working in.
- Do not click anything that saves a file (exports, Download 2400px/MP3): it would add files to the user's Downloads.

## 2. Capture each raw image

For every capture: wait until the page has settled, measure the extension's controls with `getBoundingClientRect()` (rounded `[x, y, width, height]`), move the pointer out of the kept area (the screenshot tool draws it; for scenes cropped from the left, hover at x ≈ viewport width − 8), then take a full-scale screenshot with `save_to_disk: true` (no `scale`). Copy the saved JPEG to `assets/raw/<name>.jpg`.

| Raw file | Page | Before capturing |
| --- | --- | --- |
| `ebird-targets.jpg` | `https://ebird.org/targets?r1=CH&bmo=1&emo=12&r2=world&t2=life` | Scroll to top. Measure the "Search regions" and "Download (csv)" buttons. |
| `ebird-tripreport.jpg` | One of the user's trip reports from `https://ebird.org/mytripreports` (ask which; last time 570508) | Click the extension's "Download (csv)" button to open the menu, then measure the button plus the open panel together. |
| `macaulay-photo.jpg` | One of the user's own Macaulay photos (avoids image-rights questions; last time ML664758856) | Scroll so the photo and the actions bar both show. Measure `#zoziologie-ml-download`. |
| `biolovision-species.jpg` | `https://www.faune-france.org/index.php?m_id=94&p_c=duration&p_cc=-1&sp_tg=1&sp_DChoice=offset&sp_DOffset=3&sp_SChoice=all&sp_PChoice=all&sp_FChoice=species` | **Hide the user's name, email and avatar** in the header: walk text nodes for their name or `@` and set `visibility:hidden` on the parent, plus avatar images in the top-left corner. Check that `document.body.innerText` no longer contains them. Measure the Export row (`#zoziology-export` and its label). |

Check every capture for personal data (email addresses, private notes) before using it; the trip report and Macaulay pages show the user's public name, which they accepted.

## 3. Render and review

1. Put the measured boxes into `highlight` of the matching entries in `SCENES` at the top of `scripts/screenshots.mjs`. Adjust `position` if the crop cuts something important (`left top` keeps the left edge).
2. Run `npm run screenshots` (uses Google Chrome, or `CHROME_PATH`).
3. Look at every file in `assets/store/`: highlights on the right controls, no pointer, nothing important cropped, no personal data.

## 4. Publish

- **Firefox Add-ons:** with Claude in Chrome, open `https://addons.mozilla.org/en-US/developers/addon/zoziologie-web-tools/edit`, section Images/Media, remove outdated screenshots and upload the new ones (file inputs accept the paths directly). Confirm with the user before saving, since it changes the public listing.
- **Chrome Web Store:** Chrome blocks every extension, and the app's built-in browser refuses Web Store pages, so the user uploads them: Store listing → Graphic assets → Screenshots (1280×800, up to 5).
- Commit `assets/raw/`, `assets/store/` and any `SCENES` changes.
