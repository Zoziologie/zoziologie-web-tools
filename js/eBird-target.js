(() => {
  "use strict";
  const printButton = document.querySelector(".Button.Button--small.Button--hollow");
  if (printButton) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "Button Button--small Button--hollow";
    button.style.marginLeft = "2px";
    button.textContent = "Download (csv)";
    printButton.parentElement.append(button);
    button.addEventListener("click", () => Zoziologie.runAction(button, () => {
      const categories = ["native-and-naturalized", "exotic-provisional", "exotic-escapee", "hybrids"];
      const rows = categories.flatMap((category) => Array.from(
        document.querySelectorAll(`[aria-labelledby="${category}"] ol li`), (row) => {
          const name = row.querySelector(`.SpecimenHeader-joined${category === "hybrids" ? "" : " a"}`);
          const commonName = name.cloneNode(true);
          commonName.querySelector("em")?.remove();
          return {
            rank: row.querySelector(".ResultsStats-index span")?.textContent.split(".")[0] ?? "",
            speciesCode: new URL(row.querySelector(".ResultsStats-action a").href).pathname.split("/map/")[1],
            commonName: commonName.textContent.trim(),
            sciName: name.querySelector("em")?.textContent.trim() ?? "",
            frequency: row.querySelector(".ResultsStats-stats .Heading").textContent.trim(),
            exoticCategory: row.querySelector(".ResultsStats-title button")?.title.split("Exotic: ")[1] ?? "Native",
          };
        }
      ));
      Zoziologie.downloadCSV(rows, location.search.slice(1) || "targets");
    }));
  }

  const select = document.querySelector("#targets-comparison-region");
  if (!select) return;
  const container = select.closest(".GridFlex-cell");
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;gap:8px";
  select.before(wrapper);
  wrapper.append(select);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "Button";
  toggle.textContent = "Search regions";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "zoziologie-region-search");
  wrapper.append(toggle);

  const search = document.createElement("div");
  search.id = "zoziologie-region-search";
  search.className = "Suggest";
  search.hidden = true;
  search.innerHTML = `
    <div class="Suggest-container">
      <div class="Suggest-inputContainer">
        <input type="search" class="Suggest-input" aria-label="Search comparison regions" placeholder="Enter a region" autocomplete="off" spellcheck="false">
      </div>
      <button type="button" class="Button Button--small">Clear</button>
      <div class="Suggest-dropdown" hidden>
        <div class="Suggest-suggestions"></div>
      </div>
      <span role="status" aria-live="polite"></span>
    </div>`;
  container.append(search);
  const input = search.querySelector("input");
  const dropdown = search.querySelector(".Suggest-dropdown");
  const suggestions = search.querySelector(".Suggest-suggestions");
  const status = search.querySelector("[role=status]");
  let timer;
  let controller;

  function clearSearch() {
    clearTimeout(timer);
    controller?.abort();
    suggestions.replaceChildren();
    dropdown.hidden = true;
    status.textContent = "";
  }

  input.addEventListener("input", () => {
    clearSearch();
    const query = input.value.trim();
    if (query.length < 3) return;
    controller = new AbortController();
    const signal = controller.signal;
    timer = setTimeout(async () => {
      status.textContent = "Searching…";
      try {
        // Region finder key retained from the existing eBird integration.
        const url = new URL("https://api.ebird.org/v2/ref/region/find");
        url.search = new URLSearchParams({ key: "jfekjedvescr", q: query });
        const regions = await Zoziologie.fetchJSON(url, { signal });
        if (signal.aborted) return;
        status.textContent = regions.length ? `${regions.length} regions found` : "No regions found";
        for (const region of regions) {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "Suggest-suggestion";
          option.textContent = region.name;
          option.addEventListener("click", () => {
            let selected = Array.from(select.options).find((item) => item.value === region.code);
            if (!selected) {
              selected = new Option(region.name, region.code);
              select.add(selected);
            }
            select.value = region.code;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            input.value = region.name;
            clearSearch();
          });
          suggestions.append(option);
        }
        dropdown.hidden = !regions.length;
      } catch (error) {
        if (!signal.aborted) status.textContent = `Region search failed. ${error.message}`;
      }
    }, 250);
  });
  search.querySelector("button").addEventListener("click", () => {
    input.value = "";
    clearSearch();
    input.focus();
  });
  toggle.addEventListener("click", () => {
    search.hidden = !search.hidden;
    toggle.setAttribute("aria-expanded", String(!search.hidden));
    if (search.hidden) clearSearch();
    else input.focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearSearch();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      suggestions.querySelector("button")?.focus();
    }
  });
})();
