(() => {
  "use strict";
  const { sites, features, biolovisionHosts, siteFor, featuresFor } = globalThis.ZoziologieCatalog;
  const { api, settings, saveSettings } = globalThis.Zoziologie;
  const $ = (selector) => document.querySelector(selector);
  const manifest = api?.runtime?.getManifest?.() ?? { version: "", content_scripts: [] };

  let tab;
  let state;

  // Content-script match patterns (scheme://host/path-glob), tested against path and query like the browser does.
  function patternsFor(url) {
    return manifest.content_scripts.flatMap((entry) => entry.matches).filter((pattern) => {
      const [, scheme, host, glob] = pattern.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/) ?? [];
      if (!host || host !== url.hostname) return false;
      if (scheme !== "*" && `${scheme}:` !== url.protocol) return false;
      const regex = new RegExp(`^${glob.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
      return regex.test(url.pathname + url.search);
    });
  }

  async function ping(tabId) {
    try {
      return Boolean((await api.tabs.sendMessage(tabId, { type: "zoziologie:ping" }))?.active);
    } catch {
      return false;
    }
  }

  async function hasAccess(patterns) {
    try {
      return await api.permissions.contains({ origins: patterns });
    } catch {
      return true;
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function showApplyBar() {
    const url = tab?.url && new URL(tab.url);
    $("#applybar").hidden = !(url && patternsFor(url).length);
  }

  async function renderHere() {
    const here = $("#here");
    here.replaceChildren();
    here.className = "here";
    const url = tab?.url ? new URL(tab.url) : null;
    const site = url && siteFor(url.href);
    here.hidden = false;

    if (!site) {
      here.classList.add("idle");
      here.append(
        element("p", "here-title", "Nothing to do on this page"),
        element("p", "here-text", "Open eBird, Macaulay Library or a Biolovision portal such as ornitho or faune-france. The tools appear on the page itself."),
      );
      return;
    }

    const patterns = patternsFor(url);
    const matched = featuresFor(url.href);
    const running = patterns.length ? await ping(tab.id) : false;

    if (patterns.length && !running) {
      const allowed = await hasAccess(patterns);
      here.classList.add(allowed ? "notice" : "warn");
      here.append(
        element("p", "here-title", allowed ? "Not running in this tab yet" : `No access to ${url.hostname}`),
        element("p", "here-text", allowed
          ? "This tab was open before the extension was installed or updated. Reload it to add the tools."
          : "Your browser blocks Zoziologie on this site. Allow access to add the tools to this page."),
      );
      const button = element("button", "button primary", allowed ? "Reload page" : "Allow on this site");
      button.type = "button";
      button.addEventListener("click", async () => {
        // Firefox needs permissions.request() to start directly inside the click handler.
        const request = allowed ? Promise.resolve(true) : api.permissions.request({ origins: patterns });
        try {
          if (await request) {
            await api.tabs.reload(tab.id);
            window.close();
          }
        } catch (error) {
          here.querySelector(".here-text").textContent = `Access could not be changed here (${error.message}). Use the extension's site access settings instead.`;
        }
      });
      here.append(button);
      return;
    }

    if (!matched.length) {
      here.classList.add("idle");
      here.append(element("p", "here-title", site.name), element("p", "here-text", site.hint));
      return;
    }

    here.classList.add("ready");
    here.append(element("p", "here-title", `Active on this ${site.name} page`));
    const names = matched.map((feature) => feature.name + (state.disabled.includes(feature.id) ? " (off)" : ""));
    here.append(element("p", "here-text", names.join(" · ")));
    // Surface optional permissions here too, so they are not hidden in a collapsed group.
    for (const feature of matched) {
      if (feature.permission && !state.disabled.includes(feature.id)) here.append(renderPermission(feature.permission));
    }
  }

  /** Optional permission a tool can use, e.g. "downloads" to save Macaulay files under their ML number. */
  function renderPermission({ name, missing, granted, button: label }) {
    const box = element("div", "permission");
    const text = element("p", "", missing);
    const button = element("button", "button small", label);
    button.type = "button";
    box.append(text, button);
    const show = (has) => {
      box.classList.toggle("granted", has);
      text.textContent = has ? granted : missing;
      button.hidden = has;
    };
    button.addEventListener("click", async () => {
      // Firefox needs permissions.request() to start directly inside the click handler.
      const request = api.permissions.request({ permissions: [name] });
      try {
        show(await request);
      } catch (error) {
        text.textContent = `Could not ask for this permission (${error.message}).`;
      }
    });
    api?.permissions?.contains({ permissions: [name] }).then(show, () => {});
    return box;
  }

  function renderFeatures() {
    const container = $("#sites");
    const template = $("#feature-row");
    const current = new Set(tab?.url ? featuresFor(tab.url).map((feature) => feature.id) : []);
    container.replaceChildren();

    const currentSite = tab?.url ? siteFor(tab.url) : undefined;
    for (const site of sites) {
      const count = features.filter((item) => item.site === site.id).length;
      const section = element("details", "group");
      section.open = !currentSite || currentSite.id === site.id;
      const summary = element("summary");
      const tools = count === 1 ? "1 tool" : `${count} tools`;
      summary.append(element("h2", "", site.name), element("span", "count", site.id === "biolovision" ? `${tools} · ${biolovisionHosts.length} portals` : tools));
      section.append(summary);

      const list = element("ul", "features");
      for (const feature of features.filter((item) => item.site === site.id)) {
        const row = template.content.firstElementChild.cloneNode(true);
        const input = row.querySelector("input");
        const id = `feature-${feature.id}`;
        input.id = id;
        input.checked = !state.disabled.includes(feature.id);
        input.setAttribute("aria-describedby", `${id}-how`);
        row.querySelector(".name").htmlFor = id;
        row.querySelector(".name").textContent = feature.name;
        row.querySelector(".how-text").id = `${id}-how`;
        row.querySelector(".how-text").textContent = feature.how;
        const open = row.querySelector(".open");
        if (feature.open) {
          open.href = feature.open;
          open.setAttribute("aria-label", `Open ${feature.name} page`);
        } else open.remove();
        if (current.has(feature.id)) {
          row.classList.add("current");
          row.querySelector(".name").append(element("span", "badge", "This page"));
        }
        if (feature.permission) row.querySelector(".text").append(renderPermission(feature.permission));
        input.addEventListener("change", async () => {
          state.disabled = input.checked
            ? state.disabled.filter((item) => item !== feature.id)
            : [...new Set([...state.disabled, feature.id])];
          await saveSettings({ disabled: state.disabled });
          showApplyBar();
          renderHere();
        });
        list.append(row);
      }
      section.append(list);

      if (site.id === "biolovision") {
        const details = element("details", "portals");
        details.append(element("summary", "", `${biolovisionHosts.length} supported portals`));
        const portals = element("ul");
        for (const host of biolovisionHosts) {
          const link = element("a", "", host.replace(/^www\./, ""));
          link.href = `https://${host}/`;
          link.target = "_blank";
          link.rel = "noopener";
          const item = element("li");
          item.append(link);
          portals.append(item);
        }
        details.append(portals);
        section.append(details);
      }
      container.append(section);
    }
  }

  async function init() {
    $("#version").textContent = manifest.version ? `v${manifest.version}` : "";
    state = { ...(await settings) };
    state.disabled = [...state.disabled];
    try {
      [tab] = await api.tabs.query({ active: true, currentWindow: true });
    } catch {
      tab = undefined;
    }
    renderFeatures();
    $("#reload").addEventListener("click", async () => {
      await api.tabs.reload(tab.id);
      window.close();
    });
    await renderHere();
  }

  init();
})();
