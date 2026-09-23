import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { TipoBusca } from '@/types';
import { BotaoEntidade, Dica, Tabela } from '@/components/ui/primitives';
import { NOTA_EXPORTACAO, NOTA_FILTROS } from '@/components/ui/Tabela';
import type { LinhaQL } from '@/types';

/**
 * Tabela de Frequência Temática e Especialização (Quociente Locacional).
 * Cores idênticas ao `color_ql` do Streamlit: verde QL>1, vermelho QL<1,
 * amarelo QL=1 exatamente.
 */
const DESCRICAO_QL = 'QL é uma razão adimensional: acima de 1, acima da referência; igual a 1, mesma proporção; abaixo de 1, abaixo da referência. Cores são complementares ao valor. Contagens em registros (n).';

export function TabelaQL({ linhas, titulo, introducao }: { linhas: readonly LinhaQL[]; titulo: string; introducao?: string }) {
  if (linhas.length === 0) return null;
  const maxTotal = Math.max(...linhas.map((l) => l.Total), 1);

  const corQL = (v: number) => {
    if (v > 1) return 'text-emerald-400 font-semibold';
    if (v < 1) return 'text-red-400';
    return 'text-amber-200';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-slate-200">{titulo}</p>
        <Dica rotulo={`Como ler: ${titulo}`}>
          {introducao && <p>{introducao}</p>}
          <p>{DESCRICAO_QL}</p>
          <p>Nota: QL &gt; 1 indica especialização acima da média global da base.</p>
          <p>{NOTA_FILTROS} {NOTA_EXPORTACAO}</p>
        </Dica>
      </div>
      <Tabela<Record<string, unknown>>
        titulo={titulo}
        descricao={DESCRICAO_QL}
        notasNaDica
        altura="max-h-80"
        linhas={linhas as unknown as Array<Record<string, unknown>>}
        colunas={[
          {
            chave: 'Entidade',
            rotulo: 'Entidade',
            render: (l) => (
              <BotaoEntidade
                tipo={String(l.Tipo)}
                nome={String(l.Entidade)}
                onClick={() => useEcoGradStore.getState().navegarPara(String(l.Tipo) as TipoBusca, String(l.Entidade))}
              />
            ),
          },
          { chave: 'Tipo', rotulo: 'Tipo' },
          { chave: 'Teses', rotulo: 'Teses', barra: { max: maxTotal } },
          { chave: 'Dissertações', rotulo: 'Dissertações', barra: { max: maxTotal } },
          { chave: 'Outros', rotulo: 'Outros', barra: { max: maxTotal } },
          { chave: 'Total', rotulo: 'Total', barra: { max: maxTotal } },
          {
            chave: 'Valor QL',
            rotulo: 'Valor QL',
            render: (l) => (
              <span className={`tabular-nums ${corQL(Number(l['Valor QL']))}`}>
                {Number(l['Valor QL']).toFixed(2)}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
