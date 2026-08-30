/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta herdada do app Streamlit (quadrantes e tipos de nó)
        eco: {
          bg: '#0E1117',
          panel: '#161B22',
          border: '#26303B',
          accent: '#F39C12',
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
