/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dde5ff',
          200: '#c2cfff',
          300: '#9aaeff',
          400: '#7081fc',
          500: '#4f56f7',
          600: '#3a37eb',
          700: '#2f2ccf',
          800: '#2828a7',
          900: '#282883',
          950: '#18184d',
        },
      },
    },
  },
  plugins: [],
}
