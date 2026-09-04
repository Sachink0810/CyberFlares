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
      },
      fontFamily: {
        sans: ['ui-sans-serif','system-ui','-apple-system','Segoe UI','Roboto','Inter','sans-serif'],
      },
    },
  },
  plugins: [],
};
