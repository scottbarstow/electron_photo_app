/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors for photo app branding
        photo: {
          50: '#f5f7fa',
          100: '#e4e9f2',
          200: '#c9d3e5',
          300: '#a3b4d1',
          400: '#7690b9',
          500: '#5672a1',
          600: '#445b87',
          700: '#394b6e',
          800: '#32405c',
          900: '#2d384e',
        },
      },
    },
  },
  plugins: [],
};
