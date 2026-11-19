/* Feature catalog shared by the toolbar popup and the tests. Content scripts only use the ids. */
(() => {
  "use strict";

  // Biolovision portals verified live in November 2026. Keep in sync with manifest.json.
  const biolovisionHosts = [
    "www.faune-france.org",
    "www.faune-aura.org",
    "www.faune-bfc.org",
    "www.faune-bretagne.org",
    "www.faune-charente.org",
    "www.faune-cher.org",
    "www.faune-deux-sevres.org",
    "www.faune-grandest.org",
    "www.faune-guyane.fr",
    "www.faune-iledefrance.org",
    "www.faune-indre-et-loire.org",
    "www.faune-limousin.org",
    "www.faune-maine.org",
    "www.faune-nouvelle-aquitaine.org",
    "www.faune-occitanie.org",
    "www.faune-paca.org",
    "www.faune-paysdelaloire.org",
    "www.faune-reunion.fr",
    "www.faune-vendee.org",
    "www.faune-vienne.org",
    "www.ornitho.at",
    "www.ornitho.cat",
    "www.ornitho.ch",
    "www.ornitho.de",
    "www.ornitho.eus",
    "www.ornitho.it",
    "www.ornitho.lu",
    "www.ornitho.pl",
    "dabasdati.ornitho.lv",
    "data.biolovision.net",
  ];

  const isEbird = (url) => url.hostname === "ebird.org";
  const isMacaulay = (url) => /^(www\.)?macaulaylibrary\.org$/.test(url.hostname);
  const isBiolovision = (url) => biolovisionHosts.includes(url.hostname);

  const sites = [
    { id: "ebird", name: "eBird", hint: "Open Targets, a trip report, a bar chart or a checklist.", test: isEbird },
    { id: "macaulay", name: "Macaulay Library", hint: "Open a photo or sound page.", test: isMacaulay },
    { id: "biolovision", name: "Biolovision", hint: "Show search results as a species list, summary or observation list.", test: isBiolovision },
  ];

  const path = (pattern) => (url) => isEbird(url) && pattern.test(url.pathname);
  const output = (url) => ["species", "synth", "list"].includes(url.searchParams.get("sp_FChoice"));

  const features = [
    {
      id: "ebirdTargets", site: "ebird", name: "Target list export",
      how: "On Targets, click Download (csv) next to Print.",
      open: "https://ebird.org/targets", test: path(/targets/),
    },
    {
      id: "ebirdRegionSearch", site: "ebird", name: "Any comparison region",
      how: "On Targets, Search regions lets you compare with any region or hotspot, not only parent regions.",
      open: "https://ebird.org/targets", test: path(/targets/),
    },
    {
      id: "ebirdTripReport", site: "ebird", name: "Trip report export",
      how: "On a trip report, Download (csv) gives species, checklists or every observation.",
      open: "https://ebird.org/mytripreports", test: path(/tripreport\//),
    },
    {
      id: "ebirdBarchart", site: "ebird", name: "Bar chart export",
      how: "On a bar chart, Download (csv) gives all 48 weekly frequencies. Requires eBird sign-in.",
      open: "https://ebird.org/GuideMe?cmd=changeLocation", test: path(/barchart/),
    },
    {
      id: "ebirdChecklist", site: "ebird", name: "Checklist links",
      how: "Copy a link to a single species with the link icon. On your checklists, jump to Manage Location.",
      open: "https://ebird.org/mychecklists", test: path(/checklist\//),
    },
    {
      id: "ebirdShortcuts", site: "ebird", name: "Location shortcuts",
      how: "Adds Target List and View in my eBird to your locations, and Rare Bird Map to region pages.",
      open: "https://ebird.org/mylocations", test: path(/mylocations\/edit\/|region\//),
    },
    {
      id: "macaulayDownload", site: "macaulay", name: "Media download",
      how: "On a photo or sound page, download the 2400 px photo or the MP3.",
      permission: {
        name: "downloads",
        missing: "Files open in a new tab. Allow downloads to save them as ML123456789.jpg instead.",
        granted: "Files are saved as ML123456789.jpg or .mp3.",
        button: "Allow downloads",
      },
      open: "https://www.macaulaylibrary.org/", test: (url) => isMacaulay(url) && url.pathname.startsWith("/asset"),
    },
    {
      id: "biolovisionExport", site: "biolovision", name: "Result exports",
      how: "On a species list, summary or observation list, use the CSV button in the Export row.",
      test: (url) => isBiolovision(url) && output(url),
    },
    {
      id: "biolovisionGrid", site: "biolovision", name: "Atlas grid lookup",
      how: "On the polygon page (module 620), open the results for the matching atlas square.",
      test: (url) => isBiolovision(url) && url.searchParams.get("m_id") === "620",
    },
    {
      id: "biolovisionTidy", site: "biolovision", name: "Tidy layout",
      how: "Hides banners and slideshows and puts the search engine first in the menu.",
      test: isBiolovision,
    },
  ];

  function parse(url) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  function siteFor(url) {
    const parsed = parse(url);
    return parsed && sites.find((site) => site.test(parsed));
  }

  function featuresFor(url) {
    const parsed = parse(url);
    return parsed ? features.filter((feature) => feature.test(parsed)) : [];
  }

  globalThis.ZoziologieCatalog = { biolovisionHosts, sites, features, siteFor, featuresFor };
})();
