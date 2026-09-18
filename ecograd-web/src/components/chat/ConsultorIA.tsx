import { useQuery } from '@tanstack/react-query';
import { AberturaEmCurso, ConversaHerdada } from '@/components/chat/RespostaDoAcervo';
import { carregarIndiceBusca } from '@/lib/busca-global';
import { historicoEnviado, LIMITE_MENSAGEM } from '@/lib/ia-contexto';
import { CHAVE_CONVERSA_ACERVO, turnosHerdados } from '@/lib/ufscao-acervo';
import { baixarArquivo } from '@/lib/utils';
import { enviarMensagem, interromperConversa, limparConversa } from '@/services/chat';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Dog, Eraser, Eye, EyeOff, KeyRound, Send, Settings, Square, User, X } from 'lucide-react';
import { Confirmacao, Janela } from '@/components/layout/Janela';
import { MAX_CATALOGO, MAX_DOCENTES } from '@/lib/consultor-prompt';
import { Aviso, Expander } from '@/components/ui/primitives';
import { Select } from '@/components/ui/Select';
import { markdownParaHtml } from '@/lib/markdown';
import { dicionarioDoAcervo, realcarMencoes, type DicionarioMencoes } from '@/lib/mencoes';
import { abrirRegistro } from '@/services/abrir-item';
import type { Documento, TipoBusca } from '@/types';
import { useSessionField } from '@/hooks/useSessionField';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { ehCortesia, esquecerChaveIA, lerConfigIA, PROVEDORES, provedorPorId, salvarConfigIA, validarConfigIA, type ConfigSalva } from '@/lib/provedores-ia';
import type { DossieConsultor } from '@/lib/consultor-prompt';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import { useAparencia } from '@/services/aparencia';
import type { SnaGlobal } from '@/types';

/** Top-N nós de um tipo, ordenados por uma métrica do SNA global. */
function topPorMetrica(
  sna: SnaGlobal | null,
  tipo: string,
  metrica: 'Degree Centrality' | 'Betweenness',
  n: number,
): string[] {
  if (!sna) return [];
  return Object.entries(sna)
    .filter(([, m]) => m.Tipo === tipo)
    .sort((a, b) => (b[1][metrica] ?? 0) - (a[1][metrica] ?? 0))
    .slice(0, n)
    .map(([nome]) => nome);
}

/**
 * Retrato do UFSCão. A ilustração vive em `public/`; se ela faltar, o ícone de
 * cachorro assume — o chat não pode quebrar por causa de uma imagem.
 *
 * São dois arquivos de propósito: o avatar aparece em cada resposta, com 24 a
 * 32 px, e baixar 1,4 MB para isso pesaria em toda página com o chat aberto. A
 * arte em tamanho cheio fica para a ampliação, que é sob clique.
 */
const RETRATO = '/ufscao.png';
const RETRATO_AVATAR = '/ufscao-256.png';
export function RetratoUFSCao({ tamanho, className }: { tamanho: number; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) return <Dog size={tamanho} className={className} aria-hidden />;
  return <img src={RETRATO_AVATAR} alt="" aria-hidden width={tamanho} height={tamanho}
    className={`shrink-0 rounded-full object-cover ${className ?? ''}`} style={{ width: tamanho, height: tamanho }}
    onError={() => setFalhou(true)} />;
}

/**
 * UFSCão, o consultor de IA: botão flutuante sobre as páginas da análise, com a
 * chave do próprio usuário (BYOK). O nome é dos cães que circulam pelos campi da
 * UFSC, os UFSCães — a companhia é afetuosa, o conteúdo continua sendo saída de
 * um modelo de linguagem, e a tela diz isso em toda conversa.
 */
export function ConsultorFlutuante() {
  const [aberto, setAberto] = useSessionField('consultor.aberto', false);
  const { reduzir } = useAparencia();
  const [painelMontado, setPainelMontado] = useState(aberto);
  const streaming = useEcoGradStore((s) => s.chat.streaming);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const timerFechamento = useRef<number | null>(null);
  useEffect(() => () => { if (timerFechamento.current !== null) window.clearTimeout(timerFechamento.current); }, []);
  const abrir = () => {
    if (timerFechamento.current !== null) window.clearTimeout(timerFechamento.current);
    timerFechamento.current = null;
    setPainelMontado(true);
    setAberto(true);
  };
  const fechar = () => {
    setAberto(false);
    if (timerFechamento.current !== null) window.clearTimeout(timerFechamento.current);
    timerFechamento.current = window.setTimeout(() => {
      timerFechamento.current = null;
      setPainelMontado(false);
      requestAnimationFrame(() => botaoRef.current?.focus());
    }, reduzir ? 0 : 220);
  };
  return <>
    {!painelMontado && <button ref={botaoRef} type="button" onClick={abrir} aria-label="Abrir o UFSCão, consultor de IA" title="UFSCão · Consultor de IA"
      className="eco-consultor-launch fixed bottom-4 right-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-eco-action px-4 text-sm font-semibold text-black shadow-xl transition hover:bg-amber-400 sm:bottom-6 sm:right-6">
      <RetratoUFSCao tamanho={24} /><span className="hidden sm:inline">UFSCão</span>
      {streaming && <span className="h-2 w-2 rounded-full bg-black motion-safe:animate-pulse" aria-label="Resposta em andamento" />}
    </button>}
    {painelMontado && <section role="dialog" aria-label="UFSCão · Consultor de IA" data-state={aberto ? 'open' : 'closed'} onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) fechar(); }}
      className="eco-consultor-panel fixed inset-2 z-40 flex flex-col overflow-hidden rounded-xl border border-eco-border bg-eco-bg shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(46rem,calc(100dvh-3rem))] sm:w-[30rem]">
      <PainelConsultor onFechar={fechar} />
    </section>}
  </>;
}

function PainelConsultor({ onFechar }: { onFechar: () => void }) {
  const { docs } = useDadosDerivados();
  const snaGlobal = useEcoGradStore((s) => s.snaGlobal);
  const nomePrograma = useEcoGradStore(rotuloAnaliseAtiva);
  const { mensagens, entrada, streaming, parcial, erro, contexto, tentativa, parciaisAnteriores } = useEcoGradStore((s) => s.chat);
  const analysisId = useEcoGradStore((s) => s.analysisId);
  const contextoAnterior = !!contexto && contexto !== analysisId;
  const setEntrada = (entrada: string) => useEcoGradStore.getState().setChat({ entrada });
  const [config, setConfig] = useState(lerConfigIA);
  const configurado = !!config && !validarConfigIA(config);
  const [configurando, setConfigurando] = useState(!configurado);
  const [limpando, setLimpando] = useState(false);
  const [retrato, setRetrato] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  // O catálogo global resolve as citações da conversa herdada da tela inicial,
  // que apontam para obras do acervo inteiro e não para os `docs` carregados.
  const catalogo = useQuery({ queryKey: ['indice-busca'], queryFn: ({ signal }) => carregarIndiceBusca(signal), staleTime: Infinity, gcTime: Infinity, retry: 1 });
  // Quantos turnos da tela inicial vão junto: o painel promete o que envia, e
  // a conversa herdada mudou essa conta.
  const herdados = turnosHerdados((useEcoGradStore.getState().ui[CHAVE_CONVERSA_ACERVO] as Array<{ pergunta: string; texto: string }> | undefined) ?? []).length;

  // Acompanha a resposta só quando o leitor já está perto do fim da conversa.
  useEffect(() => {
    const el = listaRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [mensagens, parcial, streaming]);

  const dossie = useMemo<DossieConsultor>(() => {
    // Perfil dos orientadores: volume + macrotemas de especialidade
    const perfilOri = new Map<string, { total: number; temas: Set<string> }>();
    for (const d of docs) {
      if (!d.orientador) continue;
      let p = perfilOri.get(d.orientador);
      if (!p) {
        p = { total: 0, temas: new Set() };
        perfilOri.set(d.orientador, p);
      }
      p.total += 1;
      if (d.macrotema) p.temas.add(d.macrotema);
    }
    return {
      nomePrograma,
      totalDocumentos: docs.length,
      lideresVolume: topPorMetrica(snaGlobal, 'Orientador', 'Degree Centrality', 10),
      pontesInterdisciplinares: topPorMetrica(snaGlobal, 'Orientador', 'Betweenness', 10),
      principaisConceitos: topPorMetrica(snaGlobal, 'Palavra-chave', 'Degree Centrality', 20),
      docentes: [...perfilOri.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([nome, info]) => ({ nome, total: info.total, temas: [...info.temas] })),
      // Vai o recorte inteiro: quem escolhe o que cabe na mensagem é a seleção
      // por pergunta, em `promptConsultor`, e não a ordem de carregamento.
      catalogo: docs.map((d) => ({
        titulo: d.titulo,
        autores: d.autores,
        orientador: d.orientador,
        macrotema: d.macrotema,
        conceitos: d.palavras_chave.slice(0, 4),
        url: d.url || undefined,
      })),
    };
  }, [docs, snaGlobal, nomePrograma]);

  // Itens do acervo que o texto da resposta pode citar, e que viram botão nela.
  const mencoes = useMemo(() => dicionarioDoAcervo(docs), [docs]);
  const temConversa = mensagens.length > 0 || !!parcial;
  const provedor = config ? provedorPorId(config.provedor).nome : 'o provedor escolhido';
  const enviar = () => enviarMensagem(dossie);

  return <>
    <header className="flex shrink-0 items-center gap-2 border-b border-eco-border px-4 py-2">
      <button type="button" className="eco-retrato shrink-0 rounded-full" aria-label="Ver o retrato do UFSCão" title="Ver o retrato do UFSCão" onClick={() => setRetrato(true)}>
        <RetratoUFSCao tamanho={32} className="text-eco-accent" />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold">UFSCão <span className="font-normal text-slate-400">· Consultor de IA</span></h2>
        <p className="truncate text-xs text-slate-400">{!configurado ? 'Configure seu provedor para começar' : ehCortesia(config) ? 'Cortesia do EcoGrad' : `${provedor} · ${config.modelo}`}</p>
      </div>
      {temConversa && !configurando && <button type="button" className="btn h-11 w-11 shrink-0 px-0" aria-label="Limpar conversa" title="Limpar conversa" onClick={() => setLimpando(true)}><Eraser size={18} /></button>}
      {configurado && <button type="button" className="btn h-11 w-11 shrink-0 px-0" aria-pressed={configurando} aria-label="Provedor e chave de API" title="Provedor e chave de API" onClick={() => setConfigurando((v) => !v)}><Settings size={18} /></button>}
      <button type="button" className="btn h-11 w-11 shrink-0 px-0" aria-label="Fechar o UFSCão" title="Fechar" onClick={onFechar}><X size={18} /></button>
    </header>

    {configurando ? (
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ConfiguracaoIA inicial={ehCortesia(config) ? null : config} onSalvo={(c) => { setConfig(c); setConfigurando(false); }} onEsquecer={() => setConfig(lerConfigIA())} />
      </div>
    ) : <>
      <div ref={listaRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-xs text-slate-400">Análise de {nomePrograma}. Sugestões baseadas em um recorte de metadados; confirme títulos, fontes e relações antes de usá-las.</p>
        {/* Transparência de uso de IA (ISO/IEC 42001): quem conversa precisa saber que
            conversa com um modelo, o que ele pode errar e que a decisão continua humana. */}
        <Aviso tipo="aviso">
          <p><strong>O UFSCão é uma inteligência artificial</strong> — não é uma pessoa, nem uma fonte oficial da UFSC. Quem escreve as respostas é o modelo de linguagem do provedor que você configurou.</p>
          <p className="mt-2">Como toda IA generativa, <strong>ele pode errar</strong>: inventar trabalhos e nomes, atribuir orientação a quem não orientou, errar contas e afirmar com segurança o que não está nos dados. Ele enxerga um recorte parcial de metadados, sem resumo nem texto integral.</p>
          <p className="mt-2">Trate as respostas como pistas de leitura, nunca como decisão sobre orientação, ingresso ou mérito acadêmico: a última palavra é sua, depois de conferir cada título, pessoa e número nas fontes.</p>
        </Aviso>
        <Expander titulo="Contexto enviado ao UFSCão">
          <div className="space-y-2 text-sm text-slate-300">
            <p>Ao enviar, {provedor} recebe até 20 mensagens recentes, incluindo sua pergunta atual, limitadas a 24.000 caracteres. Mensagens mais antigas continuam nesta sessão, mas podem ficar fora da solicitação. A mensagem atual admite até {LIMITE_MENSAGEM} caracteres.</p>
            {herdados > 0 && <p>Vão também {herdados === 1 ? 'a última troca' : `as ${herdados} últimas trocas`} da conversa da tela inicial, que respondeu sobre o acervo inteiro — é o que faz a pergunta de seguimento ser entendida aqui. O prompt declara ao modelo que aquelas respostas cobrem outro recorte e que os números e as citações delas não valem para esta.</p>}
            <p>Catálogo: até {MAX_CATALOGO} trabalhos por pergunta, e não os {docs.length.toLocaleString('pt-BR')} registros carregados. Entram primeiro os que casam com a sua pergunta; o que sobra da cota vira amostra espaçada do restante, para o modelo ainda enxergar o conjunto. De cada um vão título, primeiro autor, orientador, macrotema, até quatro palavras-chave e URL — nunca resumo ou texto integral, notas CAPES, arquivos importados nem rascunhos não enviados.</p>
            <p>Inclui também perfis de até {MAX_DOCENTES} orientadores, escolhidos pela mesma pergunta entre os {dossie.docentes.length.toLocaleString('pt-BR')} da seleção, mais 10 nomes por grau, 10 por intermediação e 20 conceitos por grau. Centralidade não mede qualidade nem confirma vínculo docente atual. O catálogo pode conter TCCs e registros sobrepostos.</p>
            <p>Próxima solicitação: até {historicoEnviado([...mensagens, ...(parcial ? [{ role: 'assistant' as const, content: `[Resposta parcial interrompida] ${parcial}` }] : []), ...(entrada.trim() ? [{ role: 'user' as const, content: entrada.trim() }] : [])]).length} mensagens. A seleção do catálogo não é aleatória ou representativa.</p>
            <p>A conversa vai direto do navegador para {provedor}, com a sua chave; o EcoGrad não recebe nem armazena a solicitação. Repetir não duplica a pergunta e conserva o parcial anterior. Interromper encerra a leitura; o provedor pode concluir uma solicitação já recebida.</p>
          </div>
        </Expander>
        <ConversaHerdada indice={catalogo.data} />
        <AberturaEmCurso />
        {contextoAnterior && <Aviso tipo="aviso">Esta conversa pertence a uma análise anterior e foi mantida para consulta. Copie os trechos que desejar antes de iniciar outra conversa.</Aviso>}
        {mensagens.length === 0 && !parcial && (
          <Aviso>O UFSCão farejou o acervo e está pronto: descreva sua ideia de projeto, pergunte sobre o perfil dos professores ou peça indicações de teses alinhadas com seu interesse de pesquisa.</Aviso>
        )}
        {temConversa && !streaming && <div className="flex flex-wrap gap-2">
          <button type="button" className="btn text-xs" onClick={() => baixarArquivo(JSON.stringify({ mensagens, parcial, parciaisAnteriores, contexto }, null, 2), 'ecograd-conversa.json')}>Exportar conversa</button>
        </div>}
        {!!parciaisAnteriores?.length && <Expander titulo="Textos parciais de tentativas anteriores">{parciaisAnteriores.map((texto, i) => <Balao key={i} papel="assistant" conteudo={texto} dic={mencoes} docs={docs} aoAbrirRetrato={() => setRetrato(true)} />)}</Expander>}
        {mensagens.map((m, i) => <Balao key={i} papel={m.role} conteudo={m.content} dic={m.role === 'assistant' ? mencoes : undefined} docs={docs} aoAbrirRetrato={() => setRetrato(true)} />)}
        {parcial && <Balao papel="assistant" conteudo={streaming ? `${parcial}▌` : `[Resposta parcial interrompida] ${parcial}`} dic={mencoes} docs={docs} aoAbrirRetrato={() => setRetrato(true)} />}
        {streaming && !parcial && <p className="eco-farejando text-sm text-slate-400" role="status">
          <RetratoUFSCao tamanho={22} />
          <span>O UFSCão está farejando o dossiê</span>
          <span aria-hidden className="flex items-center gap-1"><span className="ponto" /><span className="ponto" /><span className="ponto" /></span>
        </p>}
        {erro && <Aviso tipo="erro"><p role="status">{erro}</p></Aviso>}
        {tentativa && !streaming && !contextoAnterior && <button type="button" className="btn" onClick={() => void enviarMensagem(dossie, true)}>Repetir última pergunta com o contexto atual</button>}
      </div>

      <div className="shrink-0 space-y-1 border-t border-eco-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void enviar();
              }
            }}
            rows={2}
            maxLength={LIMITE_MENSAGEM}
            placeholder="Ex: Quero pesquisar governança de dados na saúde. Quem poderia orientar?"
            aria-label="Mensagem para o consultor"
            className="input min-h-[56px] min-w-0 flex-1 resize-none"
            disabled={streaming || contextoAnterior}
            autoFocus
          />
          {streaming
            ? <button type="button" className="btn h-11 w-11 shrink-0 px-0" onClick={interromperConversa} aria-label="Interromper resposta" title="Interromper resposta"><Square size={16} /></button>
            : <button type="button" className="btn btn-primary h-11 w-11 shrink-0 px-0" onClick={enviar} aria-label="Enviar" title="Enviar" disabled={contextoAnterior || !entrada.trim() || entrada.length > LIMITE_MENSAGEM}><Send size={16} /></button>}
        </div>
        <p className="text-xs text-slate-400">{entrada.length}/{LIMITE_MENSAGEM} · Enter envia; Shift+Enter cria nova linha.</p>
      </div>
      <Confirmacao aberta={limpando} onOpenChange={setLimpando} rotulo="Limpar conversa" onConfirmar={limparConversa}
        titulo="Limpar esta conversa?" descricao="A conversa e os textos parciais desta sessão serão apagados. Não há como desfazer." >
        <p className="text-sm text-slate-300">Se quiser conservar uma cópia, cancele e use <strong>Exportar conversa</strong> antes.</p>
      </Confirmacao>
    </>}
    {/* Fora do ramo acima: o retrato fica no cabeçalho, que aparece também
        enquanto o formulário de chave está aberto. */}
    <Janela aberta={retrato} onOpenChange={setRetrato} titulo="UFSCão"
      descricao="O mascote do consultor de IA do EcoGrad, em homenagem aos cães que circulam pelos campi da UFSC.">
      <img src={RETRATO} alt="Ilustração do UFSCão: um cão caramelo sorridente, de coleira e bandana azuis da UFSC, com medalha do brasão da universidade." className="mx-auto max-h-[60dvh] w-auto object-contain" />
    </Janela>
  </>;
}

export function ConfiguracaoIA({ inicial, onSalvo, onEsquecer }: { inicial: ConfigSalva | null; onSalvo: (c: ConfigSalva) => void; onEsquecer: () => void }) {
  const id = useId();
  // Chave de API se digita errado com facilidade e o erro só aparece na primeira
  // pergunta, longe daqui. Ver o que foi colado é a checagem mais barata; começa
  // escondida porque a tela pode estar sendo projetada.
  const [chaveVisivel, setChaveVisivel] = useState(false);
  const [rascunho, setRascunho] = useState<ConfigSalva>(() => inicial ?? { provedor: PROVEDORES[0].id, modelo: PROVEDORES[0].modelo, baseUrl: PROVEDORES[0].baseUrl, chave: '', lembrar: false });
  const [erro, setErro] = useState<string | null>(null);
  const provedor = provedorPorId(rascunho.provedor);
  const alterar = (v: Partial<ConfigSalva>) => { setRascunho({ ...rascunho, ...v }); setErro(null); };
  // A chave de um provedor não serve para outro: trocar de provedor limpa o campo.
  const trocar = (valor: string) => { const p = provedorPorId(valor); alterar({ provedor: p.id, modelo: p.modelo, baseUrl: p.baseUrl, chave: valor === inicial?.provedor ? inicial.chave : '' }); };
  const salvar = (e: FormEvent) => {
    e.preventDefault();
    const invalida = validarConfigIA(rascunho);
    if (invalida) { setErro(invalida); return; }
    try { salvarConfigIA(rascunho); onSalvo({ ...rascunho, chave: rascunho.chave.trim(), modelo: rascunho.modelo.trim(), baseUrl: rascunho.baseUrl.trim() }); }
    catch { setErro('O navegador não permitiu salvar a configuração. Libere o armazenamento deste site e tente novamente.'); }
  };
  return <form className="space-y-4 text-sm" onSubmit={salvar}>
    <div className="space-y-1">
      <h3 className="flex items-center gap-2 font-semibold"><KeyRound size={16} aria-hidden /> Use sua própria chave de API</h3>
      <p className="text-xs leading-relaxed text-slate-300">A chave fica apenas neste navegador e vai direto para o provedor escolhido, sem passar pelos servidores do EcoGrad. O uso é cobrado pelo provedor, na sua conta.</p>
    </div>
    <div className="space-y-1"><label htmlFor={id + '-provedor'}>Provedor</label><Select id={id + '-provedor'} valor={rascunho.provedor} onChange={trocar} opcoes={PROVEDORES.map((p) => ({ valor: p.id, rotulo: p.nome }))} /></div>
    {provedor.id === 'personalizado' && <div className="space-y-1">
      <label htmlFor={id + '-url'}>URL base da API</label>
      <input id={id + '-url'} className="input" type="url" inputMode="url" spellCheck={false} placeholder="https://exemplo.com/v1" value={rascunho.baseUrl} onChange={(e) => alterar({ baseUrl: e.target.value })} />
      <p className="text-xs text-slate-400">Qualquer serviço compatível com a API de chat da OpenAI, como Together, Fireworks, Ollama ou LM Studio (HTTP apenas em localhost).</p>
    </div>}
    <div className="space-y-1">
      <label htmlFor={id + '-modelo'}>Modelo</label>
      <input id={id + '-modelo'} className="input" spellCheck={false} autoComplete="off" placeholder="identificador-do-modelo" value={rascunho.modelo} onChange={(e) => alterar({ modelo: e.target.value })} />
      <p className="text-xs text-slate-400">Use o identificador exato do modelo, como aparece no painel do provedor.</p>
    </div>
    <div className="space-y-1">
      <label htmlFor={id + '-chave'}>Chave de API</label>
      <div className="flex items-center gap-2">
        <input id={id + '-chave'} className="input min-w-0 flex-1" type={chaveVisivel ? 'text' : 'password'} spellCheck={false} autoComplete="off"
          value={rascunho.chave} onChange={(e) => alterar({ chave: e.target.value })} />
        <button type="button" className="btn h-11 w-11 shrink-0 px-0" onClick={() => setChaveVisivel((v) => !v)}
          aria-pressed={chaveVisivel} aria-controls={id + '-chave'}
          aria-label={chaveVisivel ? 'Esconder a chave de API' : 'Mostrar a chave de API'}
          title={chaveVisivel ? 'Esconder a chave' : 'Mostrar a chave'}>
          {chaveVisivel ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {provedor.chaves && <a className="inline-block min-h-11 py-2 text-xs text-eco-accent underline" href={provedor.chaves} target="_blank" rel="noopener noreferrer">Obter chave em {provedor.nome} ↗<span className="sr-only"> (nova aba)</span></a>}
    </div>
    <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-1" checked={rascunho.lembrar} onChange={(e) => alterar({ lembrar: e.target.checked })} />
      <span>Lembrar a chave neste navegador<span className="block text-xs text-slate-400">Sem essa opção, a chave é apagada ao fechar a aba. Não marque em computadores compartilhados.</span></span>
    </label>
    {erro && <p role="alert" className="erro">{erro}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" className="btn btn-primary">Salvar e conversar</button>
      {!!inicial?.chave && <button type="button" className="btn" onClick={() => { esquecerChaveIA(); onEsquecer(); alterar({ chave: '' }); }}>Esquecer chave</button>}
    </div>
    <p className="text-xs text-slate-400">Se um provedor bloquear chamadas diretas do navegador (CORS), use OpenRouter ou outro serviço compatível.</p>
  </form>;
}

/**
 * Uma fala da conversa. Na resposta do consultor, cada item do acervo citado no
 * texto — pessoa, título, palavra-chave ou macrotema — vira botão para o perfil
 * no Motor de Busca; o clique é ouvido no contêiner porque os botões nascem do
 * HTML já sanitizado, e não de JSX.
 */
function Balao({ papel, conteudo, dic, docs, aoAbrirRetrato }: { papel: 'user' | 'assistant'; conteudo: string; dic?: DicionarioMencoes; docs?: readonly Documento[]; aoAbrirRetrato?: () => void }) {
  const ehUsuario = papel === 'user';
  const html = useMemo(() => {
    const base = markdownParaHtml(conteudo);
    return dic ? realcarMencoes(base, dic) : base;
  }, [conteudo, dic]);
  const abrirMencao = (e: MouseEvent<HTMLDivElement>) => {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-mencao]');
    if (!alvo) return;
    const { mencao, nome, indice } = alvo.dataset;
    if (mencao === 'Documento' && indice !== undefined && docs) abrirRegistro(docs, Number(indice));
    else if (nome) useEcoGradStore.getState().navegarPara(mencao as TipoBusca, nome);
  };
  return (
    <div className={`flex gap-2 ${ehUsuario ? 'flex-row-reverse' : ''}`}>
      {ehUsuario
        ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-eco-action text-black"><User size={14} /></span>
        : <button type="button" className="eco-retrato flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-eco-border text-eco-accent"
          aria-label="Ver o retrato do UFSCão" title="Ver o retrato do UFSCão" onClick={aoAbrirRetrato}>
          <RetratoUFSCao tamanho={28} />
        </button>}
      <div
        className={`markdown min-w-0 flex-1 break-words rounded-xl border border-eco-border px-3 py-2 text-sm ${
          ehUsuario ? 'bg-eco-accent/10' : 'bg-eco-panel/70'
        }`}
        onClick={abrirMencao}
        // O HTML vem de `markdownParaHtml`, que escapa a resposta do modelo antes
        // de aplicar as marcações — nenhum HTML do modelo é interpretado.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
