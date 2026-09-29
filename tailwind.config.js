/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{njk,html,md,js}"],
  theme: {
    extend: {
      colors: {
        // nature palette derived from the club logo
        moss: {
          50: "#f4f7e9",
          100: "#e6edc9",
          200: "#cfdd9b",
          300: "#b3cb68",
          400: "#a2b922",
          500: "#8ca41d",
          600: "#6f8317",
          700: "#566613",
          800: "#3f4a0f",
          900: "#2c340b"
        },
        leaf: {
          50: "#eef5ea",
          100: "#d6e8cb",
          200: "#aed197",
          300: "#82b862",
          400: "#63a03f",
          500: "#52812d",
          600: "#436824",
          700: "#35521c",
          800: "#273c14",
          900: "#1a290d"
        },
        sun: {
          50: "#fffbe8",
          100: "#fff3bf",
          200: "#ffe685",
          300: "#ffd94a",
          400: "#fecc00",
          500: "#e0b400",
          600: "#b58f00",
          700: "#8a6c00",
          800: "#5f4a00",
          900: "#3d2f00"
        },
        poppy: {
          400: "#eb4a4f",
          500: "#e31e24",
          600: "#c11319",
          700: "#9c1015"
        },
        // anthracite/coal tone nodding to the neighboring Zeche Pluto colliery
        coal: {
          50: "#f3f4f4",
          100: "#e2e4e4",
          200: "#c3c8c8",
          300: "#9aa2a2",
          400: "#6f7979",
          500: "#525d5d",
          600: "#3f4848",
          700: "#333a3a",
          800: "#262b2b",
          900: "#1a1e1e",
          950: "#101313"
        }
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
        display: ["'Fraunces'", "Georgia", "serif"]
      }
    }
  },
  plugins: []
};
