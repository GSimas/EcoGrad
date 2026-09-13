import { useSessionField } from '@/hooks/useSessionField';
import { useEffect, useId, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { cn, chaveBusca } from '@/lib/utils';

/**
 * Seleção múltipla com busca — equivalente ao `st.multiselect`.
 * A lista é virtualizada por corte simples (top 200 resultados), suficiente
 * para os catálogos da UFSC e sem custo de uma dependência extra.
 */
export function MultiSelect({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  placeholder = 'Pesquise e selecione...',
  maxVisiveis = 200,
  acoesSelecao = false,
}: {
  rotulo: string;
  opcoes: readonly string[];
  selecionados: readonly string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  maxVisiveis?: number;
  acoesSelecao?: boolean;
}) {
  const inputId = useId();
  const [busca, setBusca] = useSessionField('multiselect.' + rotulo, '');

  const filtradas = useMemo(() => {
    const alvo = chaveBusca(busca.trim());
    const base = alvo ? opcoes.filter((o) => chaveBusca(o).includes(alvo)) : opcoes;
    return base.slice(0, maxVisiveis);
  }, [busca, opcoes, maxVisiveis]);

  const selecionadosSet = useMemo(() => new Set(selecionados), [selecionados]);

  const alternar = (opcao: string) => {
    if (selecionadosSet.has(opcao)) onChange(selecionados.filter((s) => s !== opcao));
    else onChange([...selecionados, opcao]);
  };

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">{rotulo}</label>
      {acoesSelecao && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{selecionados.length === 0 ? 'Nenhuma selecionada' : selecionados.length === opcoes.length ? 'Todas selecionadas' : `${selecionados.length} ${selecionados.length === 1 ? 'selecionada' : 'selecionadas'}`}</span>
          <button type="button" className="btn text-xs" onClick={() => onChange([...opcoes])} aria-label={`Selecionar todas: ${rotulo}`}>Todas</button>
          <button type="button" className="btn text-xs" onClick={() => onChange([])} aria-label={`Desmarcar todas: ${rotulo}`}>Nenhuma</button>
        </div>
      )}

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selecionados.map((s) => (
            <span
              key={s}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-eco-accent/40
                bg-eco-accent/10 px-2.5 py-1 text-xs text-eco-accent"
            >
              <span className="min-w-0 break-words">{s}</span>
              <button
                type="button"
                onClick={() => alternar(s)}
                aria-label={`Remover ${s}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center hover:text-amber-200"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          id={inputId}
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={placeholder}
          className="input pl-9"
        />
      </div>

      <div className="max-h-56 overflow-auto rounded-lg border border-eco-border bg-eco-bg">
        {filtradas.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">Nenhuma opção encontrada.</p>
        ) : (
          filtradas.map((o) => {
            const ativo = selecionadosSet.has(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => alternar(o)}
                aria-pressed={ativo}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                  ativo ? 'bg-eco-accent/10 text-eco-accent' : 'text-slate-300 hover:bg-white/5',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    ativo ? 'border-eco-accent bg-eco-action text-black' : 'border-eco-border',
                  )}
                >
                  {ativo && <Check size={11} />}
                </span>
                <span className="min-w-0 break-words">{o}</span>
              </button>
            );
          })
        )}
      </div>
      <p className="text-xs text-slate-500">
        {opcoes.length} opções disponíveis
        {filtradas.length < opcoes.length && ` · exibindo ${filtradas.length}`}
      </p>
    </div>
  );
}

/**
 * Seleção única com busca — equivalente ao `st.selectbox` do Motor de Busca.
 * Combobox nativo (datalist) para manter a digitação fluida com 50k+ opções.
 */
export function SelectBusca({
  rotulo,
  opcoes,
  valor,
  onChange,
  placeholder = 'Pesquise aqui...',
  maxSugestoes = 300,
  sessionKey = rotulo,
}: {
  rotulo: string;
  opcoes: readonly string[];
  valor: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  maxSugestoes?: number;
  sessionKey?: string;
}) {
  const [texto, setTexto] = useSessionField('busca.texto.' + sessionKey, valor ?? '');
  const campoId = useId();
  const listaId = `lista-${rotulo.replace(/\W+/g, '-')}`;

  const sugestoes = useMemo(() => {
    const alvo = chaveBusca(texto.trim());
    if (!alvo) return opcoes.slice(0, maxSugestoes);
    return opcoes.filter((o) => chaveBusca(o).includes(alvo)).slice(0, maxSugestoes);
  }, [texto, opcoes, maxSugestoes]);

  // Mantém o input sincronizado quando a navegação por botões muda o termo ativo
  const [ultimoValor, setUltimoValor] = useState(valor);
  useEffect(() => {
    if (valor !== ultimoValor) {
      setUltimoValor(valor);
      setTexto(valor ?? '');
    }
  }, [valor, ultimoValor, setTexto]);

  const confirmar = (v: string) => {
    setTexto(v);
    setUltimoValor(opcoes.includes(v) ? v : null);
    onChange(opcoes.includes(v) ? v : null);
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={campoId} className="block text-sm font-medium text-slate-300">{rotulo}</label>
      <div className="flex gap-2">
        <input
          id={campoId}
          list={listaId}
          value={texto}
          onChange={(e) => confirmar(e.target.value)}
          placeholder={placeholder}
          className="input min-w-0"
        />
        {valor && (
          <button type="button" className="btn shrink-0" onClick={() => confirmar('')}>
            <X size={14} /> Limpar
          </button>
        )}
      </div>
      <datalist id={listaId}>
        {sugestoes.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
