import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark GitHub-inspired theme
        bg: {
          primary: '#0D1117',
          secondary: '#161B22',
          tertiary: '#21262D',
        },
        text: {
          primary: '#C9D1D9',
          secondary: '#8B949E',
          muted: '#484F58',
        },
        accent: {
          blue: '#58A6FF',
          green: '#3FB950',
          red: '#FF7B72',
          purple: '#BC8CFF',
          cyan: '#79C0FF',
          orange: '#FFA657',
          yellow: '#E3B341',
        },
        // Coach-specific colors
        chad: '#FF7B72',
        reeves: '#BC8CFF',
        viktor: '#79C0FF',
        border: '#30363D',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'typing': 'typing 1s steps(3) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        typing: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
