/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          light: '#FAFAF7',
          dark: '#111214',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1A1C1F',
          mutedLight: '#F3F3EF',
          mutedDark: '#23262A',
        },
        border: {
          light: '#E6E6E1',
          dark: '#2A2D32',
        },
        text: {
          light: '#1B1B1F',
          dark: '#ECECEF',
          muted: '#6B6F76',
        },
        accent: {
          DEFAULT: '#0071E3',
          hover: '#0077ED',
          light: '#E8F1FC',
          dark: '#2E308E',
        },
        secondary: {
          DEFAULT: '#F0895B',
          hover: '#E07543',
          light: '#FDF3EE',
        },
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
