import { LEITURA_QUADRANTE, LEITURA_VEREDITO } from '@/lib/interpretacao';
import type { Quadrante } from '@/types';
import { FlaskConical, Microscope } from 'lucide-react';
import { Aviso, Card, Tabela } from '@/components/ui/primitives';
import { Atividade } from '@/components/ui/Atividade';
import { useSnaWorker, useAtividade, emExecucao } from '@/hooks/useSnaWorker';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { Dica } from '@/components/ui/Dica';

/**
 * Auto-ML: Grid Search e validação de robustez do modelo de Foresight.
 * Varre 108 combinações (ano de corte × janela de burst × janela futura ×
 * percentil) e ranqueia por MCC. Transcrição de backend.py:248 e 328.
 */
export function GridSearch({ mostrarAtividade = true }: { mostrarAtividade?: boolean }) {
  const docs = useEcoGradStore((s) => s.docs);
  const tipo = useEcoGradStore((s) => s.tipoForesight);

  const id = `grid-search:${tipo}`;
  const task = useAtividade(id);
  const rodando = emExecucao(task);
  const grid = task?.resultado?.type === 'grid-search' ? task.resultado.grid : null;
  const backtest = task?.resultado?.type === 'grid-search' ? task.resultado.backtest : null;
  const { executarGridSearch } = useSnaWorker();
  const executar = () => executarGridSearch(docs, tipo);

  const melhor = grid?.[0];

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FlaskConical size={16} /> Comparar configurações em períodos históricos
        </h3>
        <button type="button" className="btn" onClick={() => void executar()} disabled={rodando || docs.length === 0}>
          {rodando ? 'Varrendo combinações...' : <><Microscope size={16} aria-hidden /> Executar Grid Search (108 combinações)</>}
        </button>
      </div>

      <Dica rotulo="Como ler: avaliação histórica">
        <p>Treina o modelo até um ano de corte (T1) e confere os registros da janela posterior
          (T2). O ranking usa o <strong>MCC</strong> (coeficiente de Matthews), robusto a classes
          desbalanceadas; combinações degeneradas são descartadas.</p>
      </Dica>

      <p className="text-sm text-slate-300">São 108 combinações próprias desta avaliação: cortes de 2017 a 2020. T1 inclui o ano de corte; T2 começa no ano seguinte e termina no corte mais a janela futura. Os ajustes do Radar não configuram esta busca. O ranking é interno à mesma base, sem validação externa; o maior MCC não garante desempenho futuro. A busca varia janelas recentes de 2, 3 ou 4 anos, posteriores de 3, 4 ou 5 anos e percentis 50, 65 ou 80. O backtest usa IDF normalizado e mínimo de uma ocorrência recente, enquanto o Radar exige duas e usa IDF sem essa normalização.</p>
      {!grid && !rodando && <Aviso>Etapa opcional: explore primeiro os termos e seus trabalhos no Radar. Execute a avaliação quando houver cobertura temporal suficiente; nenhum cálculo é iniciado ao abrir esta seção.</Aviso>}
      {mostrarAtividade && <Atividade id={id} />}

      {grid && grid.length === 0 && (
        <Aviso tipo="aviso">
          Nenhuma combinação elegível. Confira a cobertura em torno dos cortes 2017–2020: são necessários registros no passado, no período recente e no período posterior, além de termos elegíveis e classes não degeneradas. Use Editar seleção para ampliar a cobertura; repetir sem alterar a base pode produzir o mesmo resultado.
        </Aviso>
      )}

      {melhor && (
        <>
          <Aviso tipo="sucesso">
            Maior MCC entre as configurações avaliadas: corte em <strong>{melhor['Ano Corte']}</strong>, burst de{' '}
            <strong>{melhor['Passado (Burst)']}</strong> anos, avaliação posterior de{' '}
            <strong>{melhor['Futuro (Previsão)']}</strong> anos, percentil{' '}
            <strong>{melhor['Corte (%)']}%</strong> — MCC {melhor['MCC (Robusto)']} · F1{' '}
            {melhor['F1-Score']} · N {melhor['N Total']}.
          </Aviso>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-200">Ranking de configurações</p>

            </div>
            <Tabela
              titulo="Configurações do Grid Search"
              contexto={{dimensao:tipo, metodo:"108 combinações; ranking por MCC"}}
              descricao="Janelas em anos; MCC de −1 a 1; F1, precisão e recall de 0 a 1; N é o número de termos avaliados. Ordenar esta tabela não muda a configuração escolhida pelo algoritmo."
              altura="max-h-80"
              linhas={grid as unknown as Array<Record<string, unknown>>}
              colunas={[
                // Ano é identificador, não quantidade: sem separador de milhar
                { chave: 'Ano Corte', rotulo: 'Ano Corte', render: (l) => String(l['Ano Corte']) },
                { chave: 'Passado (Burst)', rotulo: 'Burst (anos)' },
                { chave: 'Futuro (Previsão)', rotulo: 'Futuro (anos)' },
                { chave: 'Corte (%)', rotulo: 'Corte %' },
                { chave: 'MCC (Robusto)', rotulo: 'MCC' },
                { chave: 'F1-Score', rotulo: 'F1' },
                { chave: 'Precisão', rotulo: 'Precisão' },
                { chave: 'Recall', rotulo: 'Recall' },
                { chave: 'N Total', rotulo: 'Termos avaliados (n)' },
                ...['Verdadeiros (+)','Falsos (+)','Verdadeiros (-)','Falsos (-)'].map((chave)=>({chave,rotulo:chave+' (n)'})),
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
              titulo="Backtest da melhor configuração"
            contexto={{dimensao:tipo,configuracao:melhor,interpretacaoCategorias:LEITURA_QUADRANTE,interpretacaoVereditos:LEITURA_VEREDITO}}
            descricao="Volumes são ocorrências de termos. Variação compara taxas por registro em T1 e T2. Os vereditos verificam limiares do modelo, sem comprovar emergência ou extinção. Os nomes originais permanecem nas exportações."
            altura="max-h-80"
            linhas={backtest as unknown as Array<Record<string, unknown>>}
            colunas={[
              { chave: 'Termo', rotulo: 'Termo', className: 'max-w-xs truncate' },
              { chave: 'Previsão Passada (T1)', rotulo: 'Categoria em T1', render:(l)=>LEITURA_QUADRANTE[l['Previsão Passada (T1)'] as Quadrante] ?? String(l['Previsão Passada (T1)']) },
              { chave: 'Vol. T1', rotulo: 'Vol. T1' },
              { chave: 'Vol. T2 (Futuro)', rotulo: 'Vol. T2' },
              { chave: 'Variação Real Uso (%)', rotulo: 'Variação (%)' },
              {
                chave: 'Veredito do Modelo',
                rotulo: 'Resultado segundo o critério',
                render: (l) => (
                  <span className={String(l['Veredito do Modelo']).includes('✓') ? 'text-emerald-400' : 'text-red-400'}>
                    {LEITURA_VEREDITO[String(l['Veredito do Modelo'])] ?? String(l['Veredito do Modelo'])}
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
