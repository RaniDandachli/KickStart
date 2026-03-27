/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
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
        },
        pitch: {
          DEFAULT: '#0d3b2e',
          light: '#16664f',
        },
      },
    },
  },
  plugins: [],
};
