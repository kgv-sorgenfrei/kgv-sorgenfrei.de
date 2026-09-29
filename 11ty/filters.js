module.exports = function (eleventyConfig) {
  eleventyConfig.addFilter("formatDate", (value, format = "long") => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const options =
      format === "short"
        ? { day: "2-digit", month: "2-digit", year: "numeric" }
        : { day: "2-digit", month: "long", year: "numeric" };

    return new Intl.DateTimeFormat("de-DE", options).format(date);
  });

  eleventyConfig.addFilter("limit", (array, count) => {
    if (!Array.isArray(array)) return array;
    return array.slice(0, count);
  });

  eleventyConfig.addFilter("weekday", (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(date);
  });
};
