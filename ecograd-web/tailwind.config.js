/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: Object.fromEntries([100,200,300,400,500,600].map(n => [n, `rgb(var(--slate-${n}) / <alpha-value>)`])),
        // Paleta herdada do app Streamlit (quadrantes e tipos de nó)
        eco: {
          bg: 'rgb(var(--eco-bg) / <alpha-value>)',
          panel: 'rgb(var(--eco-panel) / <alpha-value>)',
          border: 'rgb(var(--eco-border) / <alpha-value>)',
          accent: 'rgb(var(--eco-accent) / <alpha-value>)',
          action: '#F6AD35',
          doc: '#E74C3C',
          autor: '#3498DB',
          orientador: '#F39C12',
          conceito: '#2ECC71',
          macrotema: '#9B59B6',
        },
        quadrant: {
          tendencia: '#2ECC71',
          sinal: '#F1C40F',
          mainstream: '#3498DB',
          declinio: '#E74C3C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica Neue', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
