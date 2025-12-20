/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // FrySwap brand colors from logo
        fry: {
          red: '#FF0000',
          'red-dark': '#CC0000',
          crimson: '#8B0000',
          'crimson-dark': '#660000',
          black: '#0A0A0A',
        },
        // Semantic colors
        primary: {
          50: '#FFF5F5',
          100: '#FFE0E0',
          200: '#FFB3B3',
          300: '#FF8080',
          400: '#FF4D4D',
          500: '#FF0000',
          600: '#CC0000',
          700: '#990000',
          800: '#660000',
          900: '#330000',
        },
        surface: {
          dark: '#0A0A0A',
          DEFAULT: '#121212',
          light: '#1A1A1A',
          lighter: '#242424',
        },
      },
      backgroundImage: {
        'fry-gradient': 'linear-gradient(135deg, #FF0000 0%, #8B0000 100%)',
        'fry-gradient-dark': 'linear-gradient(135deg, #CC0000 0%, #660000 100%)',
      },
      boxShadow: {
        'fry-glow': '0 0 20px rgba(255, 0, 0, 0.3)',
        'fry-glow-lg': '0 0 40px rgba(255, 0, 0, 0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
