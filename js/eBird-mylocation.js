(() => {
  "use strict";
  const menu = document.querySelector(".SectionMenu-section-list");
  if (!menu) return;
  const locId = location.pathname.split("/").filter(Boolean).at(-1);
  menu.insertAdjacentHTML("beforeend", `<li><a href="/targets?r1=${encodeURIComponent(locId)}"><strong>Target List</strong></a></li><li><a href="/myebird/${encodeURIComponent(locId)}"><strong>View in my eBird</strong></a></li>`);
})();
