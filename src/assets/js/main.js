// Mobile navigation toggle
(function () {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("mobile-nav");
  const iconMenu = document.getElementById("icon-menu");
  const iconClose = document.getElementById("icon-close");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = !nav.classList.contains("hidden");
    nav.classList.toggle("hidden", isOpen);
    toggle.setAttribute("aria-expanded", String(!isOpen));
    iconMenu.classList.toggle("hidden", !isOpen);
    iconClose.classList.toggle("hidden", isOpen);
  });
})();

// Re-align initial #hash scroll once fonts/images have settled the layout
(function () {
  if (!location.hash) return;
  const target = document.getElementById(location.hash.slice(1));
  if (!target) return;

  const scrollToTarget = () => target.scrollIntoView({ block: "start" });
  if (document.readyState === "complete") {
    scrollToTarget();
  } else {
    window.addEventListener("load", scrollToTarget, { once: true });
  }
})();

// Lightbox for gallery images and inline SVG diagrams/schematics
(function () {
  const triggers = document.querySelectorAll("[data-lightbox-trigger]");
  if (!triggers.length) return;

  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-50 hidden items-center justify-center bg-coal-950/90 p-4 sm:p-8";
  overlay.innerHTML =
    '<button type="button" data-close class="absolute right-4 top-4 rounded-sm bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Schließen"><svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
    '<div data-content class="flex max-h-full max-w-full items-center justify-center"></div>' +
    '<p class="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[90%] rounded-sm bg-coal-950/80 px-3 py-1.5 text-center text-sm text-white/90"></p>';
  document.body.appendChild(overlay);

  const content = overlay.querySelector("[data-content]");
  const caption = overlay.querySelector("p");
  let svgCloneCount = 0;

  // Inline SVGs (diagrams/schematics) can define ids for markers, gradients, etc.
  // Cloning one into the overlay would duplicate those ids in the document, so
  // every id and its url(#...)/href="#..." references get rewritten to stay unique.
  function cloneSvgForLightbox(svg) {
    const clone = svg.cloneNode(true);
    const suffix = `-lightbox${svgCloneCount++}`;
    const idMap = new Map();

    clone.querySelectorAll("[id]").forEach((el) => {
      const newId = el.id + suffix;
      idMap.set(el.id, newId);
      el.id = newId;
    });

    const urlRefAttrs = ["fill", "stroke", "marker-start", "marker-mid", "marker-end", "clip-path", "mask", "filter"];
    clone.querySelectorAll("*").forEach((el) => {
      urlRefAttrs.forEach((attr) => {
        const value = el.getAttribute(attr);
        const match = value && value.match(/^url\(#(.+)\)$/);
        if (match && idMap.has(match[1])) {
          el.setAttribute(attr, `url(#${idMap.get(match[1])})`);
        }
      });
      ["href", "xlink:href"].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value && value.startsWith("#") && idMap.has(value.slice(1))) {
          el.setAttribute(attr, `#${idMap.get(value.slice(1))}`);
        }
      });
    });

    // An <svg> with only a viewBox (no width/height attributes) has no
    // reliable intrinsic size for the flexbox sizing algorithm — some
    // browsers collapse it to 0x0 here, since max-width/max-height alone
    // only cap a size, they don't establish one. Giving it real width/height
    // attributes (derived from the viewBox) makes it size like a normal
    // image, which max-w-full/h-auto/max-h-[85vh] can then scale down.
    const viewBox = clone.getAttribute("viewBox");
    const dimensions = viewBox && viewBox.trim().split(/\s+/).map(Number);
    if (dimensions && dimensions.length === 4 && dimensions[2] > 0 && dimensions[3] > 0) {
      clone.setAttribute("width", dimensions[2]);
      clone.setAttribute("height", dimensions[3]);
    }

    clone.setAttribute("class", "h-auto max-h-[85vh] max-w-full");
    return clone;
  }

  function open(node, captionText) {
    content.innerHTML = "";
    content.appendChild(node);
    caption.textContent = captionText || "";
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function close() {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    content.innerHTML = "";
  }

  // The inline <img> only ever loads the small srcset candidate picked for
  // its thumbnail-sized display slot (currentSrc), so opening that in the
  // lightbox would just blow up a low-res image. The full-resolution file is
  // still available as the widest candidate in the <picture>'s srcset lists.
  function widestSrcsetUrl(picture) {
    let bestUrl = null;
    let bestWidth = -1;
    picture.querySelectorAll("source[srcset]").forEach((source) => {
      source
        .getAttribute("srcset")
        .split(",")
        .forEach((candidate) => {
          const [url, descriptor] = candidate.trim().split(/\s+/);
          const width = descriptor && descriptor.endsWith("w") ? parseInt(descriptor, 10) : 0;
          if (url && width > bestWidth) {
            bestWidth = width;
            bestUrl = url;
          }
        });
    });
    return bestUrl;
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const pictureImg = trigger.querySelector("img");
      if (pictureImg) {
        const picture = pictureImg.closest("picture");
        const img = document.createElement("img");
        img.className = "max-h-[calc(100dvh-4rem)] max-w-full rounded-sm object-contain";
        img.src = (picture && widestSrcsetUrl(picture)) || pictureImg.currentSrc || pictureImg.src;
        img.alt = pictureImg.alt || "";
        open(img, pictureImg.alt);
        return;
      }

      const svg = trigger.querySelector("svg");
      if (svg) {
        const title = svg.querySelector("title");
        const wrapper = document.createElement("div");
        wrapper.className = "max-h-[calc(100dvh-4rem)] max-w-full overflow-auto rounded-sm bg-white p-4";
        wrapper.appendChild(cloneSvgForLightbox(svg));
        open(wrapper, trigger.getAttribute("data-caption") || (title && title.textContent) || "");
      }
    });
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-close]")) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
})();
