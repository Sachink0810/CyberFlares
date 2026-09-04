/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink:    { 900: "#0b1220", 800: "#0f1a30", 700: "#152341", 600: "#1c2c50" },
        line:   "#23324f",
        muted:  "#90a0bd",
        text:   "#e6edf7",
        brand:  { 400: "#7aa2ff", 500: "#5b8def", 600: "#3f6dd6" },
        flood:  { 300: "#78d1ff", 500: "#3aa3e0", 700: "#1a5f8a" },
        danger: "#ef4444",

        // FLOOD//SIM landing palette
        abyss:    "#070A0B",
        graphite: "#0D1112",
        cream:    "#F1F0EA",
        mist:     "#9EA4A3",
        steel:    "#6E7675",
        water:    "#6E9DA5",
        ember:    "#C8785F",
      },
      fontFamily: {
        sans: ['Inter','ui-sans-serif','system-ui','-apple-system','Segoe UI','Roboto','sans-serif'],
        serif: ['"Instrument Serif"','"Cormorant Garamond"','Georgia','serif'],
      },
      keyframes: {
        grain: {
          "0%, 100%": { transform: "translate(0,0)" },
          "10%":  { transform: "translate(-1%,-2%)" },
          "20%":  { transform: "translate(-3%,1%)" },
          "30%":  { transform: "translate(2%,-3%)" },
          "40%":  { transform: "translate(-2%,3%)" },
          "50%":  { transform: "translate(3%,1%)" },
          "60%":  { transform: "translate(-1%,2%)" },
          "70%":  { transform: "translate(1%,-1%)" },
          "80%":  { transform: "translate(-2%,-2%)" },
          "90%":  { transform: "translate(2%,2%)" },
        },
        "slow-zoom": {
          "0%":   { transform: "scale(1.03)" },
          "100%": { transform: "scale(1)" },
        },
        "drift-fog": {
          "0%":   { transform: "translateX(-2%) translateY(0)" },
          "50%":  { transform: "translateX(2%) translateY(-1%)" },
          "100%": { transform: "translateX(-2%) translateY(0)" },
        },
        "scroll-line": {
          "0%":   { transform: "scaleY(0)", transformOrigin: "top" },
          "50%":  { transform: "scaleY(1)", transformOrigin: "top" },
          "50.01%": { transformOrigin: "bottom" },
          "100%": { transform: "scaleY(0)", transformOrigin: "bottom" },
        },
        "fog-drift-bg": {
          "0%, 100%": { transform: "translate3d(0px, 0px, 0) scale(1)" },
          "50%":      { transform: "translate3d(8px, -6px, 0) scale(1.03)" },
        },
        "fog-drift-mid": {
          "0%, 100%": { transform: "translate3d(0px, 0px, 0) scale(1)" },
          "50%":      { transform: "translate3d(-14px, 9px, 0) scale(1.05)" },
        },
        "fog-drift-fg": {
          "0%, 100%": { transform: "translate3d(0px, 0px, 0) scale(1)" },
          "50%":      { transform: "translate3d(18px, -11px, 0) scale(1.06)" },
        },
        "fog-reveal": {
          "0%":   { opacity: "0.92", transform: "scale(1.05) translateX(-1.5%)" },
          "15%":  { opacity: "0.85", transform: "scale(1.045) translateX(-1%)" },
          "31%":  { opacity: "0.62", transform: "scale(1.03) translateX(0.5%)" },
          "47%":  { opacity: "0.4",  transform: "scale(1.02) translateX(1%)" },
          "69%":  { opacity: "0.18", transform: "scale(1.01) translateX(0.5%)" },
          "94%":  { opacity: "0.04", transform: "scale(1.0) translateX(0%)" },
          "100%": { opacity: "0",    transform: "scale(1.0) translateX(0%)" },
        },
      },
      animation: {
        grain: "grain 8s steps(10) infinite",
        "slow-zoom": "slow-zoom 20s ease-out forwards",
        "drift-fog": "drift-fog 40s ease-in-out infinite",
        "scroll-line": "scroll-line 2.2s ease-in-out infinite",
        "fog-drift-bg": "fog-drift-bg 60s ease-in-out infinite",
        "fog-drift-mid": "fog-drift-mid 40s ease-in-out infinite",
        "fog-drift-fg": "fog-drift-fg 26s ease-in-out infinite",
        "fog-reveal": "fog-reveal 3.2s cubic-bezier(0.22,1,0.36,1) forwards",
      },
    },
  },
  plugins: [],
};
