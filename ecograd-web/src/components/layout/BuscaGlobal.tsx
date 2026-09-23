import { useCallback, useDeferredValue, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Info, Rocket, Search, X } from 'lucide-react';
import { cn, correspondeBusca } from '@/lib/utils';
import { buscarNoAcervo, carregarIndiceBusca, MAX_COLECOES_POR_ITEM, prepararBusca, type ResultadoBusca } from '@/lib/busca-global';
import { carregarCobertura, type ColecaoCobertura } from '@/lib/colecoes';
import { abrirEscolhaDoAcervo, colecoesDaEscolha } from '@/services/abrir-item';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { useNavigation } from '@/services/navigation';
import { Progresso } from '@/components/ui/primitives';
import { Janela } from './Janela';
import { DetalhesCobertura, resumoCobertura } from './ColecoesPicker';
import { UnificarPessoas, ehPessoa, type Candidato } from './UnificarPessoas';
import { grupoDe, usePessoas } from '@/services/pessoas';

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
const ACERVO = { ppg: 'Pós-Graduação', tcc: 'Graduação' } as const;
/** Coleções são poucas e grossas: um punhado no topo basta para não abafar os itens. */
const MAX_COLECOES = 8;

type Opcao =
  | { kind: 'item'; chave: string; nome: string; item: ResultadoBusca }
  | { kind: 'colecao'; chave: string; nome: string; colecao: ColecaoCobertura };

const chaveItem = (i: ResultadoBusca) => `item:${i.tipo}:${i.nome}`;
const chaveColecao = (c: { tipo: string; nome: string }) => `colecao:${c.tipo}:${c.nome}`;

/**
 * Busca da apresentação: acha itens soltos (documento, pessoa, palavra-chave) e
 * coleções inteiras sem carregar nada. A escolha é múltipla; carregar traz a
 * união das coleções de tudo que estiver selecionado, recortada nos itens
 * escolhidos. O catálogo (~5 MB) só é baixado quando o campo recebe foco.
 *
 * O campo é a âncora visual da tela e nunca sai do lugar, sem que nada da
 * seleção cubra o resto da apresentação: a bandeja acima tem altura reservada
 * (rola por dentro em vez de crescer), as ações à direita estão sempre montadas
 * (aparecer e sumir mudaria a largura do campo) e a única coisa flutuante é a
 * lista de resultados, que some assim que a escolha é feita.
 */
export function BuscaGlobal() {
  const [ativada, setAtivada] = useState(false);
  const [texto, setTexto] = useState('');
  const consulta = useDeferredValue(texto);
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [escolhidos, setEscolhidos] = useState<Opcao[]>([]);
  /** Muda a cada escolha para reiniciar o anel do campo; é identidade, não contagem. */
  const [pulso, setPulso] = useState(0);
  const [envio, setEnvio] = useState<{ colecoes: number; omitidas: number } | null>(null);
  const campoId = useId();
  const listaId = useId();
  const statusId = useId();

  const carregada = useEcoGradStore((s) => s.dadosCarregados);
  const carregando = useEcoGradStore((s) => s.carregando);
  const mensagem = useEcoGradStore((s) => s.mensagemCarregamento);
  const progresso = useEcoGradStore((s) => s.progressoCarregamento);
  const erro = useEcoGradStore((s) => s.erroCarregamento);
  // A apresentação não tem o painel de histórico; o aviso de link direto
  // ("carregue as coleções para abrir a página pedida") apareceria em lugar nenhum.
  const aviso = useNavigation((n) => n.notice);

  const catalogo = useQuery({
    queryKey: ['indice-busca'],
    queryFn: ({ signal }) => carregarIndiceBusca(signal),
    enabled: ativada,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  const cobertura = useQuery({
    queryKey: ['colecoes-cobertura', 5],
    queryFn: ({ signal }) => carregarCobertura(signal),
    enabled: ativada,
    staleTime: Infinity,
    retry: 1,
  });
  const preparada = useMemo(() => (catalogo.data ? prepararBusca(catalogo.data) : null), [catalogo.data]);

  const resultados = useMemo<Opcao[]>(() => {
    if (consulta.trim().length < 2) return [];
    // Coleções primeiro: são o recorte mais amplo e a lista de itens é longa.
    const colecoes = (cobertura.data?.colecoes ?? [])
      .filter((c) => correspondeBusca(`${c.nome} ${ACERVO[c.tipo]}`, consulta))
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_COLECOES)
      .map((colecao): Opcao => ({ kind: 'colecao', chave: chaveColecao(colecao), nome: colecao.nome, colecao }));
    const itens = preparada
      ? buscarNoAcervo(preparada, consulta).map((item): Opcao => ({ kind: 'item', chave: chaveItem(item), nome: item.nome, item }))
      : [];
    return [...colecoes, ...itens];
  }, [preparada, cobertura.data, consulta]);

  useEffect(() => {
    if (ativo >= 0) document.getElementById(`${listaId}-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, listaId]);

  const marcados = useMemo(() => new Set(escolhidos.map((e) => e.chave)), [escolhidos]);
  const alternar = (o: Opcao) => {
    setEnvio(null);
    setPulso((n) => n + 1);
    setEscolhidos((atual) => atual.some((e) => e.chave === o.chave) ? atual.filter((e) => e.chave !== o.chave) : [...atual, o]);
  };

  const escolha = useMemo(() => ({
    itens: escolhidos.flatMap((e) => e.kind === 'item' ? [e.item] : []),
    colecoes: escolhidos.flatMap((e) => e.kind === 'colecao' ? [{ nome: e.colecao.nome, catalogo: e.colecao.tipo }] : []),
  }), [escolhidos]);
  const previa = useMemo(() => colecoesDaEscolha(escolha), [escolha]);
  const totalColecoes = previa.programas.length + previa.cursosTcc.length;
  // A alternativa sem limite, oferecida quando algum item passa dele.
  const previaTodas = useMemo(() => colecoesDaEscolha(escolha, Infinity), [escolha]);
  const totalTodas = previaTodas.programas.length + previaTodas.cursosTcc.length;
  const [perguntandoLimite, setPerguntandoLimite] = useState(false);
  const totalItens = escolha.itens.length;
  /** Volume comprimido que um conjunto de coleções vai baixar. */
  const mibDe = useCallback((p: { programas: string[]; cursosTcc: string[] }) => cobertura.data
    ? cobertura.data.colecoes.filter((c) => (c.tipo === 'ppg' ? p.programas : p.cursosTcc).includes(c.nome))
      .reduce((total, c) => total + c.downloadBytes, 0) / 1024 / 1024
    : null, [cobertura.data]);
  const downloadMiB = useMemo(() => mibDe(previa), [mibDe, previa]);
  const downloadTodasMiB = useMemo(() => mibDe(previaTodas), [mibDe, previaTodas]);
  // Só pessoas entram na fusão; coleções e temas ficam de fora.
  const candidatos = useMemo<Candidato[]>(
    () => escolhidos.flatMap((e) => e.kind === 'item' && ehPessoa(e.item.tipo) ? [{ nome: e.item.nome, tipo: e.item.tipo, registros: e.item.registros }] : []),
    [escolhidos],
  );
  const grupos = usePessoas((s) => s.grupos);
  /** O nome canônico para o qual esta grafia já aponta, quando houver fusão salva. */
  const fundidoEm = (e: Opcao) => {
    if (e.kind !== 'item' || !ehPessoa(e.item.tipo)) return null;
    const g = grupoDe(grupos, e.item.nome);
    return g && g.canonico !== e.item.nome ? g.canonico : null;
  };

  const carregar = (limite = MAX_COLECOES_POR_ITEM) => {
    setAberta(false);
    setPerguntandoLimite(false);
    const resultado = abrirEscolhaDoAcervo(escolha, limite);
    setEnvio(resultado.carregando ? { colecoes: resultado.colecoes, omitidas: resultado.omitidas } : null);
  };
  /**
   * Item espalhado em mais coleções que o limite: só as maiores deixam a análise
   * com números menores que os da busca, e todas pesam no download. Quem escolhe
   * entre rapidez e números completos é o usuário, antes de baixar.
   */
  const pedirCarregar = () => {
    if (previa.omitidas > 0) {
      setAberta(false);
      setPerguntandoLimite(true);
      return;
    }
    carregar();
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
      alternar(resultados[ativo >= 0 ? ativo : 0]);
    } else if (e.key === 'Escape' && aberta) {
      e.preventDefault();
      setAberta(false);
    }
  };

  const visivel = aberta && resultados.length > 0 && !carregando;
  const preparando = ativada && (!catalogo.data || !cobertura.data) && !catalogo.isError && !cobertura.isError;
  const status = carregando
    ? `Carregando ${plural(envio?.colecoes ?? totalColecoes, 'coleção', 'coleções')}. Aguarde o fim do carregamento para continuar.`
    : erro && envio !== null
      ? `Não foi possível carregar a seleção: ${erro}`
      : catalogo.isError
        ? 'Não foi possível preparar a busca em todo o acervo. Recarregue a página para tentar de novo.'
        : preparando
          ? 'Preparando a busca em todo o acervo...'
          : catalogo.data && texto.trim().length >= 2 && consulta === texto && resultados.length === 0
            ? 'Nenhum item ou coleção encontrado em todo o acervo.'
            : totalItens > 0
              // A honestidade do recorte começa aqui: o download é por coleção,
              // mas a análise será apenas dos itens escolhidos.
              ? `${plural(escolhidos.length, 'seleção', 'seleções')} · a análise mostrará só os documentos, pessoas e temas ${totalItens === 1 ? 'deste item' : 'destes itens'}, buscados em ${plural(totalColecoes, 'coleção', 'coleções')}.`
              : escolhidos.length > 0
                ? `${plural(escolhidos.length, 'seleção', 'seleções')} · ${plural(totalColecoes, 'coleção será carregada', 'coleções serão carregadas')} por inteiro.`
                : carregada
                  ? 'Busque itens ou coleções. Carregar substitui a análise atual pela nova seleção.'
                  : '';

  // O marco de busca nomeia o bloco para leitores de tela e dá ao tour guiado
  // um alvo que engloba campo, sugestões e o botão de carregar — durante o tour
  // só o que está dentro do recorte aceita clique.
  return (
    <div role="search" aria-label="Busca no acervo" className="mt-7 w-full max-w-2xl text-left">
      {/* Bandeja da seleção. A altura é fixa de propósito: reservar o espaço é o
          único jeito de, ao mesmo tempo, não empurrar a barra quando a seleção
          cresce e não cobrir nada da tela — um painel flutuante só troca um
          problema pelo outro. O que não couber rola aqui dentro, e o detalhe de
          cada item abre em janela, onde tem espaço para respirar. */}
      <div role="group" aria-label="Seleção atual"
        className={cn('flex h-32 flex-col rounded-lg border p-3', escolhidos.length ? 'border-eco-accent/40 bg-eco-accent/5' : 'border-dashed border-eco-border')}>
        {escolhidos.length === 0
          ? <p className="m-auto text-center text-xs text-slate-400">O que você escolher na busca aparece aqui. Nada é baixado até você confirmar.</p>
          : <>
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="min-w-0 text-xs text-slate-300">
                {plural(escolhidos.length, 'seleção', 'seleções')} · {plural(totalColecoes, 'coleção', 'coleções')}
                {/* Em telas estreitas o volume quebraria a linha do resumo e comeria a altura das tags; ele está inteiro nos detalhes. */}
                {downloadMiB !== null && <span className="hidden sm:inline"> · ~{downloadMiB.toFixed(2)} MiB</span>}
              </p>
              <Janela titulo="Detalhes da seleção" descricao="Cobertura, metadados e volume de cada item antes de carregar." larga
                trigger={<button type="button" className="btn shrink-0 px-2.5 py-1 text-xs"><Info size={13} className="shrink-0" /> Detalhes</button>}>
                <div className="space-y-2">
                  {escolhidos.map((e) => (
                    <div key={e.chave} className="eco-selecao-item rounded-lg border border-eco-border bg-eco-panel p-3">
                      <p className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-words text-sm font-semibold">{e.nome}</span>
                        <span className="shrink-0 rounded-full border border-eco-border px-2 py-0.5 text-[.7rem] text-eco-accent">{e.kind === 'colecao' ? 'Coleção' : e.item.tipo}</span>
                      </p>
                      {e.kind === 'colecao' ? <>
                        <p className="mt-1 text-sm text-slate-200">{ACERVO[e.colecao.tipo]} · {resumoCobertura(e.colecao)}</p>
                        {e.colecao.total === 0 && <p className="mt-1 text-xs text-amber-200">Sem registros neste recorte local. Isso não significa ausência de produção no repositório.</p>}
                        <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-eco-accent">Conferir metadados de {e.nome}</summary><DetalhesCobertura c={e.colecao} /></details>
                      </> : (<>
                        <p className="mt-1 text-sm text-slate-200">
                          {plural(e.item.registros, 'registro', 'registros')} · aparece em {plural(e.item.colecoes.length, 'coleção', 'coleções')}
                          {e.item.colecoes.length === 1 && `: ${e.item.colecoes[0].nome}`}
                        </p>
                        {fundidoEm(e) && <p className="mt-1 text-xs text-eco-accent">Unificado em “{fundidoEm(e)}”: os trabalhos das duas grafias entram juntos.</p>}
                      </>)}
                    </div>
                  ))}
                  {previa.omitidas > 0 && <p className="text-xs text-slate-400">Há itens em mais de {MAX_COLECOES_POR_ITEM} coleções. Ao carregar, você escolhe entre só as maiores ({plural(totalColecoes, 'coleção', 'coleções')}) e todas ({plural(totalTodas, 'coleção', 'coleções')}).</p>}
                  {downloadMiB !== null && <p className="text-xs text-slate-400">Download aproximado: {downloadMiB.toFixed(2)} MiB comprimidos. Coleções podem conter registros sobrepostos; somar volumes não produz um total de trabalhos únicos.</p>}
                </div>
              </Janela>
            </div>
            <ul className="mt-2 flex min-h-0 flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain pr-1">
              {escolhidos.map((e) => (
                <li key={e.chave} className="eco-selecao-chip h-fit">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-eco-accent/40 bg-eco-accent/10 py-1 pl-2.5 pr-1 text-xs text-eco-accent">
                    <span className="min-w-0 break-words">{e.nome}</span>
                    <span className="shrink-0 text-[.65rem] text-slate-400">{e.kind === 'colecao' ? 'Coleção' : e.item.tipo}</span>
                    <button type="button" disabled={carregando} onClick={() => alternar(e)} aria-label={`Remover ${e.nome}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-60"><X size={12} /></button>
                  </span>
                </li>
              ))}
            </ul>
          </>}
      </div>

      <label htmlFor={campoId} className="mt-3 block text-sm font-medium text-slate-300">Pesquise em todo o acervo</label>
      {/* `relative` só para a lista de resultados, que é a única coisa flutuante
          daqui: ela some ao escolher, e nada da seleção depende dela. */}
      <div className="relative mt-1.5">
        {/* Ações à direita, sempre montadas: aparecer e sumir mudaria a largura do campo. */}
        <div className="flex items-start gap-2">
          <div className="relative min-w-0 flex-1">
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
              placeholder="Título, autor, orientador, palavra-chave, macrotema ou coleção"
              onFocus={() => { setAtivada(true); setAberta(true); }}
              onClick={() => setAberta(true)}
              onChange={(e) => { setTexto(e.target.value); setAtivada(true); setAberta(true); setAtivo(-1); }}
              onBlur={() => setAberta(false)}
              onKeyDown={teclar}
              disabled={carregando}
              className="input pl-10 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {/* Anel que confirma a escolha: remontado a cada seleção para reiniciar a animação. */}
            {pulso > 0 && <span key={pulso} aria-hidden="true" className="eco-selecao-pulso pointer-events-none absolute inset-0 rounded-lg border-2 border-eco-accent" />}
          </div>

          <button type="button" className="btn btn-primary min-h-11 shrink-0 px-3 sm:px-4" onClick={pedirCarregar}
            disabled={totalColecoes === 0 || carregando}
            aria-label={`Carregar ${plural(totalColecoes, 'coleção', 'coleções')}`}
            title={totalColecoes === 0 ? 'Selecione um item ou uma coleção para carregar' : `Carregar ${plural(totalColecoes, 'coleção', 'coleções')}`}>
            <Rocket size={16} className="shrink-0" /> <span className="hidden sm:inline">Carregar</span>
          </button>
          <UnificarPessoas candidatos={candidatos} desabilitado={carregando} classe="btn min-h-11 shrink-0 px-3 sm:px-4"
            rotulo={<span className="sr-only sm:not-sr-only">Unificar</span>} />
        </div>

        {visivel && (
          <ul id={listaId} role="listbox" aria-multiselectable="true" aria-label="Resultados em todo o acervo" className="eco-vidro absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-auto rounded-lg border border-eco-border p-1 shadow-xl">
            {resultados.map((o, i) => {
              const marcado = marcados.has(o.chave);
              return (
                <li
                  key={o.chave}
                  id={`${listaId}-${i}`}
                  role="option"
                  aria-selected={marcado}
                  // `onMouseDown` prevenido: sem isso o blur fecharia a lista antes do
                  // clique, e cada escolha exigiria reabrir o campo.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => alternar(o)}
                  onMouseEnter={() => setAtivo(i)}
                  className={cn('eco-selecao-opcao flex min-h-11 cursor-pointer gap-2 rounded-md px-3 py-2 text-sm', i === ativo && 'bg-eco-accent/10')}
                >
                  <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', marcado ? 'eco-selecao-marca border-eco-accent bg-eco-action text-eco-on-action' : 'border-eco-border')}>
                    {marcado && <Check size={11} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-slate-100">{o.nome}</span>
                      <span className="shrink-0 rounded-full border border-eco-border px-2 py-0.5 text-[.7rem] text-eco-accent">{o.kind === 'colecao' ? 'Coleção' : o.item.tipo}</span>
                    </span>
                    <span className="block text-xs text-slate-400">
                      {o.kind === 'colecao'
                        ? `${ACERVO[o.colecao.tipo]} · ${resumoCobertura(o.colecao)}`
                        : `${plural(o.item.registros, 'registro', 'registros')} · ${o.item.colecoes.length === 1 ? o.item.colecoes[0].nome : plural(o.item.colecoes.length, 'coleção', 'coleções')}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Janela aberta={perguntandoLimite} onOpenChange={setPerguntandoLimite} titulo="Quantas coleções carregar?"
        descricao={`${escolha.itens.filter((i) => i.colecoes.length > MAX_COLECOES_POR_ITEM).length === 1 ? 'Um item escolhido aparece' : 'Itens escolhidos aparecem'} em mais de ${MAX_COLECOES_POR_ITEM} coleções. A análise só conta o que for carregado.`}>
        <div className="space-y-3 text-sm">
          <ul className="space-y-1 text-slate-300">
            {escolha.itens.filter((i) => i.colecoes.length > MAX_COLECOES_POR_ITEM).map((i) => (
              <li key={`${i.tipo}:${i.nome}`}><strong className="text-slate-100">{i.nome}</strong> · {i.tipo}: {plural(i.registros, 'registro', 'registros')} em {plural(i.colecoes.length, 'coleção', 'coleções')}</li>
            ))}
          </ul>
          <button type="button" className="btn w-full flex-col items-start gap-1 py-3 text-left" onClick={() => carregar(MAX_COLECOES_POR_ITEM)}>
            <span className="font-semibold">Só as maiores: {plural(totalColecoes, 'coleção', 'coleções')}{downloadMiB !== null && ` · ~${downloadMiB.toFixed(1)} MiB`}</span>
            <span className="text-xs text-slate-400">Carrega mais rápido, mas {plural(previa.omitidas, 'coleção fica', 'coleções ficam')} de fora: os números da análise serão menores que os mostrados na busca.</span>
          </button>
          <button type="button" className="btn w-full flex-col items-start gap-1 py-3 text-left" onClick={() => carregar(Infinity)}>
            <span className="font-semibold">Todas: {plural(totalTodas, 'coleção', 'coleções')}{downloadTodasMiB !== null && ` · ~${downloadTodasMiB.toFixed(1)} MiB`}</span>
            <span className="text-xs text-slate-400">Os números da análise batem com os da busca. O download é maior e a análise pode ficar lenta em celulares.</span>
          </button>
        </div>
      </Janela>
      {aviso && <p role="status" className="mt-2 text-xs text-amber-200">{aviso}</p>}
      <p id={statusId} role="status" className="mt-2 min-h-5 text-xs text-slate-300">{status}</p>
      {carregando && <div className="mt-2"><Progresso valor={progresso} texto={mensagem || 'Preparando o carregamento...'} /></div>}
    </div>
  );
}
