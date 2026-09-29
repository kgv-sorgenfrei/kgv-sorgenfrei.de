const eleventyImage = require("@11ty/eleventy-img");
const path = require("path");

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Async shortcode that produces a responsive, lazy-loaded <img> (or <picture>)
 * for a source image living in src/assets/images.
 */
async function imageShortcode(
  src,
  alt,
  className = "",
  sizes = "100vw",
  widths = [400, 800, 1200, 1600],
  loading = "lazy"
) {
  if (!alt && alt !== "") {
    throw new Error(`Fehlendes alt-Attribut für Bild: ${src}`);
  }

  if (src.endsWith(".svg")) {
    const urlPath = path.isAbsolute(src) ? src : `/assets/images/${src}`;
    return `<img src="${escapeHtmlAttr(urlPath)}" alt="${escapeHtmlAttr(alt)}" loading="${escapeHtmlAttr(loading)}" decoding="async" class="${escapeHtmlAttr(className)}" />`;
  }

  const inputPath = path.isAbsolute(src)
    ? src
    : path.join("src/assets/images", src);

  const metadata = await eleventyImage.default(inputPath, {
    widths: [...widths, null],
    formats: ["webp", "jpeg"],
    outputDir: "_site/assets/images/optimized/",
    urlPath: "/assets/images/optimized/",
    filenameFormat: (id, imgSrc, width, format) => {
      const name = path.basename(imgSrc, path.extname(imgSrc));
      return `${name}-${width}w.${format}`;
    },
  });

  const imageAttributes = {
    alt,
    sizes,
    loading,
    decoding: "async",
    class: className,
  };

  return eleventyImage.generateHTML(metadata, imageAttributes);
}

module.exports = { imageShortcode };
