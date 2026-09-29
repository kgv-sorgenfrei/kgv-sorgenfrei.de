const { minify } = require("html-minifier-terser");

module.exports = function (eleventyConfig) {
  eleventyConfig.addTransform("htmlmin", async function (content) {
    const isProduction = process.env.ELEVENTY_ENV === "production";
    const isHtml = (this.page && this.page.outputPath || "").endsWith(".html");

    if (isProduction && isHtml) {
      return minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }

    return content;
  });
};
