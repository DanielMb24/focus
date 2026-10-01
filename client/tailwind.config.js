/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Roboto", "system-ui", "-apple-system", "sans-serif"], display: ["Fraunces", "Georgia", "serif"] },
      colors: {
        accent: { DEFAULT: "#1d4ed8", dark: "#1e40af", light: "#eff6ff" },
        brand: { 50: "#eff4ff", 100: "#dbe6ff", 500: "#1d4ed8", 600: "#1d4ed8", 700: "#1e40af" },
        ink: { 900: "#1b1712", 500: "#6b655c", 400: "#a39c90" },
        card: { blue: "#1d4ed8", violet: "#6d28d9", peach: "#b45309", mint: "#047857", sky: "#0e7490", amber: "#92400e" },
        cream: "#f3f0e9",
        paper: "#faf9f7",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(22,19,14,.05)",
        soft: "0 1px 2px rgba(22,19,14,.05)",
        lift: "0 1px 2px rgba(22,19,14,.06), 0 8px 20px -12px rgba(22,19,14,.18)",
        glow: "0 0 0 3px rgba(29,78,216,.16)",
        card: "0 1px 2px rgba(22,19,14,.05)",
        float: "0 1px 2px rgba(22,19,14,.08)",
      },
      borderRadius: { "4xl": "1.25rem", "5xl": "1.5rem" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pop: { "0%": { opacity: "0", transform: "scale(.98)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        "sheet-up": { from: { opacity: "0", transform: "translateY(32px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        overlay: { from: { opacity: "0" }, to: { opacity: "1" } },
        check: { "0%": { transform: "scale(.5)" }, "60%": { transform: "scale(1.15)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "fade-up": "fade-up .3s ease-out both",
        pop: "pop .2s ease-out both",
        "sheet-up": "sheet-up .3s ease-out both",
        overlay: "overlay .2s ease both",
        check: "check .25s ease-out both",
      },
    },
  },
  plugins: [],
};
