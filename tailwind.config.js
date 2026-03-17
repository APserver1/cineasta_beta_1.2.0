/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6d28d9', // Purple 700
        secondary: '#8b5cf6', // Violet 500
        dark: '#1e1b4b', // Indigo 950
      },
    },
  },
  plugins: [],
}
