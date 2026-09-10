import type { Config } from 'tailwindcss';

// "Slate & Signal" — the palette is defined once, here, so every screen
// inherits it and nothing drifts into a generic default look.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        brand: {
          DEFAULT: '#1E293B',
          soft: '#334155',
          deep: '#0F172A',
        },
        accent: {
          DEFAULT: '#0F766E',
          soft: '#F0FDFA',
          strong: '#0B5F58',
        },
        ink: {
          DEFAULT: '#0F172A',
          body: '#475569',
          muted: '#64748B',
        },
        line: '#E2E8F0',
        pass: { DEFAULT: '#16A34A', bg: '#F0FDF4' },
        flag: { DEFAULT: '#DC2626', bg: '#FEF2F2' },
        review: { DEFAULT: '#D97706', bg: '#FFFBEB' },
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        lifted: '0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
