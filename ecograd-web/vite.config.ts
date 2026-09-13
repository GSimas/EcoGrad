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
    // Permite acessar também pela porta do Vite; funções continuam no Netlify Dev.
    proxy: {
      '/api': { target: 'http://localhost:8888', changeOrigin: true },
      '/.netlify': { target: 'http://localhost:8888', changeOrigin: true },
    },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Keep shared React/CJS helpers out of the deferred visualization chunks.
        manualChunks(id) {
          if (id.includes('commonjsHelpers') || /\/node_modules\/(react|react-dom|react-is|scheduler|tslib)\//.test(id)) return 'react';
          if (/\/node_modules\/(echarts|echarts-for-react|echarts-wordcloud|zrender)\//.test(id)) return 'echarts';
          if (/\/node_modules\/graphology[^/]*\//.test(id)) return 'graph';
          if (/\/node_modules\/(react-force-graph-2d|force-graph)\//.test(id)) return 'forcegraph';
        },
      },
    },
  },
});
