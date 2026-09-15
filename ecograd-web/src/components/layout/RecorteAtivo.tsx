import { Layers, Scissors } from 'lucide-react';
import { ampliarParaColecoesInteiras } from '@/services/abrir-item';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

/**
 * O que a análise cobre quando a busca escolheu itens específicos. As coleções
 * inteiras foram baixadas para alcançá-los, mas apresentá-las como se fossem o
 * recorte responderia uma pergunta que ninguém fez — daí o aviso e o caminho de
 * volta explícito.
 */
export function RecorteAtivo({ compacto = false }: { compacto?: boolean }) {
  const recorte = useEcoGradStore((s) => s.recorte);
  const docs = useEcoGradStore((s) => s.docs.length);
  const carregando = useEcoGradStore((s) => s.carregando);
  const colecoes = useEcoGradStore((s) => s.programasSelecionados.length + s.cursosTccSelecionados.length);
  const itens = recorte.filter((i) => i.tipo !== 'Coleção');
  if (itens.length === 0) return null;

  const inteiras = (
    <button type="button" className="btn text-xs" disabled={carregando} onClick={ampliarParaColecoesInteiras}
      title="Recarrega as mesmas coleções sem o recorte, para comparar o item com o restante da produção">
      <Layers size={13} className="shrink-0" /> Analisar {plural(colecoes, 'coleção inteira', 'coleções inteiras')}
    </button>
  );

  if (compacto) {
    return (
      <div className="mt-2 border-t border-eco-accent/30 pt-2">
        <p className="flex items-center gap-1.5 text-xs text-slate-300"><Scissors size={12} className="shrink-0" /> Recorte da análise</p>
        <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {itens.map((i) => <li key={`${i.tipo}:${i.nome}`} className="break-words text-xs text-eco-accent">{i.nome} <span className="text-slate-400">· {i.tipo}</span></li>)}
        </ul>
        <div className="mt-2">{inteiras}</div>
      </div>
    );
  }

  return (
    <section className="card border-eco-accent/40 bg-eco-accent/5" aria-label="Recorte da análise">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-eco-accent"><Scissors size={14} className="shrink-0" /> Análise recortada</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">
        Tudo nesta página descreve apenas {plural(docs, 'documento', 'documentos')} de {plural(itens.length, 'item escolhido', 'itens escolhidos')} na busca
        {colecoes > 0 && <> — e não {plural(colecoes, 'a coleção inteira', 'as coleções inteiras')} que precisaram ser baixadas para alcançá-los</>}.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {itens.map((i) => (
          <li key={`${i.tipo}:${i.nome}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-eco-accent/40 bg-eco-accent/10 px-2.5 py-1 text-xs text-eco-accent">
            <span className="min-w-0 break-words">{i.nome}</span>
            <span className="shrink-0 text-[.65rem] text-slate-400">{i.tipo}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Indicadores comparativos — rede, tendências, similaridade — comparam o recorte com ele mesmo. Para situar o item no conjunto da produção, carregue as coleções inteiras.
      </p>
      <div className="mt-3">{inteiras}</div>
    </section>
  );
}
