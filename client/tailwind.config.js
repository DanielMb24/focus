/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Roboto", "system-ui", "-apple-system", "sans-serif"] },
      colors: { accent: { DEFAULT: "#1d4ed8", dark: "#1e40af", light: "#eff6ff" } },
      boxShadow: {
        subtle: "0 1px 2px rgba(28,25,23,.06)",
        soft: "0 1px 2px rgba(28,25,23,.06)",
        lift: "0 1px 2px rgba(28,25,23,.07), 0 10px 28px -12px rgba(28,25,23,.25)",
        glow: "0 0 0 3px rgba(29,78,216,.18)",
      },
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
