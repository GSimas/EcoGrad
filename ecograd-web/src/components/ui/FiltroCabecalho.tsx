import { useId, useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpAZ, Check, Filter } from 'lucide-react';
import { FaixaDupla } from './FaixaDupla';
import { MenuAncorado } from './MenuAncorado';
import { cn, filtrarPorRelevancia } from '@/lib/utils';
import { filtroAtivo, modoDoFiltro, passoDaFaixa, perfilDaColuna, valorNumericoTabela, type FiltroColuna, type ModoFiltro, type RotulosColuna } from '@/lib/visualizacao';

/** Quantas opções a lista mostra de uma vez; o campo de busca alcança o resto. */
const MAX_OPCOES = 200;

const NOME_MODO: Record<ModoFiltro, string> = { texto: 'Contém', selecao: 'Seleção', faixa: 'Entre', igual: 'Igual a' };

export interface FiltroCabecalhoProps {
  rotulo: string;
  chave: string;
  linhas: readonly Record<string, unknown>[];
  /** Formatações próprias das colunas, para a lista de seleção falar a língua da tabela. */
  rotulos?: RotulosColuna;
  filtro: FiltroColuna | undefined;
  aoFiltrar: (f: FiltroColuna | null) => void;
  ordem: 'asc' | 'desc' | null;
  aoOrdenar: (direcao: 'asc' | 'desc') => void;
}

/** Botão de filtro do cabeçalho: abre o menu da própria coluna. */
export function FiltroCabecalho(props: FiltroCabecalhoProps) {
  const ativo = filtroAtivo(props.filtro);
  return <MenuAncorado
    rotulo={`Ordenar e filtrar: ${props.rotulo}`}
    rotuloGatilho={ativo ? `Filtro ativo em ${props.rotulo}: abrir menu da coluna` : `Ordenar e filtrar a coluna ${props.rotulo}`}
    conteudoGatilho={<Filter size={15} aria-hidden fill={ativo ? 'currentColor' : 'none'} />}
    classeGatilho={cn('flex h-11 w-9 shrink-0 items-center justify-center rounded-md border transition',
      ativo ? 'border-eco-accent/50 bg-eco-accent/15 text-eco-accent' : 'border-transparent text-slate-400 hover:bg-white/5')}
  >{(fechar) => <PainelColuna {...props} fechar={fechar} />}</MenuAncorado>;
}

/**
 * Só monta quando o menu abre — é aqui que a coluna é varrida para descobrir se
 * é numérica, quais são os extremos e quais valores existem.
 */
function PainelColuna({ rotulo, chave, linhas, rotulos, filtro, aoFiltrar, ordem, aoOrdenar, fechar }: FiltroCabecalhoProps & { fechar: () => void }) {
  const id = useId();
  const perfil = useMemo(() => perfilDaColuna(linhas, chave, rotulos), [linhas, chave, rotulos]);
  const f = filtro ?? {};
  const modo = modoDoFiltro(filtro ?? (perfil.numerica ? { modo: 'faixa' } : { modo: 'texto' }));
  const modos: ModoFiltro[] = perfil.numerica ? ['faixa', 'igual', 'selecao'] : ['texto', 'selecao'];
  const ativo = filtroAtivo(filtro);
  const passo = passoDaFaixa(perfil.min, perfil.max, perfil.inteira);

  return <div className="space-y-3">
    <p className="break-words text-sm font-semibold text-slate-200">{rotulo}</p>

    <section className="space-y-1.5" aria-label={`Ordenar por ${rotulo}`}>
      <p className="text-xs font-medium text-slate-400">Ordenar</p>
      <div className="flex gap-1.5">
        {([['asc', 'Crescente', ArrowUpAZ], ['desc', 'Decrescente', ArrowDownAZ]] as const).map(([d, texto, Icone]) =>
          <button key={d} type="button" aria-pressed={ordem === d} onClick={() => aoOrdenar(d)}
            className={cn('btn min-h-9 flex-1 px-2 py-1 text-xs', ordem === d && 'border-eco-accent bg-eco-accent/15 text-eco-accent')}>
            <Icone size={13} aria-hidden /> {texto}
          </button>)}
      </div>
    </section>

    <section className="space-y-1.5" aria-label={`Filtrar ${rotulo}`}>
      <p className="text-xs font-medium text-slate-400">Filtrar por</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label={`Modo do filtro de ${rotulo}`}>
        {modos.map((m) => <button key={m} type="button" role="radio" aria-checked={modo === m}
          className={cn('btn min-h-9 flex-1 px-2 py-1 text-xs', modo === m && 'border-eco-accent bg-eco-accent/15 text-eco-accent')}
          onClick={() => aoFiltrar({ ...f, modo: m })}>{NOME_MODO[m]}</button>)}
      </div>

      {modo === 'texto' && <input id={id} type="search" className="input" placeholder="Contém..."
        aria-label={`Filtrar ${rotulo} por texto`} value={f.texto ?? ''}
        onChange={(e) => aoFiltrar({ modo: 'texto', texto: e.target.value })} />}

      {modo === 'selecao' && <Selecao rotulo={rotulo} opcoes={perfil.valores}
        marcados={f.valores ?? []} onChange={(valores) => aoFiltrar({ ...f, modo: 'selecao', valores })} />}

      {modo === 'igual' && <input id={id} type="number" className="input" placeholder={`Ex.: ${perfil.min}`}
        aria-label={`${rotulo} igual a`} value={f.igual ?? ''}
        onChange={(e) => aoFiltrar({ ...f, modo: 'igual', igual: e.target.value === '' ? null : Number(e.target.value) })} />}

      {modo === 'faixa' && <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <input type="number" className="input min-w-0" placeholder={String(perfil.min)} aria-label={`${rotulo}: valor mínimo`}
            value={f.min ?? ''} onChange={(e) => aoFiltrar({ ...f, modo: 'faixa', min: e.target.value === '' ? null : Number(e.target.value) })} />
          <span aria-hidden="true" className="text-xs text-slate-400">a</span>
          <input type="number" className="input min-w-0" placeholder={String(perfil.max)} aria-label={`${rotulo}: valor máximo`}
            value={f.max ?? ''} onChange={(e) => aoFiltrar({ ...f, modo: 'faixa', max: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        {/* A barra move as duas pontas do intervalo; os campos acima aceitam o valor exato.
            Coluna de valor único não tem intervalo a percorrer: só os campos fazem sentido. */}
        {perfil.max > perfil.min && <FaixaDupla rotulo={rotulo} min={perfil.min} max={perfil.max} passo={passo}
          valor={{ min: f.min, max: f.max }}
          onChange={(v) => aoFiltrar({ ...f, modo: 'faixa', ...v })} />}
        <p className="text-[.7rem] text-slate-400">Valores de {valorNumericoTabela(perfil.min)} a {valorNumericoTabela(perfil.max)}.</p>
      </div>}
    </section>

    <div className="flex gap-1.5 border-t border-eco-border pt-3">
      <button type="button" className="btn min-h-9 flex-1 px-2 py-1 text-xs" disabled={!ativo} onClick={() => aoFiltrar(null)}>Limpar filtro</button>
      <button type="button" className="btn min-h-9 flex-1 px-2 py-1 text-xs" onClick={fechar}>Fechar</button>
    </div>
  </div>;
}

/**
 * Lista de valores existentes na coluna. Nada marcado significa nenhum recorte —
 * evita guardar milhares de rótulos na sessão só para dizer que tudo passa.
 */
function Selecao({ rotulo, opcoes, marcados, onChange }: {
  rotulo: string;
  opcoes: readonly { valor: string; contagem: number }[];
  marcados: readonly string[];
  onChange: (v: string[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const escolhidos = useMemo(() => new Set(marcados), [marcados]);
  const visiveis = useMemo(() => {
    const nomes = filtrarPorRelevancia(opcoes.map((o) => o.valor), busca);
    const conta = new Map(opcoes.map((o) => [o.valor, o.contagem]));
    return nomes.slice(0, MAX_OPCOES).map((valor) => ({ valor, contagem: conta.get(valor) ?? 0 }));
  }, [opcoes, busca]);

  const alternar = (v: string) => onChange(escolhidos.has(v) ? marcados.filter((m) => m !== v) : [...marcados, v]);

  return <div className="space-y-1.5">
    <input type="search" className="input" placeholder="Buscar valor..." aria-label={`Buscar entre os valores de ${rotulo}`}
      value={busca} onChange={(e) => setBusca(e.target.value)} />
    <div className="flex items-center gap-1.5 text-[.7rem] text-slate-400">
      <span className="min-w-0 flex-1">{marcados.length ? `${marcados.length} de ${opcoes.length} marcados` : `${opcoes.length} valores · sem marcação, todos passam`}</span>
      <button type="button" className="shrink-0 text-eco-accent underline" onClick={() => onChange([...new Set([...marcados, ...visiveis.map((o) => o.valor)])])}>marcar listados</button>
      {marcados.length > 0 && <button type="button" className="shrink-0 text-eco-accent underline" onClick={() => onChange([])}>limpar</button>}
    </div>
    <ul className="max-h-56 space-y-0.5 overflow-auto rounded-md border border-eco-border/70 p-1" aria-label={`Valores de ${rotulo}`}>
      {visiveis.map((o) => {
        const marcado = escolhidos.has(o.valor);
        return <li key={o.valor}>
          <button type="button" role="checkbox" aria-checked={marcado} onClick={() => alternar(o.valor)}
            className={cn('flex min-h-9 w-full items-center gap-2 rounded px-2 py-1 text-left text-xs',
              marcado ? 'bg-eco-accent/10 text-eco-accent' : 'text-slate-300 hover:bg-white/5')}>
            <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border',
              marcado ? 'border-eco-accent bg-eco-action text-eco-on-action' : 'border-eco-border')}>{marcado && <Check size={11} aria-hidden />}</span>
            <span className="min-w-0 flex-1 break-words">{o.valor}</span>
            <span className="shrink-0 text-slate-500">{o.contagem}</span>
          </button>
        </li>;
      })}
      {!visiveis.length && <li className="px-2 py-3 text-center text-xs text-slate-500">Nenhum valor corresponde.</li>}
    </ul>
    {opcoes.length > visiveis.length && <p className="text-[.7rem] text-slate-500">Mostrando {visiveis.length} de {opcoes.length} valores — use a busca para alcançar os demais.</p>}
  </div>;
}
