/* Saves Macaulay Library media under its ML number once the user allows the optional "downloads" permission. */
(() => {
  "use strict";
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const MEDIA = /^https:\/\/cdn\.download\.ams\.birds\.cornell\.edu\/api\/v2\/asset\/\d+\/(?:2400|mp3)$/;
  const NAME = /^ML\d+\.(?:jpg|mp3)$/;

  async function save({ url, filename }) {
    if (!MEDIA.test(url) || !NAME.test(filename)) return { ok: false, reason: "invalid" };
    if (!api.downloads || !(await api.permissions.contains({ permissions: ["downloads"] }))) return { ok: false, reason: "permission" };
    await api.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false });
    return { ok: true };
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "zoziologie:download" || sender.id !== api.runtime.id) return false;
    save(message).then(sendResponse, (error) => sendResponse({ ok: false, reason: error.message }));
    return true; // Answer asynchronously.
  });
})();
