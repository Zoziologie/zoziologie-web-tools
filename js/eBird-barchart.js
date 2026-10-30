(() => {
  "use strict";
  const container = document.querySelector("#barchart-display");
  if (!container) return;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const weeks = months.flatMap((month) => [1, 2, 3, 4].map((week) => month + week));
  const header = ["speciesCode", "category", "commonName", "sciName", "exoticCategory"];
  container.insertAdjacentHTML("afterbegin", `<button type="button" id="zoziology-barchart" style="margin:3px 0"><svg class="Icon Icon--download u-inline-xs" role="presentation"><use xlink:href="#Icon--download"></use></svg> Download (csv)</button>`);
  const button = container.querySelector("#zoziology-barchart");
  button.addEventListener("click", () => Zoziologie.runAction(button, async () => {
    if (document.querySelector('a[href*="forceLogin=true"]')) {
      throw new Error("Sign in to eBird, then refresh this page to download barchart data.");
    }
    const url = new URL("/barchartData", location.origin);
    url.search = location.search;
    url.searchParams.set("fmt", "json");
    const data = await Zoziologie.fetchJSON(url);
    if (!data.dataRows.length) throw new Error("No barchart data to download.");
    const rows = data.dataRows.map((row) => ({
      ...row.taxon,
      exoticCategory: row.exoticCategory ?? "",
      ...Object.fromEntries(weeks.map((week, index) => [week, row.values[index]])),
    }));
    rows.unshift(Object.fromEntries(weeks.map((week, index) => [week, data.dataRows[0].values_N[index]])));
    Zoziologie.downloadCSV(rows, `barchartData_${location.search.slice(1)}`, [...header, ...weeks]);
  }));
})();
