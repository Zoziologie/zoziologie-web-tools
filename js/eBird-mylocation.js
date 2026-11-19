(() => {
  "use strict";
  Zoziologie.feature("ebirdShortcuts", () => {
    const locId = location.pathname.split("/").filter(Boolean).at(-1);
    Zoziologie.keep(() => {
      const menu = document.querySelector(".SectionMenu-section-list");
      if (!menu || document.querySelector("#zoziologie-location-targets")) return;
      for (const [id, href, label] of [
        ["zoziologie-location-targets", `/targets?r1=${encodeURIComponent(locId)}`, "Target List"],
        ["zoziologie-location-myebird", `/myebird/${encodeURIComponent(locId)}`, "View in my eBird"],
      ]) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        const strong = document.createElement("strong");
        link.id = id;
        link.href = href;
        strong.textContent = label;
        link.append(strong);
        item.append(link);
        menu.append(item);
      }
    });
  });
})();
