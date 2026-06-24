/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", "bg-2": "var(--bg-2)",
        surface: "var(--surface)", "surface-2": "var(--surface-2)",
        border: "var(--border)",
        ink: "var(--ink)", "ink-soft": "var(--ink-soft)", "ink-faint": "var(--ink-faint)",
        teal: "var(--teal)", cyan: "var(--cyan)", purple: "var(--purple)",
        green: "var(--green)", red: "var(--red)", amber: "var(--amber)",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
