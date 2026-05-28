import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // OmniBlend brand palette (matches Discover Calculator v15)
        brand: {
          DEFAULT: '#1F3864',
          50:  '#EEF2FA',
          100: '#D6E1F4',
          200: '#ADC3E9',
          300: '#84A5DE',
          400: '#5B87D3',
          500: '#2E75B6',
          600: '#1F3864',
          700: '#172B4D',
          800: '#0F1D35',
          900: '#080E1C',
        },
        // Secondary blue accent
        accent: {
          DEFAULT: '#2E75B6',
          light: '#E6F1FB',
          medium: '#5DCAA5',
        },
        // Success teal (matches calculator --success)
        success: {
          DEFAULT: '#1D9E75',
          light: '#E1F5EE',
          dark: '#0F6E56',
        },
        // Warning amber (matches calculator --warning)
        warning: {
          DEFAULT: '#BA7517',
          light: '#FAEEDA',
          dark: '#854F0B',
        },
        // Danger (matches calculator --danger)
        danger: {
          DEFAULT: '#A32D2D',
          light: '#FCEBEB',
          dark: '#791F1F',
        },
        // Surface / background tokens
        surface: {
          primary:   '#ffffff',
          secondary: '#F4F6FA',
          tertiary:  '#ECEFF4',
          border:    '#DCE0E7',
          borderStrong: '#B4B8C2',
        },
        // Text tokens
        ink: {
          primary:   '#1a1a1a',
          secondary: '#5F5E5A',
          tertiary:  '#888780',
        },
        // Legacy neon aliases kept for animated SVG pipelines only
        neon: {
          blue:   '#2E75B6',
          cyan:   '#5DCAA5',
          green:  '#1D9E75',
          amber:  '#BA7517',
          red:    '#C00000',
          purple: '#7F77DD',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', '"SFMono-Regular"', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        tag:  '8px',
      },
      boxShadow: {
        card:   '0 1px 2px rgba(0,0,0,0.04)',
        panel:  '0 4px 12px rgba(0,0,0,0.06)',
        float:  '0 12px 40px rgba(0,0,0,0.10)',
        brand:  '0 0 0 3px rgba(46,117,182,0.18)',
      },
      keyframes: {
        flow: {
          '0%':   { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(46,117,182,0.25)' },
          '50%':       { boxShadow: '0 0 20px rgba(46,117,182,0.55)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        scanLine: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        dashFlow: {
          '0%':   { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        flow:       'flow 1.5s linear infinite',
        pulseGlow:  'pulseGlow 2.5s ease-in-out infinite',
        float:      'float 3s ease-in-out infinite',
        scanLine:   'scanLine 4s linear infinite',
        dashFlow:   'dashFlow 1.5s linear infinite',
        fadeInUp:   'fadeInUp 0.35s ease-out',
        shimmer:    'shimmer 2s linear infinite',
        slideIn:    'slideIn 0.25s ease-out',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
