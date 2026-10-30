/* Shared by content scripts in Chrome's isolated world; loaded first by manifest.json. */
(() => {
  "use strict";

  function csv(rows, columns) {
    const fields = columns ?? [...new Set(rows.flatMap(Object.keys))];
    const escape = (value) => {
      const text = String(value ?? "");
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    return [fields, ...rows.map((row) => fields.map((field) => row[field]))]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
  }

  function downloadCSV(rows, filename, columns) {
    if (!rows.length) throw new Error("No data to download. Display the results and try again.");
    const blob = new Blob(["\uFEFF", csv(rows, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 190) + ".csv";
    document.body.append(link);
    link.click();
    link.remove();
    // Give Chrome time to consume the object URL before releasing its memory.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Request failed (${response.status}). Please try again.`);
    return response.json();
  }

  async function runAction(button, action) {
    if (button.getAttribute("aria-busy") === "true") return;
    button.setAttribute("aria-busy", "true");
    const spinner = button.querySelector(".LoadingAnimation");
    if (spinner) spinner.style.display = "inline-block";
    try {
      await action();
    } catch (error) {
      console.error("Zoziologie:", error);
      alert(error.message);
    } finally {
      button.removeAttribute("aria-busy");
      if (spinner) spinner.style.display = "none";
    }
  }

  async function mapConcurrent(items, callback, limit = 6) {
    const results = new Array(items.length);
    let next = 0;
    let failed = false;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (!failed && next < items.length) {
        const index = next++;
        try {
          results[index] = await callback(items[index]);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }));
    return results;
  }

  globalThis.Zoziologie = { csv, downloadCSV, fetchJSON, runAction, mapConcurrent };
})();
