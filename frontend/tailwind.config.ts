import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          bg: 'rgba(255,255,255,0.12)',
          border: 'rgba(255,255,255,0.25)',
        },
        neon: {
          blue: '#60A5FA',
          cyan: '#22D3EE',
          green: '#4ADE80',
          amber: '#FBBF24',
          red: '#F87171',
          purple: '#A78BFA',
        },
      },
      keyframes: {
        flow: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(96,165,250,0.3), 0 0 20px rgba(96,165,250,0.1)' },
          '50%': { boxShadow: '0 0 25px rgba(96,165,250,0.7), 0 0 50px rgba(96,165,250,0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        dashFlow: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        flow: 'flow 1.5s linear infinite',
        pulseGlow: 'pulseGlow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        scanLine: 'scanLine 4s linear infinite',
        dashFlow: 'dashFlow 1.5s linear infinite',
        fadeInUp: 'fadeInUp 0.4s ease-out',
        shimmer: 'shimmer 2s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
