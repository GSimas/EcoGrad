import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Porta do servidor de desenvolvimento. Fonte única da verdade: o `netlify.toml`
 * exporta `PORT` no comando de dev, e o mesmo valor alimenta o servidor e o
 * cliente de HMR.
 */
const PORTA_DEV = Number(process.env.PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: PORTA_DEV,
    // Sob `netlify dev` a página é servida pelo proxy (8888), mas o socket de
    // HMR do Vite continua no servidor real. Sem apontar a porta do cliente, o
    // navegador tenta abrir o WebSocket em 8888, falha, e o hot-reload morre em
    // silêncio — as edições só aparecem após um reload manual.
    hmr: { clientPort: PORTA_DEV },
    // Encaminha as chamadas /api/* para o Netlify Dev (netlify dev --targetPort 5173)
    proxy: {
      '/.netlify': { target: 'http://localhost:8888', changeOrigin: true },
    },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts', 'echarts-for-react', 'echarts-wordcloud'],
          graph: ['graphology', 'graphology-metrics', 'graphology-communities-louvain'],
          forcegraph: ['react-force-graph-2d'],
        },
      },
    },
  },
});
