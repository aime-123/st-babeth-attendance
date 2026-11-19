/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0d2d5d',
          light: '#edf4ff',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          slate: '#e2e8f0'
        }
      },
      boxShadow: {
        soft: '0 10px 25px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
}
