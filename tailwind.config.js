/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#649552",
          teal: "#57adae",
          orange: "#e95c2f",
          yellow: "#efc462"
        }
      }
    }
  },
  plugins: []
};
