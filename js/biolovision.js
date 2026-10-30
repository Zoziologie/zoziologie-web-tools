(() => {
  "use strict";
  const params = new URLSearchParams(location.search);

  function exportRows() {
    const rows = [];
    if (params.get("sp_FChoice") === "species") {
      document.querySelectorAll(".rowlight, .rowdark").forEach((row) => {
        const dates = row.querySelectorAll("i:not([class])");
        rows.push({
          number: parseInt(row.querySelector(".text-right.col-sm-1").textContent, 10),
          common_name: row.querySelector("b").textContent.trim(),
          scientific_name: row.querySelector(".sci_name")?.textContent.replace(/[()]/g, "").trim() ?? "",
          latest_date: dates[0].textContent.trim(),
          breeding: dates[1]?.textContent.trim() ?? "",
          link_observation: row.querySelector(".ba-list, .fa-sp-obs")?.closest("a").href ?? "",
          link_stat: row.querySelector(".ba-stats, .fa-sp-graph")?.closest("a").href ?? "",
          link_info: row.querySelector(".ba-info, .fa-sp-info")?.closest("a").href ?? "",
        });
      });
    } else if (params.get("sp_FChoice") === "synth") {
      document.querySelectorAll(".rowlight, .rowdark").forEach((row) => {
        const columns = row.querySelectorAll(".col-sm-4");
        rows.push({
          number: row.querySelector("span").textContent.split("\u00a0")[1],
          common_name: row.querySelector("b").textContent.trim(),
          observers: columns[1].textContent.trim(),
          place: columns[2].textContent.trim(),
          link_photo: row.querySelector(".fa-camera")?.closest("a").href ?? "",
          link_observations: row.querySelector(".ba-list, .fa-sp-obs")?.closest("a").href ?? "",
          link_stat: row.querySelector(".ba-stats, .fa-sp-graph")?.closest("a").href ?? "",
          link_info: row.querySelector(".ba-info, .fa-sp-info")?.closest("a").href ?? "",
        });
      });
    } else if (params.get("sp_FChoice") === "list") {
      document.querySelectorAll(".listContainer").forEach((list) => {
        // Preserve the site's date label instead of parsing localized dates with Date.
        const date = list.querySelector(".listTop").textContent.trim();
        list.querySelectorAll(".obs_level_2_i_content").forEach((group) => {
          const place = group.querySelector(".listSubmenu");
          if (!place) return;
          group.querySelectorAll(".observation_container").forEach((observation) => {
            rows.push({
              date,
              place: place.textContent.trim(),
              place_link: place.querySelector("a").href,
              number: observation.querySelector(".sighting_count").textContent.trim(),
              common_name: observation.querySelector("b").textContent.trim(),
              scientific_name: observation.querySelector(".sci_name")?.textContent.replace(/[()]/g, "").trim() ?? "",
              remark: Array.from(observation.querySelectorAll(".remark"), (remark) => remark.textContent.trim()).filter(Boolean).join(" | "),
            });
          });
        });
      });
    }
    Zoziologie.downloadCSV(rows, location.search.slice(1) || document.title || "export");
  }

  async function openGrid() {
    const polygonCode = document.querySelector("#polygon_code_name").textContent.trim();
    const query = new URLSearchParams({ m_id: "63", backlink: "skip", content: "grid", query: polygonCode });
    const response = await fetch(`index.php?${query}`);
    if (!response.ok) throw new Error(`Grid lookup failed (${response.status}). Please try again.`);
    const xml = new DOMParser().parseFromString(await response.text(), "text/xml");
    const grid = xml.querySelector("name");
    if (!grid) throw new Error("No matching grid found.");
    const url = new URL(document.querySelector("#gsearch a").href);
    url.searchParams.set("sp_PChoice", "grid");
    url.searchParams.set("sp_Grid_Info", polygonCode);
    url.searchParams.set("sp_Grid", grid.getAttribute("id"));
    url.searchParams.delete("sp_Polygon");
    if (url.searchParams.get("sp_S") === "0") url.searchParams.set("sp_SChoice", "all");
    // Keep a clickable result available if Chrome blocks the automatic new tab.
    const button = document.querySelector("#zoziology-grid-open");
    const link = document.createElement("a");
    link.id = button.id;
    link.className = "export_link bi bi-txt";
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open grid results";
    button.replaceWith(link);
    link.click();
  }

  function start() {
    const box = document.querySelector(".box.flex-box");
    if (box && ["species", "synth", "list"].includes(params.get("sp_FChoice")) && !document.querySelector("#zoziology-export")) {
      box.insertAdjacentHTML("beforeend", `<div class="row"><div class="col-sm-20"><div class="flex-title">Export</div></div><div class="col-sm-80"><button type="button" class="export_link bi bi-txt" id="zoziology-export" title="Download CSV" aria-label="Download CSV" style="margin-right:.2rem;cursor:pointer"></button></div></div>`);
      const button = box.querySelector("#zoziology-export");
      button.addEventListener("click", () => Zoziologie.runAction(button, exportRows));
    }

    if (params.get("m_id") === "620") {
      document.querySelector(".box")?.remove();
      document.querySelector(".no_access")?.remove();
      const grid = document.querySelector("#gsearch");
      if (grid && !document.querySelector("#zoziology-grid-open")) {
        grid.insertAdjacentHTML("afterend", `<button type="button" class="export_link bi bi-txt" id="zoziology-grid-open" title="Open grid results" aria-label="Open grid results" style="cursor:pointer"></button>`);
        const button = document.querySelector("#zoziology-grid-open");
        button.addEventListener("click", () => Zoziologie.runAction(button, openGrid));
      }
    }
  }

  function observeDynamicContent() {
    for (const id of ["1164", "1364"]) {
      const item = document.getElementById(id);
      if (item && item !== item.parentNode.lastElementChild) item.parentNode.append(item);
    }
    const search = document.getElementById("8");
    if (search && search !== search.parentNode.firstElementChild) search.parentNode.prepend(search);

    start();
    let timer;
    const observer = new MutationObserver((mutations) => {
      // Ignore text changes and the extension's own controls.
      const addedContent = mutations.some((mutation) => Array.from(mutation.addedNodes).some(
        (node) => node.nodeType === Node.ELEMENT_NODE && !node.id.startsWith("zoziology-") && !node.querySelector('[id^="zoziology-"]')
      ));
      if (!addedContent) return;
      clearTimeout(timer);
      timer = setTimeout(start, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pagehide", () => {
      clearTimeout(timer);
      observer.disconnect();
    }, { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeDynamicContent, { once: true });
  else observeDynamicContent();
})();
