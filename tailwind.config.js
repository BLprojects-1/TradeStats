/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/styles/**/*.{js,ts,jsx,tsx,css}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        dark: {
          DEFAULT: '#000000', // pure black
          lighter: '#121212', // slightly lighter black
          'card': '#1a1a1a', // card background
          'accent': '#3b82f6', // blue-500
          'highlight': '#4f46e5', // indigo-600
        },
        backgroundColor: {
          'dark-primary': '#000000', // pure black
          'dark-secondary': '#121212', // slightly lighter black
          'dark-card': '#1a1a1a', // card background
          'dark-accent': '#3b82f6', // blue accent
        },
        textColor: {
          'dark-primary': '#f1f5f9',
          'dark-secondary': '#94a3b8',
          'dark-accent': '#4f46e5',
        },
      },
    },
  },
  plugins: [],
}
