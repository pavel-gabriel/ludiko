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
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.6s ease-out forwards',
      },
    },
  },
  plugins: [],
};
