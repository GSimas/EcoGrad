import { useDeferredValue, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buscarNoAcervo, carregarIndiceBusca, prepararBusca, type ResultadoBusca } from '@/lib/busca-global';
import { abrirItemDoAcervo } from '@/services/abrir-item';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

/**
 * Busca da apresentação: acha qualquer item do acervo sem escolher coleções e
 * carrega só as coleções do item escolhido. O catálogo (~5 MB) só é baixado
 * quando o campo recebe foco.
 */
export function BuscaGlobal() {
  const [ativada, setAtivada] = useState(false);
  const [texto, setTexto] = useState('');
  const consulta = useDeferredValue(texto);
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [escolhido, setEscolhido] = useState<{ item: ResultadoBusca; colecoes: number; omitidas: number } | null>(null);
  const campoId = useId();
  const listaId = useId();
  const statusId = useId();

  const carregada = useEcoGradStore((s) => s.dadosCarregados);
  const carregando = useEcoGradStore((s) => s.carregando);
  const mensagem = useEcoGradStore((s) => s.mensagemCarregamento);
  const erro = useEcoGradStore((s) => s.erroCarregamento);

  const catalogo = useQuery({
    queryKey: ['indice-busca'],
    queryFn: ({ signal }) => carregarIndiceBusca(signal),
    enabled: ativada,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  const preparada = useMemo(() => (catalogo.data ? prepararBusca(catalogo.data) : null), [catalogo.data]);
  const resultados = useMemo(() => (preparada ? buscarNoAcervo(preparada, consulta) : []), [preparada, consulta]);

  useEffect(() => {
    if (ativo >= 0) document.getElementById(`${listaId}-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, listaId]);

  const escolher = (item: ResultadoBusca) => {
    setAberta(false);
    setAtivo(-1);
    setTexto(item.nome);
    const abertura = abrirItemDoAcervo(item);
    setEscolhido(abertura.carregando ? { item, colecoes: abertura.colecoes, omitidas: abertura.omitidas } : null);
  };

  const teclar = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = resultados.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAberta(true);
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setAtivo((i) => (!n ? -1 : i < 0 ? (passo > 0 ? 0 : n - 1) : (i + passo + n) % n));
    } else if (e.key === 'Enter' && aberta && n > 0) {
      e.preventDefault();
      escolher(resultados[ativo >= 0 ? ativo : 0]);
    } else if (e.key === 'Escape' && aberta) {
      e.preventDefault();
      setAberta(false);
    }
  };

  const visivel = aberta && resultados.length > 0;
  const status = escolhido && carregando
    ? `Carregando ${plural(escolhido.colecoes, 'coleção', 'coleções')} de “${escolhido.item.nome}”. ${mensagem}`
    : escolhido && erro
      ? `Não foi possível abrir “${escolhido.item.nome}”: ${erro}`
      : catalogo.isError
        ? 'Não foi possível preparar a busca em todo o acervo. Tente novamente ou escolha as coleções.'
        : ativada && !catalogo.data
          ? 'Preparando a busca em todo o acervo…'
          : catalogo.data && texto.trim().length >= 2 && consulta === texto && resultados.length === 0
            ? 'Nenhum item encontrado em todo o acervo.'
            : carregada
              ? 'Escolher um item substitui a análise atual pelas coleções em que ele aparece.'
              : 'Sem escolher coleções: ao selecionar um item, carregamos só as coleções em que ele aparece.';

  return (
    <div className="mt-7 w-full max-w-2xl text-left">
      <label htmlFor={campoId} className="block text-sm font-medium text-slate-300">Pesquise em todo o acervo</label>
      <div className="relative mt-1.5">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          id={campoId}
          role="combobox"
          aria-expanded={visivel}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-describedby={statusId}
          aria-activedescendant={visivel && ativo >= 0 ? `${listaId}-${ativo}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={texto}
          placeholder="Título, autor, orientador, palavra-chave ou macrotema"
          onFocus={() => { setAtivada(true); setAberta(true); }}
          onClick={() => setAberta(true)}
          onChange={(e) => { setTexto(e.target.value); setAtivada(true); setAberta(true); setAtivo(-1); }}
          onBlur={() => setAberta(false)}
          onKeyDown={teclar}
          className="input pl-10"
        />
        {visivel && (
          <ul id={listaId} role="listbox" aria-label="Resultados em todo o acervo" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-auto rounded-lg border border-eco-border bg-eco-panel p-1 shadow-xl">
            {resultados.map((r, i) => (
              <li
                key={`${r.tipo}:${r.nome}`}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === ativo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(r)}
                onMouseEnter={() => setAtivo(i)}
                className={cn('flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-sm', i === ativo && 'bg-eco-accent/10')}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-slate-100">{r.nome}</span>
                  <span className="shrink-0 rounded-full border border-eco-border px-2 py-0.5 text-[.7rem] text-eco-accent">{r.tipo}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {plural(r.registros, 'registro', 'registros')} · {r.colecoes.length === 1 ? r.colecoes[0].nome : plural(r.colecoes.length, 'coleção', 'coleções')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={statusId} role="status" className="mt-2 min-h-5 text-xs text-slate-400">{status}</p>
      {escolhido && escolhido.omitidas > 0 && (
        <p className="text-xs text-slate-400">
          “{escolhido.item.nome}” também aparece em mais {plural(escolhido.omitidas, 'coleção', 'coleções')}; carregamos as {escolhido.colecoes} com mais registros. Adicione as outras em “Editar seleção”.
        </p>
      )}
    </div>
  );
}
