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
          950: '#06080f',
          900: '#0a0e18',
          800: '#12182a',
          700: '#1c2540',
        },
        neon: {
          lime: '#c8f31c',
          cyan: '#2ee6d6',
          magenta: '#ff3dac',
          amber: '#ffb020',
          /** RuniT Arcade (see DESIGN_SYSTEM.md) */
          pink: '#ff006e',
          runitCyan: '#00f0ff',
          purple: '#9d4edd',
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
