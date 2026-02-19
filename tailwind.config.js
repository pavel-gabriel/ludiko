/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ludiko: {
          pink: '#FFB6C1',
          blue: '#87CEEB',
          green: '#98FB98',
          yellow: '#FFFACD',
          purple: '#DDA0DD',
          orange: '#FFDAB9',
          bg: '#FFF8F0',
          text: '#4A4A4A',
        },
      },
      fontFamily: {
        nunito: ['Nunito', 'sans-serif'],
        dyslexic: ['OpenDyslexic', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
