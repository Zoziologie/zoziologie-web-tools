# Changelog

## Unreleased

- Targets: the region search box now has a proper input border and its result count no longer overlaps the Clear button; its hint says it finds countries, states and counties.
- `npm run screenshots` builds the store screenshots from page captures; see DEVELOPMENT.md.

## 5.9.0 — 19 November 2026

- **Toolbar menu.** Clicking the extension icon now explains every tool, grouped by website, shows whether the extension is active in the current tab and which tools apply there, and offers a reload or site access when it is not running.
- **Settings.** Turn each tool off individually, including Biolovision's tidy layout. Settings are stored with the browser profile (`storage` permission); `activeTab` lets the menu read the current tab's address when opened.
- **Firefox support** (140+): same code and manifest, with a Gecko add-on id and the required "no data collected" declaration. `web-ext lint` passes with no warnings and runs in CI.
- **Biolovision portals updated.** Old French regional domains that now redirect (faune-alsace, faune-ain, faune-lr, faune-aquitaine, nature79, …) are replaced by the current portals (faune-occitanie, faune-paysdelaloire, faune-nouvelle-aquitaine, faune-bfc, faune-limousin, faune-indre-et-loire, faune-deux-sevres, faune-vienne). ornitho.lu and ornitho.pl now match their `www.` addresses, dabasdati.ornitho.lv and data.biolovision.net are added, and the faune-martinique placeholder is dropped: 30 portals in all.
- **Messages in the page** replace browser alert boxes: downloads report their row count, trip observation exports show progress, and errors can be dismissed.
- **Macaulay Library:** the button now appears on pages that render late or after a bot check, photo pages no longer get a "Download sound" link (the page text always mentions "microphone"), sounds download as MP3, and videos get no button. Optionally (after **Allow downloads** in the menu, an optional permission), files are saved directly as `ML<number>.jpg` / `.mp3` instead of opening in a tab.
- **eBird:** the Rare Bird Map and location links come back if eBird re-renders its menu after load (they sometimes vanished on region pages); "Manage Location" is added to eBird's new checklist tools menu; Targets and bar chart file names no longer end in `&continue`.
- Biolovision exports are named after the site, list type and date (for example `ornitho.ch_species_2026-11-18.csv`) instead of the full search address.
- Static markup only in `innerHTML`; fixed the 32 px icon, which was 48 px.
- 34 automated checks (was 20), covering settings, toasts, the popup, the portal list, Macaulay downloads and re-rendered eBird menus.

Reload the extension and refresh open tabs after updating.

## 5.8.1 — 30 October 2026

- Rename the extension to Zoziologie Web Tools and clarify its Chrome Web Store summary.

## 5.8.0 — 30 October 2026

- Rename the repository and development package to `zoziologie-web-tools`; retain the Zoziologie extension name and existing features.
- Share CSV serialization, Blob downloads, request handling, and action state across page scripts. Preserve quoted text, Unicode, embedded newlines, zero values, and optional columns.
- Fix empty and single-result exports, concurrent trip observation details, and Biolovision observation/statistics links on current pages.
- Debounce and cancel outdated region searches; limit trip detail requests to six at a time.
- Simplify page scripts, correct website matching, and improve keyboard controls and download errors.
- Preserve Biolovision list date labels and original remarks instead of relying on browser locale parsing.
- Add 20 regression checks, GitHub Actions, development instructions, and recorded live Chrome validation.

Reload the unpacked extension after updating, then refresh affected website tabs. If the local folder was renamed, remove the old unpacked entry and load the renamed folder from `chrome://extensions`. The Chrome Web Store listing requires a separate upload of this version.
