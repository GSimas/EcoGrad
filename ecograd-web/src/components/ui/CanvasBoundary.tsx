import { Component, Suspense, type ReactNode } from 'react';

/** A failed optional drawing must never hide table controls or interrupt the analysis. */
export class CanvasBoundary extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  render() {
    if (this.state.erro) return <p role="alert" className="aviso">Não foi possível carregar esta visualização. Use os botões acima para consultar os dados em tabela; sua análise permanece disponível. Para tentar o desenho novamente, aguarde a sessão ser salva e recarregue a página.</p>;
    return <Suspense fallback={<p role="status" className="p-4 text-sm text-slate-300">Carregando visualização… Os dados em tabela continuam disponíveis.</p>}>{this.props.children}</Suspense>;
  }
}
