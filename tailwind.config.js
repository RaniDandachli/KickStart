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
          950: '#060410',
          900: '#0a0618',
          800: '#140d28',
          700: '#1c1a3a',
        },
        neon: {
          lime: '#c8f31c',
          cyan: '#40e9ff',
          magenta: '#ff1a8c',
          amber: '#ffb020',
          /** RuniT Arcade — aligned with `lib/runitArcadeTheme` */
          pink: '#ff1a8c',
          runitCyan: '#40e9ff',
          purple: '#7b5cff',
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
