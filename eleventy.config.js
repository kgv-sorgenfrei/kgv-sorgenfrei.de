const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const filters = require("./11ty/filters.js");
const transforms = require("./11ty/transforms.js");
const { imageShortcode } = require("./11ty/image.js");

module.exports = function (eleventyConfig) {
  // Copy static assets through unchanged
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/videos");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("src/assets/favicons");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
  eleventyConfig.addPassthroughCopy({ "src/site.webmanifest": "site.webmanifest" });
  eleventyConfig.addPassthroughCopy({ "src/.htaccess": ".htaccess" });
  eleventyConfig.addPassthroughCopy({ "src/.htpasswd": ".htpasswd" });

  eleventyConfig.addWatchTarget("src/assets/css/tailwind.css");
  eleventyConfig.addWatchTarget("tailwind.config.js");

  eleventyConfig.addPlugin(filters);
  eleventyConfig.addPlugin(transforms);

  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Cache-busting: append a short content hash so browsers refetch CSS/JS after a deploy
  eleventyConfig.addShortcode("assetUrl", (url) => {
    const hash = crypto
      .createHash("md5")
      .update(fs.readFileSync(path.join("src", url)))
      .digest("hex")
      .slice(0, 8);
    return `${url}?v=${hash}`;
  });

  eleventyConfig.addFilter("findBy", (array, key, value) => {
    if (!Array.isArray(array)) return undefined;
    return array.find((item) => item[key] === value);
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
};
