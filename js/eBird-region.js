(() => {
  "use strict";
  const menu = Array.from(document.querySelectorAll(".SectionMenu-section-list")).at(-1);
  const match = location.pathname.match(/region\/([A-Z0-9-]+)/);
  if (!menu || !match) return;
  const parts = match[1].split("-");
  const code = ["US", "CA"].includes(parts[0]) ? parts.slice(0, 2).join("-") : parts[0];
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = `https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/?mode=r&r=${encodeURIComponent(code)}&t=1`;
  link.innerHTML = "<span><b>Rare Bird Map</b></span>";
  item.append(link);
  menu.append(item);
})();
