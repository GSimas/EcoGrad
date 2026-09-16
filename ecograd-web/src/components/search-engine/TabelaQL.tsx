import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { TipoBusca } from '@/types';
import { BotaoEntidade, Tabela } from '@/components/ui/primitives';
import type { LinhaQL } from '@/types';

/**
 * Tabela de Frequência Temática e Especialização (Quociente Locacional).
 * Cores idênticas ao `color_ql` do Streamlit: verde QL>1, vermelho QL<1,
 * amarelo QL=1 exatamente.
 */
export function TabelaQL({ linhas, titulo }: { linhas: readonly LinhaQL[]; titulo: string }) {
  if (linhas.length === 0) return null;
  const maxTotal = Math.max(...linhas.map((l) => l.Total), 1);

  const corQL = (v: number) => {
    if (v > 1) return 'text-emerald-400 font-semibold';
    if (v < 1) return 'text-red-400';
    return 'text-yellow-300';
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-200">{titulo}</p>
      <Tabela<Record<string, unknown>>
        titulo={titulo}
        descricao="QL é uma razão adimensional: acima de 1, acima da referência; igual a 1, mesma proporção; abaixo de 1, abaixo da referência. Cores são complementares ao valor. Contagens em registros (n)."
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
      <p className="text-xs italic text-slate-500">
        Nota: QL &gt; 1 indica especialização acima da média global da base.
      </p>
    </div>
  );
}
