/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#1cc29f", // Splitwise Green
        dark: "#121212",  // Background Black
        card: "#1E1E1E",  // Card Dark Gray
        danger: "#ff5252", // Red/Orange
        textSec: "#a3a3a3" // Secondary Text
      }
    },
  },
  plugins: [],
}