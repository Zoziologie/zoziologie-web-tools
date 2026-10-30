(() => {
  "use strict";
  const container = document.querySelector(".ReportMetaTools");
  if (!container) return;
  const levels = [["checklist", "Checklist Level"], ["species", "Species Level"], ["observation", "Observations Level"]];
  container.insertAdjacentHTML("beforeend", `
    <div tabindex="-1" class="Dropdown">
      <span tabindex="-1" class="Dropdown-heading">
        <button type="button" class="Button Button--reverse Button--small Button--hollow">
          <svg aria-hidden="true" class="Icon Icon--download"><use xlink:href="#Icon--download"></use></svg>
          <span class="u-showForMedium">Download (csv)</span>
          <svg aria-hidden="true" class="Icon Icon--triangleDown"><use xlink:href="#Icon--triangleDown"></use></svg>
        </button>
        <span class="Dropdown-closer"></span>
      </span>
      <div tabindex="-1" class="Dropdown-panel">
        <ul class="u-unlist">${levels.map(([type, label]) => `
          <li><a href="#" class="zoziology-tripreport" id="zoziology-tripreport-${type}">${label}
            <div class="LoadingAnimation LoadingAnimation--small" style="display:none">
              <svg aria-hidden="true" class="Icon Icon--spinner"><use xlink:href="#Icon--spinner"></use></svg>
            </div>
          </a></li>`).join("")}
        </ul>
      </div>
    </div>`);

  container.addEventListener("click", (event) => {
    const button = event.target.closest(".zoziology-tripreport");
    if (!button) return;
    event.preventDefault();
    Zoziologie.runAction(button, async () => {
      const [reportId, personId] = location.pathname.split("tripreport/")[1].split("/");
      const query = personId ? `?tripReportPersonId=${encodeURIComponent(personId)}` : "";
      const base = `/tripreport-internal/v1`;
      const type = button.id.replace("zoziology-tripreport-", "");
      let rows;
      if (type === "checklist") {
        const data = await Zoziologie.fetchJSON(`${base}/checklists/${reportId}${query}`);
        rows = data.map(({ loc, ...checklist }) => ({ ...checklist, ...loc }));
      } else {
        const data = await Zoziologie.fetchJSON(`${base}/taxon-list/${reportId}${query}`);
        rows = data.map((species) => ({
          ...species,
          exoticCategory: species.exoticCategory || "",
          isPhotoLifer: species.isPhotoLifer || false,
          isAudioLifer: species.isAudioLifer || false,
        }));
        if (type === "observation") {
          const details = await Zoziologie.mapConcurrent(rows, async (species) => {
            const detail = await Zoziologie.fetchJSON(`${base}/taxon-detail/${reportId}/${species.speciesCode}${query}`);
            return detail.checklists?.length
              ? detail.checklists.map((checklist) => ({ ...species, ...checklist }))
              : [species];
          });
          rows = details.flat();
        }
      }
      const title = document.querySelector(".ReportTitle-name").textContent.trim().replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const suffix = { checklist: "checklists", species: "species", observation: "observations" }[type];
      Zoziologie.downloadCSV(rows, `${title}_${suffix}`);
    });
  });
})();
