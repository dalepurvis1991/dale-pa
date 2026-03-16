import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f9faf6',
          100: '#f3f5ed',
          200: '#e7ebdb',
          300: '#dae0c8',
          400: '#c4d1a8',
          500: '#a8b882',
          600: '#8a9a66',
          700: '#6d7a52',
          800: '#5a6642',
          900: '#4a5436',
        },
      },
    },
  },
  plugins: [],
};

export default config;
