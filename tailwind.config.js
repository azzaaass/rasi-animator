/** @type {import('tailwindcss').Config} */
module.exports = {
  // Semua file yang memakai class Tailwind (termasuk class di dalam string JS)
  content: ["./index.html", "./pages/**/*.html", "./js/**/*.js"],
  theme: {
    extend: {},
  },
  plugins: [],
};
