/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d1117',
        surface: '#161b22',
        surfaceBorder: '#30363d',
        accent: '#238636',
        accentHover: '#2ea043',
        cyberBlue: '#58a6ff',
        cyberRed: '#f85149',
      }
    },
  },
  plugins: [],
}

