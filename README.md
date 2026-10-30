# Zoziologie Web Tools

A browser extension with export and navigation tools for eBird, Macaulay Library, and Biolovision (ornitho, faune-...).

Source: [Zoziologie/zoziologie-web-tools](https://github.com/Zoziologie/zoziologie-web-tools). See [CHANGELOG.md](CHANGELOG.md) for release notes.

- [Zoziologie Web Tools](#zoziologie-web-tools)
  - [How to install?](#how-to-install)
  - [eBird](#ebird)
    - [Export Target as CSV](#export-target-as-csv)
    - [Search for Region as target](#search-for-region-as-target)
    - [Export Trip report as CSV](#export-trip-report-as-csv)
      - [Species Level](#species-level)
      - [Observation Level](#observation-level)
      - [Checklist Level](#checklist-level)
    - [Export Barchart](#export-barchart)
    - [Checklist: anchor link to species, Export GPS track and Manage location](#checklist-anchor-link-to-species-export-gps-track-and-manage-location)
    - [Download Pictures](#download-pictures)
  - [Biolovision](#biolovision)
    - [Export Species List](#export-species-list)
    - [Export Summary](#export-summary)
    - [Export List](#export-list)

## How to install?

Install the extension directly from the [Chrome Web Store](https://chrome.google.com/webstore/detail/zoziologie/ikoemgmlmapdnjkphgficpdlkfiepodh)!

[![image](https://user-images.githubusercontent.com/7571260/213334689-48582f00-4a24-46b6-a56f-3b1b230cb456.png)](https://chrome.google.com/webstore/detail/zoziologie/ikoemgmlmapdnjkphgficpdlkfiepodh)

## eBird

### Export Target as CSV

Export your [Target](https://ebird.org/targets) list into a [comma-separated value (csv)](https://en.wikipedia.org/wiki/Comma-separated_values) using the new button "Download (csv)" next to "Print". The exported table contains the following columns:

| `rank` | `speciesCode` | `commonName` | `sciName`       | `frequency` | `exoticCategory` \* |
| ------ | ------------- | ------------ | --------------- | ----------- | ------------------- |
| 1      | brant         | Brent Goose  | Branta bernicla | 1.77%       | Native              |

\* one of `Native`, `Naturalized`, `Provisional`, `Escapee`. Note that hybrids are identifiable from `commonName`.

![image](assets/target.png)

### Search for Region as target

By default, in the target page, you can only search for parent region in the "For your: " list. With this extension, you can now search for any region. This is specifically useful when search target at a specific hotspot for its parent region.

<img width="534" alt="image" src="https://github.com/user-attachments/assets/b041eae5-8660-46eb-b769-09e160c042a4" />

### Export Trip report as CSV

Export your [trip report](https://ebird.org/mytripreports) into a csv using the new button "Download (csv)" next to share and edit. Make sure to select the correct "DATA FOR:" according to what you want to download. There are three possible export:

#### Species Level

Each row correspond to a species.

| speciesCode | category | commonName     | sciName          | numIndividuals | numChecklists | numPhotos | numAudio | numVideo | isLifer | numMedia | exoticCategory | isPhotoLifer | isAudioLifer |
| ----------- | -------- | -------------- | ---------------- | -------------- | ------------- | --------- | -------- | -------- | ------- | -------- | -------------- | ------------ | ------------ |
| ostric2     | species  | Common Ostrich | Struthio camelus | 9              | 2             | 0         | 0        | 0        | FALSE   | 0        |                | FALSE        | FALSE        |

#### Observation Level

Each row correspond to a observations, which is similar to when clicking on "showing all details".

| _same as species level_ | subId      | obsDt            | locName                                              | howMany |
| ----------------------- | ---------- | ---------------- | ---------------------------------------------------- | ------- |
| _same as species level_ | S212383195 | 08.02.2025 10:20 | Dassenberg Drive, Western Cape, ZA (-33.463, 18.445) | 6       |

#### Checklist Level

Each row correspond to a checklist, similar to the checklists view

| locId     | subId      | numSpecies | obsDt     | obsTime | isoObsDate       | subID      | name                                                           | latitude    | longitude  | countryCode | countryName  | subnational1Name | subnational1Code | isHotspot | locName                                                        | hierarchicalName                                                                 | locID     | lat         | lng        |
| --------- | ---------- | ---------- | --------- | ------- | ---------------- | ---------- | -------------------------------------------------------------- | ----------- | ---------- | ----------- | ------------ | ---------------- | ---------------- | --------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------- | ----------- | ---------- |
| L40063346 | S212444111 | 1          | 08.Feb.25 | 18:25   | 08.02.2025 18:25 | S212444111 | West Coast Road, Cape Town, Western Cape, ZA (-33.586, 18.399) | -33.5855343 | 18.3994637 | ZA          | South Africa | Western Cape     | ZA-WC            | FALSE     | West Coast Road, Cape Town, Western Cape, ZA (-33.586, 18.399) | West Coast Road, Cape Town, Western Cape, ZA (-33.586, 18.399), Western Cape, ZA | L40063346 | -33.5855343 | 18.3994637 |

![image](assets/tripreport.png)

### Export Barchart

Export a [barchart](https://ebird.org/GuideMe?cmd=changeLocation) data into a csv using the new button "Download (csv)" on top of the table.

First row is the normalization factor (i.e., number of checklists). There are 48 periods: 4 per months.

| `speciesCode` | `category` | `commonName`     | `sciName`     | `exoticCategory` | `Jan1` | `Jan2` | `...` | `Dec4` |
| ------------- | ---------- | ---------------- | ------------- | ---------------- | ------ | ------ | ----- | ------ |
|               |            |                  |               |                  | 247    | 259    | ...   | 257    |
| bahgoo        | species    | Bar-headed Goose | Anser indicus | N                | 0      | 0      | ...   | 0      |

![image](assets/barchart.png)

### Checklist: anchor link to species, Export GPS track and Manage location

- **Anchor link to species**: To share a specific sighting within your checklist, click on the link icon at the end of the line to copy the url of this entry on your clipboard. When opening this link, the page will automically scroll to this sighting.
- **Manage location** (not visible on screenshot below): A new button, next to "Edit Location" will help you to nagivate to the Location page directly.

![image](assets/checklist.png)

### Download Pictures

Download any photos on the Macaulay library at 2400px wide resolution (the original is only available for the author) using the new button "Download 2400".

![image](assets/macaulay.png)

## Biolovision

### Export Species List

Create csv files from Biolovision **Specie List** (`m_id=94`) pages using the csv button on the export row. This output page is selected on the last tab of the **search engine** page (`m_id=8`). The exported table contains the following columns:

| `number` | `common_name` | `scientific_name` | `latest_date` | `breeding` | `link_observation`                                                                                                                                                                                                                                                                                          | `link_stat`                                                                    | `link_info`                                                                                  |
| -------- | ------------- | ----------------- | ------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 31       | Greylag Goose | Anser anser       | 06.01.2020    | certain    | <https://www.ornitho.ch/index.php?m_id=94&showback=stor&p_c=5&p_cc=-1&sp_tg=1&sp_DateSynth=02.06.2020&sp_DChoice=offset&sp_DOffset=5&sp_SChoice=species&sp_S=60&sp_PChoice=canton&sp_cC=000100110000000000000011001001100000000000000000000&sp_FChoice=list&sp_FDisplay=DATE_PLACE_SPECIES&sp_DFormat=DESC> | <https://www.ornitho.ch/index.php?m_id=81&frmSpecies=60&sp_tg=1&showback=stor> | <https://www.ornitho.ch/index.php?m_id=15&showback=stor&backlink=skip&frmSpecies=60&sp_tg=1> |

![image](assets/species.png)

### Export Summary

Create CSV files from Biolovision **Summary** (`m_id=32`) pages using the csv button on the export row. This output page is selected on the last tab of the **search engine** page (`m_id=8`). The exported table contains the following column:

| `number` | `common_name` | `observers` | `place`  | `link_photo`                                                                                        | `link_observations`                                                                                                                                                                                                                                                                                                                 | `link_stat`                                                                             | `link_info` |
| -------- | ------------- | ----------- | -------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------- |
| ~40      | Greylag Geese | 2 Observers | 2 places | <https://www.ornitho.ch/index.php?m_id=15&showback=stor&backlink=skip&y=2020&frmSpecies=60&sp_tg=1> | <https://www.ornitho.ch/index.php?m_id=94&showback=stor&p_c=5&p_cc=-1&sp_tg=1&sp_DateSynth=01.06.2020&sp_DChoice=range&sp_DFrom=01.06.2020&sp_DTo=01.06.2020&sp_SChoice=species&sp_S=60&sp_PChoice=canton&sp_cC=000100110000000000000011001001100000000000000000000&sp_FChoice=list&sp_FDisplay=DATE_PLACE_SPECIES&sp_DFormat=DESC> | <https://www.ornitho.ch/index.php?m_id=81&frmSpecies=60&showback=stor&cDate=2020-06-01> |

![image](assets/summary.png)

### Export List

Create CSV files from Biolovision **List** (`m_id=94`) pages using the csv button on the export row. This output page is selected on the last tab of the **search engine** page (`m_id=8`). The exported table contains the following column:

| `date`   | `place`                                | `place_link`                                                  | `number` | `common_name`     | `scientific_name`  | `remark`                                  |
| -------- | -------------------------------------- | ------------------------------------------------------------- | -------- | ----------------- | ------------------ | ----------------------------------------- |
| 06.01.24 | Widensolen (village) / Widensolen (68) | <https://www.faune-grandest.org/index.php?m_id=52&id=1153273> | 2        | Bécasses des bois | Scolopax rusticola | Remarque :observation de mon salon en vol |

_No screen shot_

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for the file layout, automated checks, manual verification, and release steps. The extension runs directly from this repository; no build step or runtime dependencies are required.

Load a local copy from `chrome://extensions`: enable **Developer mode**, click **Load unpacked**, and select this folder. After editing, reload the extension and refresh the affected website tab.

CSV exports use UTF-8 with a BOM, standard quoted fields, and CRLF record separators. Commas, quotes, newlines, and non-ASCII names are preserved. Single-result exports are supported. Trip exports include columns appearing in later rows, so optional observation fields are not lost. Biolovision list exports preserve the site's displayed date text rather than guessing a date from the browser's locale; remarks retain their original punctuation and line breaks.
