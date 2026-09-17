import { useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eraser, Send, Settings, Square, User } from 'lucide-react';
import { ConfiguracaoIA, RetratoUFSCao } from '@/components/chat/ConsultorIA';
import { ConversaAcervo } from '@/components/layout/ConversaAcervo';
import { Aviso, Expander } from '@/components/ui/primitives';
import { carregarIndiceBusca, itemDoAcervo, type IndiceBusca, type ResultadoBusca } from '@/lib/busca-global';
import { estadoDoIndice, indiceConfigurado } from '@/lib/indice-remoto';
import { markdownParaHtml } from '@/lib/markdown';
import { dicionarioDeItens, realcarMencoes, type Mencao } from '@/lib/mencoes';
import { lerConfigIA, provedorPorId, validarConfigIA } from '@/lib/provedores-ia';
import { citacoesInvalidas, fontesDaAmostra, realcarCitacoes, type Fonte } from '@/lib/ufscao-acervo';
import { baixarArquivo } from '@/lib/utils';
import { abrirEscolhaDoAcervo } from '@/services/abrir-item';
import { perguntarAoAcervo, type Etapa, type RespostaAcervo } from '@/services/ufscao-acervo';
import { useSessionField } from '@/hooks/useSessionField';
import type { TipoBusca } from '@/types';

const EXEMPLOS = [
  'Como os trabalhos da UFSC estão tratando empreendedorismo feminino?',
  'Quem mais orientou trabalhos sobre gestão do conhecimento?',
  'Quantos trabalhos a Patricia de Sá Freire tem, e em quais papéis?',
];

const ETAPAS: Record<Etapa, string> = {
  planejando: 'O UFSCão está entendendo a pergunta',
  consultando: 'O UFSCão está farejando o acervo inteiro',
  escrevendo: 'O UFSCão está escrevendo',
};

const PAPEIS: TipoBusca[] = ['Autor', 'Orientador', 'Co-orientador'];
const CAMPOS_DE_PESSOA = new Set(['nome', 'orientador', 'orientando', 'rotulo']);

/** Pessoas e títulos que o banco devolveu nesta resposta: só eles viram botão. */
function itensDaResposta(r: RespostaAcervo): Mencao[] {
  const itens: Mencao[] = [];
  const pessoa = (nome: unknown) => { if (typeof nome === 'string' && nome.includes(',')) itens.push({ tipo: 'Pessoa', nome }); };
  for (const [nome] of r.panorama?.principais_orientadores ?? []) pessoa(nome);
  for (const o of r.panorama?.amostra ?? []) {
    (o.autores ?? []).forEach(pessoa);
    (o.orientador ?? '').split('; ').forEach(pessoa);
  }
  for (const linha of r.dados?.linhas ?? []) {
    for (const [campo, valor] of Object.entries(linha)) if (CAMPOS_DE_PESSOA.has(campo)) pessoa(valor);
  }
  return itens;
}

/**
 * Abre no Motor de Busca o que a resposta citou. Sem base carregada, o item é
 * achado no catálogo global e as coleções dele são carregadas — o mesmo caminho
 * da busca da tela inicial.
 */
function abrirNoMotor(indice: IndiceBusca | undefined, tipo: 'Documento' | 'Pessoa', nome: string, url?: string | null) {
  const itens: ResultadoBusca[] = indice
    ? (tipo === 'Documento' ? [itemDoAcervo(indice, 'Documento', nome)] : PAPEIS.map((p) => itemDoAcervo(indice, p, nome)))
      .filter((i): i is ResultadoBusca => !!i)
    : [];
  if (itens.length) { abrirEscolhaDoAcervo({ itens, colecoes: [] }); return; }
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * UFSCão na tela inicial, sobre o acervo inteiro (ADR 004, fase A). O modelo do
 * usuário planeja, o índice apura e o modelo escreve citando a amostra; cada
 * citação abre a obra no Motor de Busca. Sem índice no ar, a conversa volta às
 * respostas determinísticas do catálogo, como pede a decisão D1.
 */
export function UFSCaoAcervo() {
  const [conversa, setConversa] = useSessionField<RespostaAcervo[]>('ufscao.acervo.conversa', []);
  const [entrada, setEntrada] = useState('');
  const [perguntaAtual, setPerguntaAtual] = useState('');
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [parcial, setParcial] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [config, setConfig] = useState(lerConfigIA);
  const configurado = !!config && !validarConfigIA(config);
  const [configurando, setConfigurando] = useState(false);
  const [semIA, setSemIA] = useSessionField('ufscao.acervo.semIA', false);
  const controle = useRef<AbortController | null>(null);

  const estado = useQuery({ queryKey: ['indice-estado'], queryFn: estadoDoIndice, enabled: indiceConfigurado(), staleTime: 5 * 60 * 1000, retry: 0 });
  const catalogo = useQuery({ queryKey: ['indice-busca'], queryFn: ({ signal }) => carregarIndiceBusca(signal), staleTime: Infinity, gcTime: Infinity, retry: 1 });

  if (!indiceConfigurado() || estado.data?.disponivel === false || semIA) {
    return <div className="mt-6 space-y-3 text-left">
      {!semIA && <Aviso tipo="aviso">O UFSCão precisa do índice do acervo, que não está disponível agora{estado.data?.motivo ? `: ${estado.data.motivo}` : '.'} As respostas abaixo vêm do catálogo, sem IA.</Aviso>}
      {semIA && <button type="button" className="btn text-xs" onClick={() => setSemIA(false)}>Voltar ao UFSCão</button>}
      <ConversaAcervo />
    </div>;
  }

  const enviar = async (texto: string) => {
    const pergunta = texto.trim();
    if (!pergunta || etapa || !config || !configurado) return;
    setErro(null); setParcial(''); setEntrada(''); setPerguntaAtual(pergunta);
    const request = new AbortController();
    controle.current = request;
    try {
      const turnos = conversa.map((r) => ({ pergunta: r.pergunta, plano: r.plano, resposta: r.texto }));
      const resposta = await perguntarAoAcervo(config, pergunta, turnos, setEtapa, setParcial, request.signal);
      setConversa((c) => [...c, resposta]);
      setParcial('');
    } catch (e) {
      setEntrada(pergunta);
      setErro(request.signal.aborted ? 'Resposta interrompida por você. A pergunta voltou para a caixa de texto.' : `${e instanceof Error ? e.message : 'Não consegui responder.'} A pergunta voltou para a caixa de texto.`);
    } finally {
      setEtapa(null);
      if (controle.current === request) controle.current = null;
    }
  };

  const provedor = config ? `${provedorPorId(config.provedor).nome} · ${config.modelo}` : '';

  return <div className="mt-6 space-y-4 text-left">
    <div className="flex items-center gap-2">
      <RetratoUFSCao tamanho={36} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">UFSCão <span className="font-normal text-slate-400">· sobre o acervo inteiro</span></p>
        <p className="truncate text-xs text-slate-400">{configurado ? provedor : 'Configure seu provedor de IA para conversar'}</p>
      </div>
      {conversa.length > 0 && !etapa && <button type="button" className="btn h-10 w-10 px-0" aria-label="Limpar conversa" title="Limpar conversa" onClick={() => { setConversa([]); setErro(null); }}><Eraser size={16} /></button>}
      {configurado && <button type="button" className="btn h-10 w-10 px-0" aria-pressed={configurando} aria-label="Provedor e chave de API" title="Provedor e chave de API" onClick={() => setConfigurando((v) => !v)}><Settings size={16} /></button>}
    </div>

    {(!configurado || configurando) ? <div className="card space-y-3">
      <ConfiguracaoIA inicial={config} onSalvo={(c) => { setConfig(c); setConfigurando(false); }} onEsquecer={() => setConfig(lerConfigIA())} />
      {!configurado && <p className="text-xs text-slate-400">Sem chave de API, dá para <button type="button" className="underline" onClick={() => setSemIA(true)}>responder pelo catálogo, sem IA</button>: contagens e listas, sem texto escrito.</p>}
    </div> : <>
      {conversa.length === 0 && <Aviso tipo="aviso">
        <p><strong>O UFSCão é uma inteligência artificial</strong> e pode errar. Ele consulta o índice do acervo inteiro, escreve com o modelo do provedor que você configurou e cita as obras em que se baseou. Confira as fontes antes de usar a resposta.</p>
        <p className="mt-2">A pergunta e os dados apurados vão direto do seu navegador para o provedor, com a sua chave; o EcoGrad não guarda a conversa.</p>
      </Aviso>}

      {conversa.map((r) => <Turno key={r.id} resposta={r} indice={catalogo.data} />)}

      {etapa && <>
        <Balao papel="user">{perguntaAtual}</Balao>
        {parcial
          ? <Balao papel="assistant"><div className="markdown" dangerouslySetInnerHTML={{ __html: markdownParaHtml(`${parcial}▌`) }} /></Balao>
          : <p className="eco-farejando text-sm text-slate-400" role="status"><RetratoUFSCao tamanho={22} /><span>{ETAPAS[etapa]}</span>
            <span aria-hidden className="flex items-center gap-1"><span className="ponto" /><span className="ponto" /><span className="ponto" /></span></p>}
      </>}
      {erro && <Aviso tipo="erro"><p role="status">{erro}</p></Aviso>}

      {conversa.length === 0 && !etapa && <div className="flex flex-wrap gap-2">
        {EXEMPLOS.map((e) => <button key={e} type="button" className="btn text-left text-xs" onClick={() => void enviar(e)}>{e}</button>)}
      </div>}

      <form className="flex items-end gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); void enviar(entrada); }}>
        <textarea value={entrada} onChange={(e) => setEntrada(e.target.value)} rows={2} maxLength={2000}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(entrada); } }}
          placeholder="Pergunte sobre temas, pessoas, programas ou períodos do acervo…" aria-label="Pergunta para o UFSCão"
          className="input min-h-[56px] min-w-0 flex-1 resize-none" disabled={!!etapa} />
        {etapa
          ? <button type="button" className="btn h-11 w-11 shrink-0 px-0" onClick={() => controle.current?.abort()} aria-label="Interromper resposta" title="Interromper resposta"><Square size={16} /></button>
          : <button type="submit" className="btn btn-primary h-11 w-11 shrink-0 px-0" aria-label="Enviar" title="Enviar" disabled={!entrada.trim()}><Send size={16} /></button>}
      </form>
      {conversa.length > 0 && !etapa && <button type="button" className="btn text-xs" onClick={() => baixarArquivo(JSON.stringify(conversa, null, 2), 'ecograd-ufscao-acervo.json')}>Exportar conversa</button>}
    </>}
  </div>;
}

function Balao({ papel, children }: { papel: 'user' | 'assistant'; children: ReactNode }) {
  const usuario = papel === 'user';
  return <div className={`flex gap-2 ${usuario ? 'flex-row-reverse' : ''}`}>
    {usuario
      ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-eco-action text-black"><User size={14} /></span>
      : <span className="h-7 w-7 shrink-0"><RetratoUFSCao tamanho={28} /></span>}
    <div className={`min-w-0 flex-1 break-words rounded-xl border border-eco-border px-3 py-2 text-sm ${usuario ? 'bg-eco-accent/10' : 'bg-eco-panel/70'}`}>{children}</div>
  </div>;
}

function Turno({ resposta: r, indice }: { resposta: RespostaAcervo; indice: IndiceBusca | undefined }) {
  const fontes = useMemo(() => fontesDaAmostra(r.panorama), [r.panorama]);
  const dic = useMemo(() => dicionarioDeItens(itensDaResposta(r)), [r]);
  const html = useMemo(() => realcarMencoes(realcarCitacoes(markdownParaHtml(r.texto), fontes), dic), [r.texto, fontes, dic]);
  const invalidas = useMemo(() => citacoesInvalidas(r.texto, fontes.length), [r.texto, fontes.length]);
  const abrirFonte = (f: Fonte) => abrirNoMotor(indice, 'Documento', f.titulo, f.url);

  const clique = (e: MouseEvent<HTMLDivElement>) => {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-fonte],[data-mencao]');
    if (!alvo) return;
    const { fonte, mencao, nome } = alvo.dataset;
    if (fonte) { const f = fontes.find((x) => x.numero === Number(fonte)); if (f) abrirFonte(f); }
    else if (mencao === 'Pessoa' && nome) abrirNoMotor(indice, 'Pessoa', nome);
  };

  return <div className="space-y-2">
    <Balao papel="user">{r.pergunta}</Balao>
    <Balao papel="assistant">
      {/* O HTML vem de `markdownParaHtml`, que escapa o texto do modelo antes de marcar. */}
      <div className="markdown" onClick={clique} dangerouslySetInnerHTML={{ __html: html }} />
      {invalidas.length > 0 && <p className="erro mt-2 text-xs">A resposta cita {invalidas.map((n) => `[${n}]`).join(', ')}, que não existe entre as fontes consultadas. Desconsidere essas citações.</p>}
      {fontes.length > 0 && <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-slate-300">Fontes consultadas ({fontes.length} de {r.panorama?.obras.toLocaleString('pt-BR')} obras encontradas)</summary>
        <ol className="mt-2 space-y-1">
          {fontes.map((f) => <li key={f.numero} className="flex gap-1">
            <button type="button" className="text-left text-eco-accent underline" onClick={() => abrirFonte(f)}>[{f.numero}] {f.titulo}</button>
            <span className="shrink-0 text-slate-400">· {f.ano ?? 'sem ano'} · {f.colecao}</span>
            {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Fonte original, em nova aba">↗<span className="sr-only"> (abre a fonte original)</span></a>}
          </li>)}
        </ol>
      </details>}
      <ComoApurei resposta={r} />
    </Balao>
  </div>;
}

function ComoApurei({ resposta: r }: { resposta: RespostaAcervo }) {
  if (!r.plano || r.plano.tipo === 'conversa' || r.plano.tipo === 'fora') return null;
  const colunas = r.dados?.linhas[0] ? Object.keys(r.dados.linhas[0]) : [];
  return <div className="mt-2 text-xs">
    <Expander titulo="Como apurei" persistir={false}>
      <div className="space-y-2 text-slate-300">
        {r.planoImprovisado && <p>O modelo não devolveu um plano legível; a pergunta inteira foi buscada como tema.</p>}
        {r.plano.grupos && <p>Busca de tema: {r.plano.grupos.map((g) => `(${g.join(' ou ')})`).join(' e ')}
          {r.plano.colecao ? ` · coleção "${r.plano.colecao}"` : ''}{r.plano.ano_min ? ` · desde ${r.plano.ano_min}` : ''}{r.plano.ano_max ? ` · até ${r.plano.ano_max}` : ''}.
          {r.panorama && ` ${r.panorama.obras.toLocaleString('pt-BR')} obras encontradas no título, resumo ou palavras-chave; ${(r.panorama.amostra ?? []).length} foram lidas, com cota por coleção.`}</p>}
        {r.erroPanorama && <p className="erro">A busca do tema falhou: {r.erroPanorama}</p>}
        {r.dados && <>
          <p>Consulta executada no índice, somente leitura ({r.dados.linhas.length} linhas{r.dados.truncado ? ', truncado' : ''}):</p>
          <pre className="overflow-x-auto rounded border border-eco-border p-2"><code>{r.dados.sql}</code></pre>
          {colunas.length > 0 && <div className="eco-tabela-markdown"><table className="w-full">
            <thead><tr>{colunas.map((c) => <th key={c} className="p-1 text-left">{c}</th>)}</tr></thead>
            <tbody>{r.dados.linhas.slice(0, 20).map((l, i) => <tr key={i}>{colunas.map((c) => <td key={c} className="p-1 align-top">{typeof l[c] === 'object' ? JSON.stringify(l[c]) : String(l[c] ?? '')}</td>)}</tr>)}</tbody>
          </table></div>}
        </>}
        {r.erroSql && <p className="erro">A consulta SQL falhou: {r.erroSql}</p>}
      </div>
    </Expander>
  </div>;
}
