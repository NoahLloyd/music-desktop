/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0a0a',
          1: '#121212',
          2: '#1a1a1a',
          3: '#242424',
          4: '#2a2a2a'
        },
        accent: {
          DEFAULT: '#1db954',
          hover: '#1ed760'
        }
      }
    }
  },
  plugins: []
}
