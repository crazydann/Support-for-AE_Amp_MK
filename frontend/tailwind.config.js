/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        amplitude: {
          blue: '#0066CC',
          dark: '#1A1A2E',
          purple: '#6C3EF4',
          light: '#F0F4FF',
        },
      },
    },
  },
  plugins: [],
}
