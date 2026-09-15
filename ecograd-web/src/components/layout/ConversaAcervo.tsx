import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Download, MessageSquare, TriangleAlert } from 'lucide-react';
import { carregarIndiceBusca, prepararBusca, type ResultadoBusca } from '@/lib/busca-global';
import { construirIndicesInvertidos } from '@/lib/entities';
import { executarFerramenta, type Recorte } from '@/lib/chat-ferramentas';
import { executarFerramentaCatalogo, type NomeFerramentaCatalogo, type PessoaNoCatalogo, type TemaNoCatalogo } from '@/lib/chat-catalogo';
import { planejar, type Plano } from '@/lib/chat-roteador';
import { abrirEscolhaDoAcervo } from '@/services/abrir-item';
import { carregarDados } from '@/services/calculos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { Progresso } from '@/components/ui/primitives';
import type { NomeFerramenta } from '@/lib/chat-ferramentas';

/** Perguntas de partida: mostram o que o chat sabe fazer sem precisar explicar. */
const EXEMPLOS = [
  'Quem mais orienta na pós-graduação da UFSC?',
  'Como os trabalhos na UFSC estão tratando empreendedorismo feminino?',
  'Quantos trabalhos a Patricia de Sá Freire tem no acervo, e em quais papéis?',
];

interface Resposta { plano: Plano; dados: unknown }

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
    if (plano.escopo === 'nenhum' || !plano.ferramenta) { setResposta({ plano, dados: null }); return; }
    try {
      const dados = plano.escopo === 'catalogo'
        ? preparada ? executarFerramentaCatalogo(plano.ferramenta as NomeFerramentaCatalogo, preparada, plano.argumentos) : null
        : executarFerramenta(plano.ferramenta as NomeFerramenta, { docs, indices }, plano.argumentos);
      setResposta({ plano, dados });
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

    {resposta && <RespostaChat resposta={resposta} baseCarregada={baseCarregada} carregando={carregando} aoCarregar={carregarRecorte} />}
  </section>;
}

function RespostaChat({ resposta, baseCarregada, carregando, aoCarregar }: {
  resposta: Resposta;
  baseCarregada: boolean;
  carregando: boolean;
  aoCarregar: (c: { programas: string[]; cursosTcc: string[] }) => void;
}) {
  const { plano, dados } = resposta;
  const colecoes = colecoesDaResposta(dados);
  const total = colecoes ? colecoes.programas.length + colecoes.cursosTcc.length : 0;

  return <div className="mt-4 space-y-4">
    {plano.recusa && <p className="aviso flex gap-2 text-sm"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /><span>{plano.recusa}</span></p>}

    {dados !== null && <div className="card space-y-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {plano.escopo === 'catalogo' ? 'Catálogo do acervo · rótulos' : 'Recorte carregado · texto completo'}
        {plano.alvo && <> · <span className="normal-case text-slate-300">{plano.alvo}</span></>}
      </p>
      <CorpoResposta dados={dados} />
    </div>}

    {plano.declarar.length > 0 && <ul className="space-y-1 text-xs text-slate-400">
      {plano.declarar.map((d) => <li key={d}>· {d}</li>)}
    </ul>}

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
function CorpoResposta({ dados }: { dados: unknown }) {
  const d = dados as Record<string, unknown>;

  if (typeof d.registros === 'number' && Array.isArray(d.itens) && 'trabalhosDistintos' in d) return <RecorteView r={dados as Recorte} />;
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

function RecorteView({ r }: { r: Recorte }) {
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
        <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-eco-accent underline">{i.titulo || 'Trabalho sem título'}</a>
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
