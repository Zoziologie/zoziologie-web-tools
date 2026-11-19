(() => {
  "use strict";
  const CDN = "https://cdn.download.ams.birds.cornell.edu/api/v2/asset";

  Zoziologie.feature("macaulayDownload", () => {
    const id = location.pathname.match(/\/asset\/(\d+)/)?.[1];
    if (!id) return;

    // Decide from what the page shows: every page mentions "microphone" in its embedded data.
    function mediaType() {
      if (document.querySelector("audio, [class*='pectrogram' i]")) return "sound";
      if (document.querySelector("video")) return "video";
      if (Array.from(document.images).some((img) => (img.currentSrc || img.src).includes(`/asset/${id}/`))) return "photo";
      return null;
    }

    /** Add the button once the page shows its actions bar and media; does nothing if it is already there. */
    function install() {
      if (document.querySelector("#zoziologie-ml-download")) return;
      const actions = document.querySelector(".actions");
      const type = mediaType();
      if (!actions || !type) return;
      if (type === "video") return; // No public resized video: keep Macaulay's own controls.
      const sound = type === "sound";
      const filename = `ML${id}.${sound ? "mp3" : "jpg"}`;
      // Keep our own copy: the page's analytics adds a ?_gl= parameter to link addresses.
      const url = `${CDN}/${id}/${sound ? "mp3" : "2400"}`;
      const link = document.createElement("a");
      link.id = "zoziologie-ml-download";
      link.className = "Button--link";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = sound ? `Save the sound as ${filename}` : `Save the photo (2400 px) as ${filename}`;
      link.innerHTML = '<svg class="Icon Icon--jumpDown" role="presentation"><use xlink:href="#Icon--jumpDown"></use></svg> ';
      const label = document.createElement("span");
      label.textContent = sound ? "Download MP3" : "Download 2400px";
      link.append(label);
      link.addEventListener("click", (event) => save(event, link, url, filename));
      actions.append(link);
    }

    // Cross-origin links ignore the download attribute, so the background script saves the file instead.
    // Without the optional "downloads" permission, fall back to opening the file in a new tab.
    function save(event, link, url, filename) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      Zoziologie.runAction(link, async () => {
        let response;
        try {
          response = await Zoziologie.api.runtime.sendMessage({ type: "zoziologie:download", url, filename });
        } catch {
          response = { ok: false, reason: "unavailable" };
        }
        if (response?.ok) {
          Zoziologie.notify(`Saving ${filename}`, { type: "success", timeout: 4000 });
          return;
        }
        window.open(url, "_blank", "noopener");
        if (response?.reason === "permission") {
          Zoziologie.notify(`Opened in a new tab. To save files as ${filename} instead, click the Zoziologie icon in the toolbar and choose Allow downloads.`, { timeout: 10000 });
        } else {
          console.warn("Zoziologie: download fell back to a new tab", response);
        }
      });
    }

    // The asset page renders its media and buttons after load, sometimes after a bot check,
    // and may re-render its header afterwards: keep the button in place for 30 s.
    Zoziologie.keep(install, 30000);
  });
})();
