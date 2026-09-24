import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';

/** Falha ao baixar um pedaço do bundle — em geral uma versão nova publicada com a aba aberta. */
const ehFalhaDePedaco = (erro: Error) =>
  /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(`${erro.name} ${erro.message}`);

interface Props {
  children: ReactNode;
  /** O que deixou de aparecer, completando "Não foi possível exibir …". */
  rotulo: string;
  /** Chamado antes de montar de novo — por exemplo, para descartar um carregamento que falhou. */
  aoTentarDeNovo?: () => void;
  /** O que ainda dá para fazer enquanto isso — por exemplo, ler os dados em tabela. */
  alternativa?: string;
}

/**
 * Isola a falha de uma parte da tela: uma página, um gráfico, uma rede que
 * quebrou com dados atípicos. Sem ele, um erro de render derrubava a aplicação
 * inteira numa tela vazia; com ele, o restante continua funcionando, a análise
 * fica preservada e a parte que falhou oferece "Tentar novamente".
 */
export class LimiteDeErro extends Component<Props, { erro: Error | null; tentativa: number }> {
  state = { erro: null as Error | null, tentativa: 0 };

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error(`[EcoGrad] Falha ao exibir ${this.props.rotulo}:`, erro, info.componentStack);
  }

  tentarDeNovo = () => {
    this.props.aoTentarDeNovo?.();
    // A chave nova remonta tudo abaixo: nada do estado que quebrou é reaproveitado.
    this.setState((s) => ({ erro: null, tentativa: s.tentativa + 1 }));
  };

  render() {
    const { erro, tentativa } = this.state;
    // Fragmento, e não um elemento: nada entra no DOM entre o pai e os filhos.
    if (!erro) return <Fragment key={tentativa}>{this.props.children}</Fragment>;
    const pedaco = ehFalhaDePedaco(erro);
    return (
      <div role="alert" className="aviso space-y-3 text-sm">
        <p>
          Não foi possível exibir {this.props.rotulo}.
          {pedaco ? ' A conexão falhou ao buscar esta parte do EcoGrad, ou uma versão nova foi publicada.' : ''}
          {this.props.alternativa ? ` ${this.props.alternativa}` : ''}
          {' '}O restante do EcoGrad continua funcionando e a sua análise foi preservada.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={this.tentarDeNovo}><RotateCcw size={16} aria-hidden /> Tentar novamente</button>
          {pedaco && <button type="button" className="btn" onClick={() => window.location.reload()}><RefreshCw size={16} aria-hidden /> Recarregar a página</button>}
        </div>
      </div>
    );
  }
}
