(() => {
  "use strict";
  Zoziologie.feature("ebirdShortcuts", () => {
    const match = location.pathname.match(/region\/([A-Z0-9-]+)/);
    if (!match) return;
    const parts = match[1].split("-");
    const code = ["US", "CA"].includes(parts[0]) ? parts.slice(0, 2).join("-") : parts[0];
    Zoziologie.keep(() => {
      const menu = Array.from(document.querySelectorAll(".SectionMenu-section-list")).at(-1);
      if (!menu || document.querySelector("#zoziologie-rare-map")) return;
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.id = "zoziologie-rare-map";
      link.href = `https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/?mode=r&r=${encodeURIComponent(code)}&t=1`;
      link.innerHTML = "<span><b>Rare Bird Map</b></span>";
      item.append(link);
      menu.append(item);
    });
  });
})();
