import './services/aparencia';
import './services/pessoas';
import { initializeNavigation } from './services/navigation';
import { initializeSession } from './services/session';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AvisosDeAtividade } from './components/ui/AvisosDeAtividade';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // O catálogo CAPES e as sínteses da IA são caros e mudam pouco:
      // 24h de fresh, sem refetch ao focar a janela.
      staleTime: 1000 * 60 * 60 * 24,
      gcTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<p role="status" className="p-6">Verificando e recuperando a sessão…</p>);
void initializeSession(queryClient).then(() => { initializeNavigation(); root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Fora do App, para o aviso de fim de atividade sobreviver à troca de tela;
          antes dele e `sr-only` (absoluto, no topo), sem ocupar espaço nem criar rolagem. */}
      <AvisosDeAtividade />
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
); });
