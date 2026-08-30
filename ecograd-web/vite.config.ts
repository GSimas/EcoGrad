import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Respeita PORT quando definido (Netlify Dev / ambientes que atribuem a porta)
    port: Number(process.env.PORT) || 5173,
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
