/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Estética Scientata: cantos retos em tudo o que é superfície. `full` segue
    // redondo para pontos, avatares e interruptores, que são círculos por natureza.
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '9999px',
    },
    extend: {
      colors: {
        slate: Object.fromEntries([100,200,300,400,500,600].map(n => [n, `rgb(var(--slate-${n}) / <alpha-value>)`])),
        // Paleta herdada do app Streamlit (quadrantes e tipos de nó)
        eco: {
          bg: 'rgb(var(--eco-bg) / <alpha-value>)',
          panel: 'rgb(var(--eco-panel) / <alpha-value>)',
          border: 'rgb(var(--eco-border) / <alpha-value>)',
          accent: 'rgb(var(--eco-accent) / <alpha-value>)',
          // A ação principal muda com o tema (limão no escuro, tinta no claro).
          action: 'rgb(var(--eco-action) / <alpha-value>)',
          'on-action': 'rgb(var(--eco-on-action) / <alpha-value>)',
          doc: '#E56D45',
          autor: '#55BADC',
          orientador: '#E9A13B',
          conceito: '#8FCF3E',
          macrotema: '#6A7DFF',
        },
        quadrant: {
          tendencia: '#8FCF3E',
          sinal: '#F5BD59',
          mainstream: '#55BADC',
          declinio: '#E56D45',
        },
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Manrope', 'Arial', 'system-ui', 'sans-serif'],
        destaque: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['DM Mono', 'ui-monospace', 'Cascadia Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
