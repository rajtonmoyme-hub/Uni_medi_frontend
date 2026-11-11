/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6f1',
          100: '#d7e9de',
          200: '#b9d9c6',
          400: '#2e9c64',
          500: '#17864e',
          600: '#0b6e3e',
          700: '#005830',
          800: '#00401f',
          900: '#002a17',
        },
        accent: {
          50: '#fdf1f1',
          100: '#faddde',
          500: '#d82028',
          600: '#a3151c',
          700: '#a3151c',
          800: '#5e0c10',
        },
        gold: {
          50: '#fdf9ef',
          100: '#f3e9cf',
          700: '#9a7220',
        },
        ink: {
          DEFAULT: '#101613',
          2: '#2b3831',
        },
        mut: {
          DEFAULT: '#5c6b62',
          2: '#7c8b82',
        },
        line: {
          DEFAULT: '#e3eae5',
          2: '#eff4f0',
        },
        paper: {
          DEFAULT: '#ffffff',
          2: '#f8faf8',
          3: '#f0f5f1',
        },
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'sans-serif',
        ],
        mono: [
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.45' }],
        sm: ['0.8125rem', { lineHeight: '1.5' }],
        base: ['0.875rem', { lineHeight: '1.5' }],
        lg: ['1rem', { lineHeight: '1.45' }],
        xl: ['1.125rem', { lineHeight: '1.35' }],
        '2xl': ['1.25rem', { lineHeight: '1.3' }],
      },
    },
  },
  plugins: [],
};
