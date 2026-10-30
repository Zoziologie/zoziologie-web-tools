# Changelog

## 5.8.0 — 30 October 2026

- Rename the repository and development package to `zoziologie-web-tools`; retain the Zoziologie extension name and existing features.
- Share CSV serialization, Blob downloads, request handling, and action state across page scripts. Preserve quoted text, Unicode, embedded newlines, zero values, and optional columns.
- Fix empty and single-result exports, concurrent trip observation details, and Biolovision observation/statistics links on current pages.
- Debounce and cancel outdated region searches; limit trip detail requests to six at a time.
- Simplify page scripts, correct website matching, and improve keyboard controls and download errors.
- Preserve Biolovision list date labels and original remarks instead of relying on browser locale parsing.
- Add 20 regression checks, GitHub Actions, development instructions, and recorded live Chrome validation.

Reload the unpacked extension after updating, then refresh affected website tabs. If the local folder was renamed, remove the old unpacked entry and load the renamed folder from `chrome://extensions`. The Chrome Web Store listing requires a separate upload of this version.
