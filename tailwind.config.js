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
          DEFAULT: '#0B0C0D',
          darker: '#070809',
        },
        surface: {
          DEFAULT: '#101214',
          elevated: '#151719',
          hover: '#1B1E22',
          subtle: '#181A1D',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          subtle: 'rgba(255, 255, 255, 0.04)',
          focus: 'rgba(255, 255, 255, 0.2)',
        },
        text: {
          primary: '#F3F1EC',
          secondary: '#8E9399',
          muted: '#5A5F66',
        },
        accent: {
          emerald: '#10B981',
          cyan: '#06B6D4',
          cream: '#EAE5DB',
          creamHover: '#DCD6CB',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        display: [
          '"Space Grotesk"',
          'Inter',
          'sans-serif',
        ],
      },
      boxShadow: {
        'glow-subtle': '0 0 35px -5px rgba(255, 255, 255, 0.06)',
        'artwork-glow': '0 20px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px -10px rgba(52, 211, 153, 0.1)',
        'card-subtle': '0 4px 20px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up': 'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
