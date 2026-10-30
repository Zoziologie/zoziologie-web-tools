(() => {
  "use strict";
  const actions = document.querySelector(".actions");
  if (!actions) return;
  const isSound = document.body.textContent.toLowerCase().includes("microphone");
  const link = document.createElement("a");
  link.className = "Button--link";
  link.href = `https://cdn.download.ams.birds.cornell.edu/api/v1${location.pathname}${isSound ? "" : "/2400"}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.innerHTML = `<svg class="Icon Icon--jumpDown" role="presentation"><use xlink:href="#Icon--jumpDown"></use></svg> <span>Download ${isSound ? "sound" : "2400px"}</span>`;
  actions.append(link);
})();
