/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Warm wood tones (light oak → dark walnut)
        wood: {
          50: "#f8f3ec",
          100: "#efe2d2",
          200: "#dcc2a3",
          300: "#c6a077",
          400: "#a97a4a",
          500: "#8b5e34",
          600: "#6f4a2a",
          700: "#573a22",
          800: "#3f2a19",
          900: "#2b1d12",
          950: "#1b120b",
        },
        // Off-white / cream
        cream: {
          50: "#fdfbf7",
          100: "#faf6ee",
          200: "#f3ecdf",
          300: "#e8dcc8",
        },
      },
    },
  },
  plugins: [],
};
