import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Aviso, Card, Progresso, Tabela } from '@/components/ui/primitives';
import { useSnaWorker } from '@/hooks/useSnaWorker';
import { baixarArquivo, paraCSV } from '@/lib/utils';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { BacktestRow, GridSearchRow } from '@/types';

/**
 * Auto-ML: Grid Search e validação de robustez do modelo de Foresight.
 * Varre 108 combinações (ano de corte × janela de burst × janela futura ×
 * percentil) e ranqueia por MCC. Transcrição de backend.py:248 e 328.
 */
export function GridSearch() {
  const docs = useEcoGradStore((s) => s.docs);
  const tipo = useEcoGradStore((s) => s.tipoForesight);

  const [rodando, setRodando] = useState(false);
  const [grid, setGrid] = useState<GridSearchRow[] | null>(null);
  const [backtest, setBacktest] = useState<BacktestRow[] | null>(null);

  const { executarGridSearch } = useSnaWorker();
  // O worker publica o progresso direto no store enquanto varre as combinações
  const progresso = useEcoGradStore((s) => s.progressoSNA);
  const textoProgresso = useEcoGradStore((s) => s.textoProgressoSNA);

  const executar = async () => {
    setRodando(true);
    try {
      const resultado = await executarGridSearch(docs, tipo);
      setGrid(resultado.grid);
      setBacktest(resultado.backtest);
    } finally {
      setRodando(false);
    }
  };

  const melhor = grid?.[0];

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FlaskConical size={16} /> Auto-ML: Grid Search e Validação de Robustez
        </h3>
        <button type="button" className="btn" onClick={() => void executar()} disabled={rodando || docs.length === 0}>
          {rodando ? 'Varrendo combinações...' : '🔬 Executar Grid Search (108 combinações)'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Treina o modelo até um ano de corte (T1) e confere o que de fato aconteceu na janela futura
        (T2). O ranking usa o <strong>MCC</strong> (coeficiente de Matthews), robusto a classes
        desbalanceadas; combinações degeneradas são descartadas.
      </p>

      {rodando && <Progresso valor={progresso} texto={textoProgresso || 'Avaliando combinações...'} />}

      {grid && grid.length === 0 && (
        <Aviso tipo="aviso">
          Nenhuma combinação produziu um modelo válido — a base provavelmente não cobre anos
          suficientes para separar treino (T1) e futuro (T2).
        </Aviso>
      )}

      {melhor && (
        <>
          <Aviso tipo="sucesso">
            🏆 Melhor configuração: corte em <strong>{melhor['Ano Corte']}</strong>, burst de{' '}
            <strong>{melhor['Passado (Burst)']}</strong> anos, previsão de{' '}
            <strong>{melhor['Futuro (Previsão)']}</strong> anos, percentil{' '}
            <strong>{melhor['Corte (%)']}%</strong> — MCC {melhor['MCC (Robusto)']} · F1{' '}
            {melhor['F1-Score']} · N {melhor['N Total']}.
          </Aviso>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">Ranking de configurações</p>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  baixarArquivo(paraCSV(grid as unknown as Array<Record<string, unknown>>), 'grid_search_foresight.csv')
                }
              >
                📥 Exportar CSV
              </button>
            </div>
            <Tabela
              altura="max-h-80"
              linhas={grid as unknown as Array<Record<string, unknown>>}
              colunas={[
                // Ano é identificador, não quantidade: sem separador de milhar
                { chave: 'Ano Corte', rotulo: 'Ano Corte', render: (l) => String(l['Ano Corte']) },
                { chave: 'Passado (Burst)', rotulo: 'Burst' },
                { chave: 'Futuro (Previsão)', rotulo: 'Futuro' },
                { chave: 'Corte (%)', rotulo: 'Corte %' },
                { chave: 'MCC (Robusto)', rotulo: 'MCC' },
                { chave: 'F1-Score', rotulo: 'F1' },
                { chave: 'Precisão', rotulo: 'Precisão' },
                { chave: 'Recall', rotulo: 'Recall' },
                { chave: 'N Total', rotulo: 'N' },
              ]}
            />
          </div>
        </>
      )}

      {backtest && backtest.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-200">
            Backtest da melhor configuração ({backtest.length} termos)
          </p>
          <Tabela
            altura="max-h-80"
            linhas={backtest as unknown as Array<Record<string, unknown>>}
            colunas={[
              { chave: 'Termo', rotulo: 'Termo', className: 'max-w-xs truncate' },
              { chave: 'Previsão Passada (T1)', rotulo: 'Previsão (T1)' },
              { chave: 'Vol. T1', rotulo: 'Vol. T1' },
              { chave: 'Vol. T2 (Futuro)', rotulo: 'Vol. T2' },
              { chave: 'Variação Real Uso (%)', rotulo: 'Variação (%)' },
              {
                chave: 'Veredito do Modelo',
                rotulo: 'Veredito',
                render: (l) => (
                  <span className={String(l['Veredito do Modelo']).includes('✅') ? 'text-emerald-400' : 'text-red-400'}>
                    {String(l['Veredito do Modelo'])}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}
    </Card>
  );
}
