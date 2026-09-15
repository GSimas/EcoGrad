import { historicoEnviado, LIMITE_MENSAGEM } from '@/lib/ia-contexto';
import { baixarArquivo } from '@/lib/utils';
import { enviarMensagem, interromperConversa, limparConversa } from '@/services/chat';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bot, BotMessageSquare, KeyRound, Send, Settings, Square, User, X } from 'lucide-react';
import { Aviso, Expander } from '@/components/ui/primitives';
import { Select } from '@/components/ui/Select';
import { markdownParaHtml } from '@/lib/markdown';
import { useSessionField } from '@/hooks/useSessionField';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { esquecerChaveIA, lerConfigIA, PROVEDORES, provedorPorId, salvarConfigIA, validarConfigIA, type ConfigSalva } from '@/lib/provedores-ia';
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

/** Consultor Acadêmico IA: botão flutuante sobre as páginas da análise, com a chave do próprio usuário (BYOK). */
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
    {!painelMontado && <button ref={botaoRef} type="button" onClick={abrir} aria-label="Abrir Consultor IA" title="Consultor IA"
      className="eco-consultor-launch fixed bottom-4 right-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-eco-action px-4 text-sm font-semibold text-black shadow-xl transition hover:bg-amber-400 sm:bottom-6 sm:right-6">
      <BotMessageSquare size={20} aria-hidden /><span className="hidden sm:inline">Consultor IA</span>
      {streaming && <span className="h-2 w-2 rounded-full bg-black motion-safe:animate-pulse" aria-label="Resposta em andamento" />}
    </button>}
    {painelMontado && <section role="dialog" aria-label="Consultor IA" data-state={aberto ? 'open' : 'closed'} onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) fechar(); }}
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
  const listaRef = useRef<HTMLDivElement>(null);

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
      catalogo: docs.slice(0, 1500).map((d) => ({
        titulo: d.titulo,
        autores: d.autores,
        orientador: d.orientador,
        macrotema: d.macrotema,
        conceitos: d.palavras_chave.slice(0, 4),
        url: d.url || undefined,
      })),
    };
  }, [docs, snaGlobal, nomePrograma]);

  const provedor = config ? provedorPorId(config.provedor).nome : 'o provedor escolhido';
  const enviar = () => enviarMensagem(dossie);

  return <>
    <header className="flex shrink-0 items-center gap-2 border-b border-eco-border px-4 py-2">
      <Bot size={20} className="shrink-0 text-eco-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold">Consultor IA</h2>
        <p className="truncate text-xs text-slate-400">{configurado ? `${provedor} · ${config.modelo}` : 'Configure seu provedor para começar'}</p>
      </div>
      {configurado && <button type="button" className="btn h-11 w-11 shrink-0 px-0" aria-pressed={configurando} aria-label="Provedor e chave de API" title="Provedor e chave de API" onClick={() => setConfigurando((v) => !v)}><Settings size={18} /></button>}
      <button type="button" className="btn h-11 w-11 shrink-0 px-0" aria-label="Fechar Consultor IA" title="Fechar" onClick={onFechar}><X size={18} /></button>
    </header>

    {configurando ? (
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ConfiguracaoIA inicial={config} onSalvo={(c) => { setConfig(c); setConfigurando(false); }} onEsquecer={() => setConfig(lerConfigIA())} />
      </div>
    ) : <>
      <div ref={listaRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-xs text-slate-400">Análise de {nomePrograma}. Sugestões baseadas em um recorte de metadados; confirme títulos, fontes e relações antes de usá-las.</p>
        <Expander titulo="Contexto enviado ao Consultor IA">
          <div className="space-y-2 text-sm text-slate-300">
            <p>Ao enviar, {provedor} recebe até 20 mensagens recentes, incluindo sua pergunta atual, limitadas a 24.000 caracteres. Mensagens mais antigas continuam nesta sessão, mas podem ficar fora da solicitação. A mensagem atual admite até {LIMITE_MENSAGEM} caracteres.</p>
            <p>Catálogo: {dossie.catalogo.length} de {docs.length} registros, os primeiros na ordem da seleção. Inclui título, autores, orientador, macrotema, até quatro palavras-chave e URL. Não inclui resumo ou texto integral, notas CAPES, arquivos importados nem rascunhos não enviados.</p>
            <p>Inclui também perfis de {dossie.docentes.length} orientadores agregados sobre a seleção, até 10 nomes por grau, 10 por intermediação e 20 conceitos por grau. Centralidade não mede qualidade nem confirma vínculo docente atual. O catálogo pode conter TCCs e registros sobrepostos.</p>
            <p>Próxima solicitação: até {historicoEnviado([...mensagens, ...(parcial ? [{ role: 'assistant' as const, content: `[Resposta parcial interrompida] ${parcial}` }] : []), ...(entrada.trim() ? [{ role: 'user' as const, content: entrada.trim() }] : [])]).length} mensagens. A seleção do catálogo não é aleatória ou representativa.</p>
            <p>A conversa vai direto do navegador para {provedor}, com a sua chave; o EcoGrad não recebe nem armazena a solicitação. Repetir não duplica a pergunta e conserva o parcial anterior. Interromper encerra a leitura; o provedor pode concluir uma solicitação já recebida.</p>
          </div>
        </Expander>
        {contextoAnterior && <Aviso tipo="aviso">Esta conversa pertence a uma análise anterior e foi mantida para consulta. Copie os trechos que desejar antes de iniciar outra conversa.</Aviso>}
        {mensagens.length === 0 && !parcial && (
          <Aviso>Descreva sua ideia de projeto, pergunte sobre o perfil dos professores ou peça indicações de teses alinhadas com seu interesse de pesquisa.</Aviso>
        )}
        {(mensagens.length > 0 || parcial) && !streaming && <div className="flex flex-wrap gap-2">
          <button type="button" className="btn text-xs" onClick={() => { if (window.confirm('Limpar esta conversa e seus textos parciais? Exporte antes se desejar conservar uma cópia.')) limparConversa(); }}>Limpar conversa</button>
          <button type="button" className="btn text-xs" onClick={() => baixarArquivo(JSON.stringify({ mensagens, parcial, parciaisAnteriores, contexto }, null, 2), 'ecograd-conversa.json')}>Exportar conversa</button>
        </div>}
        {!!parciaisAnteriores?.length && <Expander titulo="Textos parciais de tentativas anteriores">{parciaisAnteriores.map((texto, i) => <Balao key={i} papel="assistant" conteudo={texto} />)}</Expander>}
        {mensagens.map((m, i) => <Balao key={i} papel={m.role} conteudo={m.content} />)}
        {parcial && <Balao papel="assistant" conteudo={streaming ? `${parcial}▌` : `[Resposta parcial interrompida] ${parcial}`} />}
        {streaming && !parcial && <p className="text-sm text-slate-400" role="status">O consultor está analisando o dossiê...</p>}
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
    </>}
  </>;
}

export function ConfiguracaoIA({ inicial, onSalvo, onEsquecer }: { inicial: ConfigSalva | null; onSalvo: (c: ConfigSalva) => void; onEsquecer: () => void }) {
  const id = useId();
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
      <input id={id + '-chave'} className="input" type="password" spellCheck={false} autoComplete="off" value={rascunho.chave} onChange={(e) => alterar({ chave: e.target.value })} />
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

function Balao({ papel, conteudo }: { papel: 'user' | 'assistant'; conteudo: string }) {
  const ehUsuario = papel === 'user';
  return (
    <div className={`flex gap-2 ${ehUsuario ? 'flex-row-reverse' : ''}`}>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          ehUsuario ? 'bg-eco-action text-black' : 'bg-eco-border text-eco-accent'
        }`}
      >
        {ehUsuario ? <User size={14} /> : <Bot size={14} />}
      </span>
      <div
        className={`markdown min-w-0 flex-1 break-words rounded-xl border border-eco-border px-3 py-2 text-sm ${
          ehUsuario ? 'bg-eco-accent/10' : 'bg-eco-panel/70'
        }`}
        // O HTML vem de `markdownParaHtml`, que escapa a resposta do modelo antes
        // de aplicar as marcações — nenhum HTML do modelo é interpretado.
        dangerouslySetInnerHTML={{ __html: markdownParaHtml(conteudo) }}
      />
    </div>
  );
}
