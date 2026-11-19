(() => {
  "use strict";
  Zoziologie.feature("ebirdChecklist", () => {
    document.querySelectorAll(".Observation").forEach((observation) => {
      const cell = document.createElement("div");
      cell.style.gridColumn = "5/6";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "zoziology-ebird-link Button--link";
      button.title = "Copy a link to this species";
      button.setAttribute("aria-label", "Copy a link to this species");
      button.innerHTML = '<svg class="Icon Icon--link Icon--sm" role="presentation"><use xlink:href="#Icon--link"></use></svg>';
      cell.append(button);
      observation.querySelector(".Observation-species").after(cell);
      button.addEventListener("click", () => Zoziologie.runAction(button, async () => {
        const url = new URL(location.href);
        url.hash = observation.id;
        await navigator.clipboard.writeText(url.href);
        Zoziologie.notify("Link to this species copied to the clipboard.", { type: "success", timeout: 3000 });
      }));
    });

    // Owner-only: "Edit Location" exists as a header button and as an entry in the checklist tools menu.
    const tools = document.querySelector("#checklist-tools");
    const menu = tools?.matches("ul") ? tools : tools?.querySelector("ul");
    const editLocation = Array.from(document.querySelectorAll('a[href*="locID="]')).find((link) => !tools?.contains(link));
    const anyEdit = editLocation ?? menu?.querySelector('a[href*="locID="]');
    if (!anyEdit) return;
    const href = `/mylocations/edit/${encodeURIComponent(new URL(anyEdit.href).searchParams.get("locID"))}`;

    if (editLocation) {
      const link = document.createElement("a");
      link.href = href;
      link.className = "Button Button--tiny Button--hollow u-showForMedium";
      link.style.cssText = "align-self:center;flex-shrink:0;padding:.25rem .4rem;margin-left:5px;margin-bottom:0";
      link.textContent = "Manage Location";
      editLocation.after(link);
    }
    if (menu) {
      // Same markup as eBird's own entries, right after "Edit Location".
      const item = document.createElement("li");
      const link = document.createElement("a");
      const strong = document.createElement("strong");
      link.href = href;
      strong.textContent = "Manage Location";
      link.append(strong);
      item.append(link);
      const editItem = menu.querySelector('a[href*="locID="]')?.closest("li");
      if (editItem?.parentElement === menu) editItem.after(item);
      else menu.append(item);
    }
  });
})();
