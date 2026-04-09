/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          base:     '#080e1c',
          surface:  '#0d1730',
          elevated: '#132040',
          border:   'rgba(96,165,250,0.12)',
        },
        ink: {
          bright:   '#e2e8f0',
          mid:      '#94a3b8',
          muted:    '#475569',
        },
        glow: {
          blue:   '#60a5fa',
          amber:  '#fbbf24',
          teal:   '#2dd4bf',
          rose:   '#fb7185',
          violet: '#a78bfa',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans:    ['DM Sans', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, rgba(96,165,250,0.08) 1px, transparent 1px)',
        'header-gradient': 'linear-gradient(135deg, #080e1c 0%, #0d1c3a 50%, #0a1628 100%)',
      },
      backgroundSize: {
        'dot-grid': '28px 28px',
      },
      boxShadow: {
        'card':       '0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(96,165,250,0.06) inset',
        'card-hover': '0 8px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(96,165,250,0.12) inset',
        'glow-blue':  '0 0 20px rgba(96,165,250,0.2)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out both',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
