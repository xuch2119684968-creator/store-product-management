/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          500: "#1d68d9",
          600: "#1558be",
          700: "#124998"
        }
      }
    }
  },
  plugins: []
};
