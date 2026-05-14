/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
    './minigames/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B0B0D',
          900: '#121214',
          800: '#161618',
          700: '#18181B',
        },
        neon: {
          lime: '#c8f31c',
          cyan: '#ffd700',
          magenta: '#e879f9',
          amber: '#ffd700',
          /** Run It Arcade — purple + gold */
          pink: '#e879f9',
          runitCyan: '#ffd700',
          purple: '#a855f7',
        },
        pitch: {
          DEFAULT: '#0d3b2e',
          light: '#16664f',
        },
        sport: {
          bg: '#FAF5FF',
          card: '#FFFFFF',
          border: '#E9D5FF',
          text: '#1E1B4B',
          muted: '#7C3AED',
          accent: '#C026D3',
          'accent-dark': '#86198F',
          'accent-soft': '#F5D0FE',
        },
      },
    },
  },
  plugins: [],
};
