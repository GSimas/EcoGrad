import { useSessionField } from '@/hooks/useSessionField';
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Check, Search, X } from 'lucide-react';
import { cn, filtrarPorRelevancia } from '@/lib/utils';

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
    const base = filtrarPorRelevancia(opcoes, busca);
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
 * Combobox próprio (lista limitada a `maxSugestoes`) para manter a digitação fluida com 50k+ opções.
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
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const campoId = useId();
  const listaId = useId();

  const sugestoes = useMemo(() => {
    return filtrarPorRelevancia(opcoes, texto, maxSugestoes);
  }, [texto, opcoes, maxSugestoes]);

  // Mantém o input sincronizado quando a navegação por botões muda o termo ativo
  // `undefined` até a primeira sincronia: o texto salvo na sessão pode ser de outro item
  // (ex.: voltar à apresentação e abrir outro), então um termo ativo sempre o substitui.
  // Sem termo ativo, o texto digitado e salvo é preservado.
  const [ultimoValor, setUltimoValor] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (valor !== ultimoValor && (ultimoValor !== undefined || valor !== null)) {
      setUltimoValor(valor);
      setTexto(valor ?? '');
    }
  }, [valor, ultimoValor, setTexto]);

  useEffect(() => {
    if (ativo >= 0) document.getElementById(`${listaId}-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, listaId]);

  const confirmar = (v: string) => {
    setTexto(v);
    setUltimoValor(opcoes.includes(v) ? v : null);
    onChange(opcoes.includes(v) ? v : null);
  };
  const escolher = (v: string) => {
    confirmar(v);
    setAberta(false);
    setAtivo(-1);
  };
  const teclar = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = sugestoes.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAberta(true);
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setAtivo((i) => (!n ? -1 : i < 0 ? (passo > 0 ? 0 : n - 1) : (i + passo + n) % n));
    } else if (e.key === 'Enter' && aberta && sugestoes[ativo] !== undefined) {
      e.preventDefault();
      escolher(sugestoes[ativo]);
    } else if (e.key === 'Escape' && aberta) {
      e.preventDefault();
      setAberta(false);
    }
  };
  const visivel = aberta && sugestoes.length > 0;

  return (
    <div className="space-y-1.5">
      <label htmlFor={campoId} className="block text-sm font-medium text-slate-300">{rotulo}</label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={campoId}
            role="combobox"
            aria-expanded={visivel}
            aria-controls={listaId}
            aria-autocomplete="list"
            aria-activedescendant={visivel && ativo >= 0 ? `${listaId}-${ativo}` : undefined}
            autoComplete="off"
            value={texto}
            onChange={(e) => { confirmar(e.target.value); setAberta(true); setAtivo(-1); }}
            onClick={() => setAberta(true)}
            onBlur={() => setAberta(false)}
            onKeyDown={teclar}
            placeholder={placeholder}
            className="input min-w-0"
          />
          {visivel && (
            <ul id={listaId} role="listbox" aria-label={rotulo} className="eco-vidro absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-eco-border p-1 shadow-xl">
              {sugestoes.map((o, i) => (
                <li
                  key={o}
                  id={`${listaId}-${i}`}
                  role="option"
                  aria-selected={o === valor}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(o)}
                  onMouseEnter={() => setAtivo(i)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm',
                    i === ativo ? 'bg-eco-accent/10 text-eco-accent' : o === valor ? 'text-eco-accent' : 'text-slate-200',
                  )}
                >
                  <Check size={14} className={cn('shrink-0', o !== valor && 'invisible')} />
                  <span className="min-w-0 break-words">{o}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {texto && (
          <button type="button" className="btn shrink-0" onClick={() => confirmar('')}>
            <X size={14} /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}
