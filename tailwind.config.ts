import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chrome: {
          50: '#f6f8fb',
          100: '#e7edf4',
          200: '#cfd9e6',
          700: '#314152',
          800: '#1f2a37',
          900: '#111827'
        }
      },
      boxShadow: {
        pane: '0 1px 0 rgba(255,255,255,.08) inset, 0 8px 24px rgba(15,23,42,.08)'
      }
    }
  },
  plugins: []
} satisfies Config;
