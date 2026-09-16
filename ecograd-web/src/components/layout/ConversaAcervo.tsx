import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Download, ExternalLink, Layers, MessageSquare, Settings, Sparkles, Square, TriangleAlert } from 'lucide-react';
import { carregarIndiceBusca, prepararBusca, type ResultadoBusca } from '@/lib/busca-global';
import { construirIndicesInvertidos } from '@/lib/entities';
import { executarFerramenta, type ItemRecorte, type Recorte } from '@/lib/chat-ferramentas';
import { executarFerramentaCatalogo, type NomeFerramentaCatalogo, type PessoaNoCatalogo, type TemaNoCatalogo } from '@/lib/chat-catalogo';
import { planejar, type Plano } from '@/lib/chat-roteador';
import { abrirEscolhaDoAcervo, abrirRegistro } from '@/services/abrir-item';
import { carregarDados } from '@/services/calculos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { Progresso } from '@/components/ui/primitives';
import type { NomeFerramenta } from '@/lib/chat-ferramentas';
import { ConfiguracaoIA } from '@/components/chat/ConsultorIA';
import {
  fontesDaSintese, indiceDoItem, LOTES_SIMULTANEOS, planejarAprofundamento, promptLote, promptReducao, promptSintese, RESUMOS_PADRAO, verificarCitacoes,
  type FonteSintese, type PlanoAprofundamento,
} from '@/lib/chat-sintese';
import { markdownParaHtml } from '@/lib/markdown';
import { lerConfigIA, provedorPorId, validarConfigIA, type ConfigSalva } from '@/lib/provedores-ia';
import { escreverSintese } from '@/services/sintese-acervo';
import type { Documento, IndicesInvertidos } from '@/types';

/** Perguntas de partida: mostram o que o chat sabe fazer sem precisar explicar. */
const EXEMPLOS = [
  'Quem mais orienta na pós-graduação da UFSC?',
  'Como os trabalhos na UFSC estão tratando empreendedorismo feminino?',
  'Quantos trabalhos a Patricia de Sá Freire tem no acervo, e em quais papéis?',
];

/** `id` muda a cada envio: uma pergunta repetida recomeça a síntese do zero. */
interface Resposta { plano: Plano; dados: unknown; pergunta: string; id: number }

/**
 * Conversa sobre o acervo na tela inicial.
 *
 * A ordem é a da decisão D7 do ADR 001: **o recorte verificável primeiro**, e a
 * síntese em texto só depois, por cima de dados já apurados. Por isso esta tela
 * responde sem provedor de IA configurado — o que aparece aqui é contagem,
 * recorte e citação, tudo calculado no navegador.
 *
 * Sem base carregada, as perguntas são respondidas pelo catálogo global, que
 * indexa rótulos. Quando a pergunta exige ler resumo, a resposta diz o que o
 * catálogo alcança, declara o que não alcança e oferece carregar o recorte para
 * continuar aqui mesmo, com profundidade total.
 */
export function ConversaAcervo() {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [refazer, setRefazer] = useState(false);

  const docs = useEcoGradStore((s) => s.docs);
  const carregando = useEcoGradStore((s) => s.carregando);
  const mensagem = useEcoGradStore((s) => s.mensagemCarregamento);
  const progresso = useEcoGradStore((s) => s.progressoCarregamento);
  const erroCarregamento = useEcoGradStore((s) => s.erroCarregamento);
  const baseCarregada = docs.length > 0;

  // O catálogo (~5 MB) já é o mesmo cache da busca: quem usou a busca não baixa de novo.
  const catalogo = useQuery({
    queryKey: ['indice-busca'],
    queryFn: ({ signal }) => carregarIndiceBusca(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  const preparada = useMemo(() => (catalogo.data ? prepararBusca(catalogo.data) : null), [catalogo.data]);
  const indices = useMemo(() => construirIndicesInvertidos(docs), [docs]);

  const responder = (texto: string) => {
    const limpa = texto.trim();
    if (!limpa) return;
    setErro(null);
    const plano = planejar(limpa, { baseCarregada });
    if (plano.escopo === 'nenhum' || !plano.ferramenta) { setResposta({ plano, dados: null, pergunta: limpa, id: Date.now() }); return; }
    try {
      const dados = plano.escopo === 'catalogo'
        ? preparada ? executarFerramentaCatalogo(plano.ferramenta as NomeFerramentaCatalogo, preparada, plano.argumentos) : null
        : executarFerramenta(plano.ferramenta as NomeFerramenta, { docs, indices }, plano.argumentos);
      setResposta({ plano, dados, pergunta: limpa, id: Date.now() });
    } catch (e) {
      setResposta(null);
      setErro(e instanceof Error ? e.message : 'Não consegui apurar essa pergunta.');
    }
  };

  const enviar = (e: FormEvent) => { e.preventDefault(); responder(pergunta); };

  /**
   * Carrega o recorte sem sair daqui: a conversa continua com os resumos em mãos.
   *
   * O fim do carregamento só marca a pergunta para refazer. Responder de dentro
   * do callback usaria o fecho do render que disparou o download, quando ainda
   * não havia base — e a resposta voltaria do catálogo, idêntica à anterior. O
   * efeito abaixo roda depois do render novo, com `docs` e `indices` atualizados.
   */
  const carregarRecorte = (colecoes: { programas: string[]; cursosTcc: string[] }) => {
    if (!colecoes.programas.length && !colecoes.cursosTcc.length) return;
    carregarDados(colecoes.programas, colecoes.cursosTcc, undefined, () => setRefazer(true));
  };
  useEffect(() => {
    if (refazer && baseCarregada) { setRefazer(false); responder(pergunta); }
  }, [refazer, baseCarregada, docs, pergunta]);

  return <section className="mt-6 w-full text-left" aria-label="Conversa sobre o acervo">
    <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Pergunte sobre o acervo</span>
        <input type="text" className="input" value={pergunta} disabled={carregando}
          placeholder="Pergunte sobre o acervo: temas, pessoas, coleções, contagens..."
          onChange={(e) => setPergunta(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-primary shrink-0" disabled={carregando || !pergunta.trim() || (!baseCarregada && !catalogo.data)}>
        <MessageSquare size={16} className="shrink-0" /> Perguntar
      </button>
    </form>

    {!resposta && <div className="mt-3 flex flex-wrap gap-2">
      {EXEMPLOS.map((e) => <button key={e} type="button" className="btn text-xs" disabled={carregando}
        onClick={() => { setPergunta(e); responder(e); }}>{e}</button>)}
    </div>}

    {catalogo.isLoading && !baseCarregada && <p className="info mt-3 text-sm">Baixando o catálogo do acervo para responder sem carregar coleções…</p>}
    {catalogo.isError && !baseCarregada && <p className="aviso mt-3 text-sm">O catálogo do acervo não está disponível nesta versão da base. Carregue coleções pela busca para conversar sobre elas.</p>}
    {erro && <p role="alert" className="erro mt-3 text-sm">{erro}</p>}

    {carregando && <div className="mt-4 space-y-2" role="status">
      <p className="text-sm text-slate-300">{mensagem || 'Carregando o recorte…'}</p>
      <Progresso valor={progresso} />
    </div>}
    {erroCarregamento && <p role="alert" className="erro mt-3 text-sm">{erroCarregamento}</p>}

    {resposta && <RespostaChat resposta={resposta} docs={docs} indices={indices} baseCarregada={baseCarregada} carregando={carregando} aoCarregar={carregarRecorte} />}
  </section>;
}

function RespostaChat({ resposta, docs, indices, baseCarregada, carregando, aoCarregar }: {
  resposta: Resposta;
  docs: readonly Documento[];
  indices: IndicesInvertidos;
  baseCarregada: boolean;
  carregando: boolean;
  aoCarregar: (c: { programas: string[]; cursosTcc: string[] }) => void;
}) {
  const { plano, dados } = resposta;
  const colecoes = colecoesDaResposta(dados);
  const total = colecoes ? colecoes.programas.length + colecoes.cursosTcc.length : 0;
  const recorte = plano.escopo === 'recorte' ? recorteDe(dados) : null;

  return <div className="mt-4 space-y-4">
    {plano.recusa && <p className="aviso flex gap-2 text-sm"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /><span>{plano.recusa}</span></p>}

    {dados !== null && <div className="card space-y-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {plano.escopo === 'catalogo' ? 'Catálogo do acervo · rótulos' : 'Recorte carregado · texto completo'}
        {plano.alvo && <> · <span className="normal-case text-slate-300">{plano.alvo}</span></>}
      </p>
      <CorpoResposta dados={dados} docs={docs} />
    </div>}

    {plano.declarar.length > 0 && <ul className="space-y-1 text-xs text-slate-400">
      {plano.declarar.map((d) => <li key={d}>· {d}</li>)}
    </ul>}

    {/* D7: a síntese só vem depois do recorte verificável, e só com resumos em mãos. */}
    {recorte && recorte.itens.length > 0 && <SinteseCitada key={resposta.id} pergunta={resposta.pergunta} recorte={recorte} declarar={plano.declarar} docs={docs}
      recorteCompleto={() => recorteDe(executarFerramenta(plano.ferramenta as NomeFerramenta, { docs, indices }, { ...plano.argumentos, limite: Infinity }))} />}

    {/* O caminho para a profundidade: ler resumo exige o recorte em mãos. */}
    {plano.exigeResumo && !baseCarregada && colecoes && total > 0 && <div className="info space-y-3 text-sm">
      <p>Para ler os resumos e responder com o texto completo, preciso carregar {total === 1 ? 'esta coleção' : `estas ${total} coleções`}.{colecoes.omitidas > 0 && ` Outras ${colecoes.omitidas} ficam de fora deste recorte.`}</p>
      <button type="button" className="btn btn-primary" disabled={carregando} onClick={() => aoCarregar(colecoes)}>
        <Download size={16} className="shrink-0" /> Carregar e continuar a conversa
      </button>
    </div>}

    {plano.intencao === 'acao_abrir' && <AbrirDossie dados={dados} carregando={carregando} />}
  </div>;
}

/** Cada ferramenta devolve uma forma; a resposta mostra o que aquela forma tem. */
function CorpoResposta({ dados, docs }: { dados: unknown; docs: readonly Documento[] }) {
  const d = dados as Record<string, unknown>;

  if (ehRecorte(dados)) return <RecorteView r={dados} docs={docs} />;
  if ('porPapel' in d) return <PessoaView p={dados as PessoaNoCatalogo} />;
  if ('palavrasChave' in d) return <TemaView t={dados as TemaNoCatalogo} />;
  if (Array.isArray(d.ranking)) return <div className="space-y-2">
    <ListaContagem titulo="Mais frequentes" itens={d.ranking as Array<{ nome: string; registros: number }>} />
    {typeof d.escopo === 'string' && <p className="text-xs text-slate-400">Escopo: {d.escopo}.</p>}
  </div>;
  if (Array.isArray(d.porTipo)) return <Chips titulo="Itens por tipo no catálogo" itens={d.porTipo as Array<[string, number]>} />;
  if (Array.isArray(d.serie)) return <div className="space-y-2">
    <Chips titulo="Registros por ano" itens={(d.serie as Array<[string, number]>).slice(-12).map(([a, n]) => [a, n])} />
    {typeof d.anoEmColeta === 'number' && <p className="text-xs text-amber-200">{d.anoEmColeta} ainda em coleta.</p>}
  </div>;
  if (typeof d.grafiasDistintas === 'number') return <div className="space-y-2">
    <Numeros itens={[['grafias distintas', d.grafiasDistintas], ['colidem por acento', Number(d.colidemAoNormalizar ?? 0)]]} />
    <p className="text-xs text-slate-400">Unidade: {String(d.unidade ?? 'grafias')}.</p>
  </div>;
  if (typeof d.comoPalavraChave === 'object' && d.comoPalavraChave !== null) {
    const pc = d.comoPalavraChave as { registros: number };
    const mt = d.comoMacrotema as { registros: number };
    return <Numeros itens={[['como palavra-chave', pc.registros], ['como macrotema', mt.registros]]} />;
  }
  if (typeof d.existe === 'boolean') return d.existe
    ? <Chips titulo="Encontrado no catálogo" itens={(d.itens as Array<{ nome: string; tipo: string; registros: number }>).slice(0, 8).map((i) => [`${i.nome} · ${i.tipo}`, i.registros])} />
    : <p className="text-sm text-slate-300">Não encontrei nada com isso no catálogo do acervo.</p>;
  if (typeof d.comResumoUtilizavel === 'number') return <div className="space-y-3">
    <Numeros itens={[['registros', Number(d.registros)], ['com resumo utilizável', d.comResumoUtilizavel], ['sem resumo utilizável', Number(d.semResumoUtilizavel)], ['coleções', Number(d.colecoes)]]} />
    <Chips titulo="Por nível" itens={d.niveis as Array<[string, number]>} />
  </div>;
  return <pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(dados, null, 1)}</pre>;
}

function RecorteView({ r, docs }: { r: Recorte; docs: readonly Documento[] }) {
  return <div className="space-y-3">
    <Numeros itens={[
      ['registros', r.registros], ['trabalhos distintos', r.trabalhosDistintos],
      ['coleções', r.colecoes.length], ['sem resumo utilizável', r.semResumoUtilizavel],
    ]} />
    {r.serieAnual.length > 0 && <p className="text-sm text-slate-300">
      De {r.serieAnual[0][0]} a {r.serieAnual[r.serieAnual.length - 1][0]}
      {r.anoEmColeta !== null && <> · <span className="text-amber-200">{r.anoEmColeta} ainda em coleta</span></>}
    </p>}
    {r.colecoes.length > 0 && <Chips titulo="Coleções" itens={r.colecoes.slice(0, 6)} />}
    {r.macrotemas.length > 0 && <Chips titulo="Macrotemas" itens={r.macrotemas.slice(0, 6)} />}
    {r.itens.length > 0 && <ul className="space-y-1.5 border-t border-eco-border pt-3">
      {r.itens.slice(0, 10).map((i) => <li key={`${i.titulo}-${i.colecao}`} className="text-sm">
        <CitacaoItem item={i} docs={docs} />
        <span className="text-slate-400"> · {i.ano ?? 'sem ano'} · {i.colecao}</span>
        {i.somenteNoResumo && <span className="ml-1 text-xs text-amber-200">(só no resumo)</span>}
      </li>)}
      {r.itensOmitidos > 0 && <li className="text-xs text-slate-400">e mais {r.itensOmitidos.toLocaleString('pt-BR')} não listados aqui.</li>}
    </ul>}
  </div>;
}

function PessoaView({ p }: { p: PessoaNoCatalogo }) {
  if (!p.encontrada) return <p className="text-sm text-slate-300">Não encontrei ninguém com esse nome no catálogo do acervo.</p>;
  return <div className="space-y-3">
    <Numeros itens={[['como autor', p.porPapel.Autor], ['como orientador', p.porPapel.Orientador], ['como coorientador', p.porPapel['Co-orientador']], ['registros somados', p.registrosSomados]]} />
    <Chips titulo="Grafias no catálogo" itens={p.grafias.map((g) => [`${g.nome} · ${g.tipo}`, g.registros])} />
  </div>;
}

function TemaView({ t }: { t: TemaNoCatalogo }) {
  const vazio = !t.palavrasChave.length && !t.macrotemas.length && !t.documentos.length;
  if (vazio) return <p className="text-sm text-slate-300">Nenhum rótulo do acervo corresponde a isso. Pode ser tema ausente ou escrito de outra forma — carregar um recorte permite procurar no texto dos resumos.</p>;
  return <div className="space-y-3">
    <Numeros itens={[['registros pelos rótulos', t.registrosPorRotulo], ['palavras-chave', t.palavrasChave.length], ['macrotemas', t.macrotemas.length], ['títulos', t.documentos.length]]} />
    {t.palavrasChave.length > 0 && <Chips titulo="Palavras-chave" itens={t.palavrasChave.slice(0, 8).map((i) => [i.nome, i.registros])} />}
    {t.macrotemas.length > 0 && <Chips titulo="Macrotemas" itens={t.macrotemas.slice(0, 8).map((i) => [i.nome, i.registros])} />}
    {t.documentos.length > 0 && <div>
      <p className="text-xs font-medium text-slate-400">Títulos</p>
      <ul className="mt-1 space-y-1">{t.documentos.slice(0, 8).map((i) => <li key={i.nome} className="text-sm text-slate-300">{i.nome}</li>)}</ul>
    </div>}
  </div>;
}

const Numeros = ({ itens }: { itens: Array<[string, number]> }) => <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
  {itens.map(([rotulo, valor]) => <div key={rotulo}>
    <dt className="text-xs text-slate-400">{rotulo}</dt>
    <dd className="text-lg font-semibold text-eco-accent">{valor.toLocaleString('pt-BR')}</dd>
  </div>)}
</dl>;

const Chips = ({ titulo, itens }: { titulo: string; itens: Array<[string, number]> }) => <div>
  <p className="text-xs font-medium text-slate-400">{titulo}</p>
  <ul className="mt-1 flex flex-wrap gap-1.5">
    {itens.map(([nome, n]) => <li key={nome} className="rounded-full border border-eco-border px-2.5 py-1 text-xs text-slate-300">
      {nome} <span className="text-slate-400">· {n.toLocaleString('pt-BR')}</span>
    </li>)}
  </ul>
</div>;

const ListaContagem = ({ titulo, itens }: { titulo: string; itens: Array<{ nome: string; registros: number }> }) =>
  <Chips titulo={titulo} itens={itens.map((i) => [i.nome, i.registros])} />;

/** Abre o dossiê da pessoa reunindo os papéis, carregando o que for preciso. */
function AbrirDossie({ dados, carregando }: { dados: unknown; carregando: boolean }) {
  const p = dados as PessoaNoCatalogo | null;
  if (!p?.encontrada) return null;
  const abrir = () => abrirEscolhaDoAcervo({ itens: p.resultados as ResultadoBusca[], colecoes: [] });
  return <button type="button" className="btn btn-primary" disabled={carregando} onClick={abrir}>
    <BookOpen size={16} className="shrink-0" /> Abrir o dossiê de {p.grafias[0]?.nome ?? p.consulta} <ArrowRight size={14} className="shrink-0" />
  </button>;
}

/** As coleções que a resposta oferece carregar, quando a ferramenta devolve isso. */
function colecoesDaResposta(dados: unknown): { programas: string[]; cursosTcc: string[]; omitidas: number } | null {
  const c = (dados as { colecoesParaCarregar?: unknown } | null)?.colecoesParaCarregar;
  if (!c || typeof c !== 'object') return null;
  const { programas, cursosTcc, omitidas } = c as { programas?: unknown; cursosTcc?: unknown; omitidas?: unknown };
  if (!Array.isArray(programas) || !Array.isArray(cursosTcc)) return null;
  return { programas: programas as string[], cursosTcc: cursosTcc as string[], omitidas: typeof omitidas === 'number' ? omitidas : 0 };
}

const ehRecorte = (v: unknown): v is Recorte => {
  const d = v as Record<string, unknown> | null;
  return !!d && typeof d.registros === 'number' && Array.isArray(d.itens) && 'trabalhosDistintos' in d;
};

/** O recorte da resposta, direto ou dentro do dossiê de uma pessoa. */
function recorteDe(dados: unknown): Recorte | null {
  if (ehRecorte(dados)) return dados;
  const interno = (dados as { recorte?: unknown } | null)?.recorte;
  return ehRecorte(interno) ? interno : null;
}

/** O título abre o dossiê no EcoGrad (regra de citação da aferição); a fonte original fica ao lado. */
function CitacaoItem({ item, docs }: { item: ItemRecorte; docs: readonly Documento[] }) {
  const indice = indiceDoItem(docs, item);
  const titulo = item.titulo || 'Trabalho sem título';
  if (indice < 0) return <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-eco-accent underline">{titulo}</a>;
  return <>
    <button type="button" className="text-left text-eco-accent underline" onClick={() => abrirRegistro(docs, indice)}>{titulo}</button>
    {item.url && <> <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-eco-accent" title="Fonte original, em nova aba">
      <ExternalLink size={13} className="inline" aria-hidden /><span className="sr-only">Fonte original (nova aba)</span>
    </a></>}
  </>;
}

const milhares = (n: number) => n.toLocaleString('pt-BR');
const duracao = ([min, max]: readonly [number, number]) =>
  max < 60 ? 'menos de 1 minuto' : `cerca de ${Math.max(1, Math.round(min / 60))} a ${Math.ceil(max / 60)} minutos`;

type Leitura = { recorte: Recorte; fontes: FonteSintese[]; aprofundada: boolean };
type Proposta = { recorte: Recorte; fontes: FonteSintese[]; plano: PlanoAprofundamento };

/**
 * Síntese citada (decisão D7): o modelo do próprio usuário (BYOK, D10) escreve
 * só sobre as fontes numeradas, depois do recorte já apurado. A leitura padrão
 * envia até `RESUMOS_PADRAO` resumos; "aprofundar" (D8) lê todos em lotes, depois
 * de mostrar chamadas, tokens e tempo. Cada [n] vira botão para o dossiê do
 * registro, e citação a fonte que não foi enviada é apontada.
 */
function SinteseCitada({ pergunta, recorte, declarar, docs, recorteCompleto }: {
  pergunta: string;
  recorte: Recorte;
  declarar: readonly string[];
  docs: readonly Documento[];
  /** O mesmo recorte sem o teto de itens da tela, calculado só quando se pede para aprofundar. */
  recorteCompleto: () => Recorte | null;
}) {
  const [config, setConfig] = useState<ConfigSalva | null>(lerConfigIA);
  const configurado = !!config && !validarConfigIA(config);
  const [configurando, setConfigurando] = useState(false);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'ocioso' | 'escrevendo' | 'pronto' | 'erro'>('ocioso');
  const [erro, setErro] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [progresso, setProgresso] = useState<{ feitos: number; lotes: number } | null>(null);
  const controle = useRef<AbortController | null>(null);
  const interrompidoPeloUsuario = useRef(false);
  useEffect(() => () => controle.current?.abort(), []);

  const fontesPadrao = useMemo(() => fontesDaSintese(docs, recorte), [docs, recorte]);
  const fontes = leitura?.fontes ?? fontesPadrao;
  // O HTML vem de `markdownParaHtml`, que escapa o texto do modelo antes de
  // qualquer marcação; só então os [n] válidos viram botões.
  const html = useMemo(() => markdownParaHtml(texto).replace(/\[(\d{1,4})\]/g, (marca, n: string) => (
    Number(n) >= 1 && Number(n) <= fontes.length
      ? `<button type="button" class="eco-citacao" data-citacao="${n}" title="Abrir o dossiê da fonte ${n}">[${n}]</button>`
      : marca
  )), [texto, fontes.length]);
  const provedor = config ? provedorPorId(config.provedor).nome : 'o provedor escolhido';

  if (fontesPadrao.length === 0) return <p className="text-xs text-slate-400">Nenhum dos registros listados neste recorte tem resumo utilizável, então não há texto para a síntese.</p>;

  /** Envolve uma escrita com estado, cancelamento e mensagem de erro. */
  const executar = async (tarefa: (controle: AbortController, ativa: ConfigSalva) => Promise<void>) => {
    if (!config || !configurado) { setConfigurando(true); return; }
    const request = new AbortController();
    controle.current = request;
    interrompidoPeloUsuario.current = false;
    setTexto('');
    setErro(null);
    setEstado('escrevendo');
    try {
      await tarefa(request, config);
      setEstado('pronto');
    } catch (e) {
      setErro(interrompidoPeloUsuario.current ? 'Interrompido por você. O texto parcial foi mantido.' : e instanceof Error ? e.message : 'Falha ao escrever a síntese.');
      setEstado('erro');
    } finally {
      setProgresso(null);
      if (controle.current === request) controle.current = null;
    }
  };

  const escreverPadrao = () => void executar(async (request, ativa) => {
    setLeitura(null);
    const { sistema, mensagem } = promptSintese(pergunta, recorte, fontesPadrao, declarar);
    await escreverSintese(ativa, sistema, mensagem, setTexto, request.signal);
  });

  const proporAprofundamento = () => {
    const completo = recorteCompleto();
    if (!completo) return;
    const todas = fontesDaSintese(docs, completo, Infinity);
    setProposta({ recorte: completo, fontes: todas, plano: planejarAprofundamento(todas) });
  };

  const aprofundar = (p: Proposta) => {
    setProposta(null);
    void executar(async (request, ativa) => {
      setLeitura({ recorte: p.recorte, fontes: p.fontes, aprofundada: true });
      const total = p.plano.lotes.length;
      const notas: string[] = new Array(total).fill('');
      let proximo = 0;
      let feitos = 0;
      setProgresso({ feitos, lotes: total });
      const trabalhador = async () => {
        while (proximo < total && !request.signal.aborted) {
          const i = proximo++;
          const { sistema, mensagem } = promptLote(pergunta, p.plano.lotes[i]);
          try {
            notas[i] = await escreverSintese(ativa, sistema, mensagem, () => {}, request.signal);
          } catch (e) {
            // Um lote que falha para os demais: síntese sobre notas incompletas pareceria completa.
            request.abort();
            throw e;
          }
          feitos += 1;
          setProgresso({ feitos, lotes: total });
        }
      };
      await Promise.all(Array.from({ length: Math.min(LOTES_SIMULTANEOS, total) }, trabalhador));
      const { sistema, mensagem } = promptReducao(pergunta, p.recorte, p.fontes, notas, declarar);
      await escreverSintese(ativa, sistema, mensagem, setTexto, request.signal);
    });
  };

  const verificacao = estado === 'pronto' ? verificarCitacoes(texto, fontes.length) : null;
  const abrirCitacao = (e: MouseEvent<HTMLDivElement>) => {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-citacao]');
    const fonte = alvo ? fontes[Number(alvo.dataset.citacao) - 1] : undefined;
    if (fonte) abrirRegistro(docs, fonte.indice);
  };
  // Só vale aprofundar quando a leitura padrão não cobriu o recorte todo.
  const podeAprofundar = recorte.itensOmitidos > 0 || fontesPadrao.length >= RESUMOS_PADRAO;
  const registrosLidos = (leitura?.recorte ?? recorte).registros;

  return <div className="card space-y-3" aria-label="Síntese citada">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {leitura?.aprofundada ? 'Síntese aprofundada' : 'Síntese com IA'} · {milhares(fontes.length)} {fontes.length === 1 ? 'resumo lido' : 'resumos lidos'} de {milhares(registrosLidos)} {registrosLidos === 1 ? 'registro' : 'registros'}
      </p>
      {configurado && !configurando && <button type="button" className="btn text-xs" onClick={() => setConfigurando(true)}>
        <Settings size={14} className="shrink-0" aria-hidden /> {provedor} · {config?.modelo}
      </button>}
    </div>
    <p className="text-xs leading-relaxed text-slate-400">
      A pergunta e os resumos lidos vão direto do seu navegador para {provedor}, com a sua chave, e o uso é cobrado na sua conta. O EcoGrad não recebe nem guarda nada disso. A síntese só pode citar as fontes numeradas; confira cada citação no dossiê.
    </p>

    {configurando
      ? <ConfiguracaoIA inicial={config} onSalvo={(c) => { setConfig(c); setConfigurando(false); }} onEsquecer={() => setConfig(lerConfigIA())} />
      : <div className="flex flex-wrap gap-2">
        {estado === 'escrevendo'
          ? <button type="button" className="btn" onClick={() => { interrompidoPeloUsuario.current = true; controle.current?.abort(); }}>
            <Square size={14} className="shrink-0" aria-hidden /> Interromper
          </button>
          : <>
            <button type="button" className="btn btn-primary" onClick={escreverPadrao}>
              <Sparkles size={16} className="shrink-0" aria-hidden /> {!configurado ? 'Configurar provedor para a síntese' : texto && !leitura ? 'Escrever de novo' : `Escrever síntese citada (${fontesPadrao.length} resumos)`}
            </button>
            {podeAprofundar && <button type="button" className="btn" onClick={proporAprofundamento} aria-expanded={!!proposta}>
              <Layers size={16} className="shrink-0" aria-hidden /> Aprofundar: ler todos os resumos
            </button>}
          </>}
      </div>}

    {proposta && estado !== 'escrevendo' && !configurando && <div className="info space-y-2 text-sm" role="region" aria-label="Custo de aprofundar">
      <p>
        Aprofundar lê <strong>{milhares(proposta.fontes.length)} resumos utilizáveis</strong> de {milhares(proposta.recorte.registros)} registros
        ({milhares(proposta.recorte.semResumoUtilizavel)} sem resumo utilizável ficam de fora e obra repetida entra uma vez), em {proposta.plano.lotes.length} {proposta.plano.lotes.length === 1 ? 'lote' : 'lotes'}:
        {' '}<strong>{proposta.plano.chamadas} chamadas</strong> para {provedor}{configurado ? ` (${config?.modelo})` : ', que você configura antes de começar'}, até {LOTES_SIMULTANEOS} ao mesmo tempo.
      </p>
      <p>
        Estimativa: ~{milhares(proposta.plano.tokensEntrada)} tokens de entrada e ~{milhares(proposta.plano.tokensSaida)} de saída, cobrados na sua conta; confira o preço por token do seu modelo.
        Tempo: {duracao(proposta.plano.segundos)}. É ordem de grandeza: custo e tempo reais variam com o provedor e o modelo.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => aprofundar(proposta)} disabled={!proposta.plano.lotes.length}>
          <Layers size={16} className="shrink-0" aria-hidden /> Aprofundar agora
        </button>
        <button type="button" className="btn" onClick={() => setProposta(null)}>Cancelar</button>
      </div>
    </div>}

    {estado === 'escrevendo' && !texto && <p role="status" className="text-sm text-slate-400">
      {progresso
        ? progresso.feitos < progresso.lotes
          ? `Lendo os resumos em lotes: ${progresso.feitos} de ${progresso.lotes} concluídos.`
          : 'Lotes lidos. Escrevendo a síntese sobre as notas…'
        : 'Lendo os resumos…'}
    </p>}
    {texto && <div className="markdown text-sm" aria-live="polite" onClick={abrirCitacao} dangerouslySetInnerHTML={{ __html: html }} />}
    {erro && <p role="alert" className="erro text-sm">{erro}</p>}
    {verificacao && verificacao.inexistentes.length > 0 && <p className="aviso text-xs">
      A síntese citou {verificacao.inexistentes.map((n) => `[${n}]`).join(', ')}, que não {verificacao.inexistentes.length === 1 ? 'é fonte' : 'são fontes'} desta leitura. Desconsidere essas afirmações.
    </p>}
    {verificacao?.semCitacao && <p className="aviso text-xs">A síntese não citou nenhuma fonte. Pelas regras do EcoGrad, texto sem citação não deve ser usado.</p>}

    <details className="text-xs text-slate-400">
      <summary>Fontes {leitura?.aprofundada ? 'lidas' : 'enviadas'} ({milhares(fontes.length)})</summary>
      <ol className="mt-2 space-y-1">
        {fontes.map((f) => <li key={f.numero}>
          <button type="button" className="text-left text-eco-accent underline" onClick={() => abrirRegistro(docs, f.indice)}>[{f.numero}] {f.titulo || 'Trabalho sem título'}</button>
          <span> · {f.ano ?? 'sem ano'} · {f.colecao}</span>
        </li>)}
      </ol>
    </details>
  </div>;
}
