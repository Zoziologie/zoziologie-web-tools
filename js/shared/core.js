/* Shared by content scripts in the isolated world and by the popup; loaded first by manifest.json. */
(() => {
  "use strict";
  if (globalThis.Zoziologie) return;

  // Firefox exposes promise-based APIs on `browser`; Chrome's MV3 `chrome` APIs return promises too.
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const DEFAULTS = Object.freeze({ disabled: [] });
  const current = { ...DEFAULTS, disabled: [] };

  const settings = (async () => {
    try {
      Object.assign(current, await api?.storage?.sync?.get({ ...DEFAULTS }));
    } catch (error) {
      console.warn("Zoziologie: settings unavailable, using defaults.", error);
    }
    return current;
  })();

  api?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in DEFAULTS) current[key] = newValue ?? DEFAULTS[key];
    }
  });

  // Lets the popup tell whether the extension is active in a tab.
  api?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    if (message?.type === "zoziologie:ping") sendResponse({ active: true });
  });

  async function saveSettings(changes) {
    Object.assign(current, changes);
    await api?.storage?.sync?.set(changes);
  }

  /** Run `start` once settings are known, unless the user turned the feature off in the popup. */
  async function feature(id, start) {
    const { disabled } = await settings;
    if (!disabled.includes(id)) return start();
  }

  /**
   * Run an idempotent `insert` now and again whenever the page changes, for `duration` ms.
   * Some eBird pages re-render their menus just after load, which would wipe added links.
   */
  function keep(insert, duration = 10000) {
    insert();
    // Mutation callbacks are already batched; `insert` must do nothing when its element is present.
    const observer = new MutationObserver(() => {
      if (globalThis.document?.defaultView) insert();
      else observer.disconnect(); // The page is gone.
    });
    // Observe the document itself so a replaced <html> (e.g. after a bot check) is still seen.
    observer.observe(document, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), duration);
  }

  /** The page's query string for file names, without the `continue` flag eBird's bot check adds. */
  function pageQuery() {
    const params = new URLSearchParams(location.search);
    params.delete("continue");
    return params.toString();
  }

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
    if (!rows.length) throw new Error("Nothing to download. Display the results on the page and try again.");
    const blob = new Blob(["\uFEFF", csv(rows, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 190) + ".csv";
    document.body.append(link);
    link.click();
    link.remove();
    // Give the browser time to consume the object URL before releasing its memory.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const count = rows.length === 1 ? "1 row" : `${rows.length.toLocaleString()} rows`;
    const name = link.download.length > 48 ? `${link.download.slice(0, 30)}…${link.download.slice(-15)}` : link.download;
    globalThis.Zoziologie.notify(`Downloaded ${count} · ${name}`, { type: "success" });
  }

  async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`The website answered with an error (${response.status}). Please try again.`);
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
      globalThis.Zoziologie.notify(error.message, { type: "error" });
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

  // Toasts live in a shadow root so the host page's styles cannot change them.
  const TOAST_CSS = `
    :host { all: initial; }
    .stack { position: fixed; z-index: 2147483647; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; width: min(380px, calc(100vw - 32px)); }
    .toast { display: grid; grid-template-columns: 6px 1fr auto; align-items: start; overflow: hidden; border-radius: 10px;
      background: #1d2024; color: #f4f1ea; font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 10px 30px rgb(0 0 0 / .25), 0 2px 6px rgb(0 0 0 / .2); animation: in .18s ease-out; }
    .bar { align-self: stretch; background: #f4b740; }
    .success .bar { background: #3fb950; }
    .error .bar { background: #f85149; }
    .body { padding: 10px 4px 11px 12px; }
    .label { display: block; margin-bottom: 1px; color: #b9b4a8; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
    .message { margin: 0; overflow-wrap: anywhere; }
    button { margin: 6px 6px 0 0; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: #b9b4a8; font: 18px/1 system-ui, sans-serif; cursor: pointer; }
    button:hover { background: rgb(255 255 255 / .1); color: #fff; }
    button:focus-visible { outline: 2px solid #f4b740; outline-offset: 1px; }
    @keyframes in { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }`;
  let stack;

  /** Show a short message in the page. type: "info" | "success" | "error"; timeout 0 keeps it until closed. */
  function notify(message, { type = "info", timeout = type === "error" ? 12000 : type === "success" ? 5000 : 0 } = {}) {
    if (!stack?.isConnected) {
      const host = document.createElement("zoziologie-toasts");
      const root = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = TOAST_CSS;
      stack = document.createElement("div");
      stack.className = "stack";
      root.append(style, stack);
      (document.body ?? document.documentElement).append(host);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `<span class="bar"></span><div class="body"><span class="label">Zoziologie</span><p class="message"></p></div><button type="button" aria-label="Dismiss">×</button>`;
    const text = toast.querySelector(".message");
    text.textContent = message;
    let timer;
    const close = () => {
      clearTimeout(timer);
      toast.remove();
    };
    toast.querySelector("button").addEventListener("click", close);
    if (timeout) timer = setTimeout(close, timeout);
    stack.append(toast);
    return { close, update: (next) => { text.textContent = next; } };
  }

  globalThis.Zoziologie = { api, DEFAULTS, settings, saveSettings, feature, keep, pageQuery, csv, downloadCSV, fetchJSON, runAction, mapConcurrent, notify };
})();
