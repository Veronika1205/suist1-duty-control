/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      colors: {
        ink: '#07111f',
        panel: '#0b1829',
        line: '#1b2d42',
        signal: '#f5b82e',
      },
    },
  },
  plugins: [],
}
