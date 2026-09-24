import { Suspense, type ReactNode } from 'react';
import { LimiteDeErro } from './LimiteDeErro';

/**
 * A failed optional drawing must never hide table controls or interrupt the analysis.
 * Um desenho que quebra — dados atípicos, WebGL indisponível, o pedaço do
 * gráfico que não baixou — vira um aviso com "Tentar novamente", e os botões
 * de tabela acima dele continuam funcionando.
 */
export function CanvasBoundary({ children, aoTentarDeNovo }: { children: ReactNode; aoTentarDeNovo?: () => void }) {
  return <LimiteDeErro rotulo="esta visualização" alternativa="Use os botões acima para consultar os dados em tabela." aoTentarDeNovo={aoTentarDeNovo}>
    <Suspense fallback={<p role="status" className="p-4 text-sm text-slate-300">Carregando visualização… Os dados em tabela continuam disponíveis.</p>}>{children}</Suspense>
  </LimiteDeErro>;
}
