(() => {
  "use strict";
  document.querySelectorAll(".Observation").forEach((observation) => {
    const cell = document.createElement("div");
    cell.style.gridColumn = "5/6";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "zoziology-ebird-link Button--link";
    button.setAttribute("aria-label", "Copy link to this observation");
    button.innerHTML = '<svg class="Icon Icon--link Icon--sm" role="presentation"><use xlink:href="#Icon--link"></use></svg>';
    cell.append(button);
    observation.querySelector(".Observation-species").after(cell);
    button.addEventListener("click", () => Zoziologie.runAction(button, async () => {
      const url = new URL(location.href);
      url.hash = observation.id;
      await navigator.clipboard.writeText(url.href);
      document.querySelector("#zoziologie-copied")?.remove();
      const message = document.createElement("span");
      message.id = "zoziologie-copied";
      message.setAttribute("role", "status");
      message.style.cssText = "color:#1c6900;font-size:.88rem";
      message.textContent = "Copied to clipboard.";
      button.after(message);
    }));
  });

  const editLocation = document.querySelector('a[href*="locID="]');
  if (!editLocation) return;
  const locId = new URL(editLocation.href).searchParams.get("locID");
  const link = document.createElement("a");
  link.href = `/mylocations/edit/${encodeURIComponent(locId)}`;
  link.className = "Button Button--tiny Button--hollow u-showForMedium";
  link.style.cssText = "align-self:center;flex-shrink:0;padding:.25rem .4rem;margin-left:5px;margin-bottom:0";
  link.textContent = "Manage Location";
  editLocation.after(link);
  const tools = document.querySelector("#checklist-tools ul");
  if (tools) {
    const item = document.createElement("li");
    const menuLink = link.cloneNode(true);
    menuLink.className = "ToggleDropdown-panel-link";
    menuLink.removeAttribute("style");
    item.append(menuLink);
    tools.append(item);
  }
})();
