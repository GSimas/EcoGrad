import { historicoEnviado, LIMITE_MENSAGEM } from '@/lib/ia-contexto';
import { baixarArquivo } from '@/lib/utils';
import { enviarMensagem, interromperConversa, limparConversa } from '@/services/chat';
import { useEffect, useMemo, useRef } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { Aviso, Card, Expander } from '@/components/ui/primitives';
import { markdownParaHtml } from '@/lib/markdown';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
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
 * Consultor Acadêmico IA.
 * O dossiê institucional (líderes de rede, especialidades docentes e catálogo
 * com links) é montado aqui e enviado à Netlify Function, que injeta tudo no
 * system prompt e devolve a resposta em streaming.
 */
export function ConsultorIA() {
  const { docs } = useDadosDerivados();
  const snaGlobal = useEcoGradStore((s) => s.snaGlobal);
  const nomePrograma = useEcoGradStore(rotuloAnaliseAtiva);

  const { mensagens, entrada, streaming, parcial, erro, contexto, tentativa, parciaisAnteriores } = useEcoGradStore((s) => s.chat);
  const analysisId = useEcoGradStore((s) => s.analysisId);
  const contextoAnterior = !!contexto && contexto !== analysisId;
  const setEntrada = (entrada: string) => useEcoGradStore.getState().setChat({ entrada });
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Do not pull readers away from the context or the interruption control.
    if (streaming && fimRef.current && fimRef.current.getBoundingClientRect().top < innerHeight + 120) fimRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }, [mensagens, parcial, streaming]);

  const dossie = useMemo(() => {
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
      cobertura: { catalogo: Math.min(docs.length,1500), criterio: "Primeiros 1500 registros na ordem da seleção; sem resumos ou texto integral. Não é amostragem aleatória nem representativa." },
      catalogo: docs.slice(0, 1500).map((d) => ({
        titulo: d.titulo,
        autores: d.autores,
        orientador: d.orientador,
        macrotema: d.macrotema,
        conceitos: d.palavras_chave.slice(0,4),
        url: d.url || undefined,
      })),
    };
  }, [docs, snaGlobal, nomePrograma]);

  const enviar = () => enviarMensagem(dossie);

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bot size={22} /> Consultoria Acadêmica de IA
        </h1>
        <p className="text-sm text-slate-400">
          Análise de {nomePrograma}. Sugestões baseadas em um recorte de metadados; confirme títulos, fontes e relações antes de usá-las.
        </p>
      </header>

      <Expander titulo="Contexto enviado ao Consultor IA">
        <div className="space-y-2 text-sm text-slate-300">
          <p>Ao enviar, o Google Gemini recebe até 20 mensagens recentes, incluindo sua pergunta atual, limitadas a 24.000 caracteres. Mensagens mais antigas continuam nesta sessão, mas podem ficar fora da solicitação. A mensagem atual admite até {LIMITE_MENSAGEM} caracteres.</p>
          <p>Catálogo: {dossie.catalogo.length} de {docs.length} registros, os primeiros na ordem da seleção. Inclui título, autores, orientador, macrotema, até quatro palavras-chave e URL. Não inclui resumo ou texto integral, notas CAPES, arquivos importados nem rascunhos não enviados.</p>
          <p>Inclui também perfis de {dossie.docentes.length} orientadores agregados sobre a seleção, até 10 nomes por grau, 10 por intermediação e 20 conceitos por grau. Centralidade não mede qualidade nem confirma vínculo docente atual. O catálogo pode conter TCCs e registros sobrepostos.</p>
          <p>Próxima solicitação: até {historicoEnviado([...mensagens, ...(parcial?[{role:'assistant' as const,content:`[Resposta parcial interrompida] ${parcial}`}]:[]), ...(entrada.trim()?[{role:'user' as const,content:entrada.trim()}]:[])]).length} mensagens. A seleção do catálogo não é aleatória ou representativa. O contexto excessivo é recusado pelo serviço, sem corte oculto adicional.</p>
        </div>
      </Expander>
      {contextoAnterior && <Aviso tipo="aviso">Esta conversa pertence a uma análise anterior e foi mantida para consulta. Copie os trechos que desejar antes de iniciar outra conversa.</Aviso>}
      {(mensagens.length > 0 || parcial) && !streaming && <button type="button" className="btn self-start" onClick={()=>{if(window.confirm("Limpar esta conversa e seus textos parciais? Exporte antes se desejar conservar uma cópia."))limparConversa();}}>Limpar histórico e iniciar outra conversa</button>}
      {mensagens.length === 0 && !parcial && (
        <Aviso>
          Bem-vindo! Descreva sua ideia de projeto, pergunte sobre o perfil dos professores, ou peça
          indicações de teses alinhadas com seu interesse de pesquisa.
        </Aviso>
      )}

      {(mensagens.length>0||parcial) && <button type="button" className="btn self-start" onClick={()=>baixarArquivo(JSON.stringify({mensagens,parcial,parciaisAnteriores,contexto},null,2),'ecograd-conversa.json')}>Exportar conversa e textos parciais</button>}
      {!!parciaisAnteriores?.length && <Expander titulo="Textos parciais de tentativas anteriores">{parciaisAnteriores.map((texto,i)=><Balao key={i} papel="assistant" conteudo={texto}/>)}</Expander>}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {mensagens.map((m, i) => (
          <Balao key={i} papel={m.role} conteudo={m.content} />
        ))}
        {parcial && <Balao papel="assistant" conteudo={streaming ? `${parcial}▌` : `[Resposta parcial interrompida] ${parcial}`} />}
        {streaming && !parcial && (
          <p className="text-sm text-slate-500">O consultor está analisando o dossiê...</p>
        )}
        {erro && <Aviso tipo="erro"><p role="status">{erro}</p></Aviso>}
        {tentativa && !streaming && !contextoAnterior && <button type="button" className="btn" onClick={()=>void enviarMensagem(dossie,true)}>Repetir última pergunta com o contexto atual</button>}
        <div ref={fimRef} />
      </div>

      <Card className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
        <textarea
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void enviar();
            }
          }}
          rows={3}
          maxLength={LIMITE_MENSAGEM}
          placeholder="Ex: Quero pesquisar sobre governança de dados na saúde. Quem seria o melhor orientador?"
          aria-label="Mensagem para o consultor"
          className="input min-w-0 min-h-[56px] resize-none"
          disabled={streaming || contextoAnterior}
        />
        <button type="button" className="btn btn-primary min-h-11 shrink-0 whitespace-nowrap" onClick={enviar} disabled={streaming || contextoAnterior || !entrada.trim() || entrada.length>LIMITE_MENSAGEM}>
          <Send size={15} /> Enviar
        </button>
        {streaming && <button type="button" className="btn" onClick={interromperConversa}>Interromper resposta</button>}
      </Card>
      <p className="text-xs text-slate-400">{entrada.length}/{LIMITE_MENSAGEM} caracteres · Enter envia; Shift+Enter cria nova linha. Repetir não duplica a pergunta e conserva o parcial anterior. Interromper encerra a leitura; o provedor pode concluir uma solicitação já recebida.</p>
    </div>
  );
}

function Balao({ papel, conteudo }: { papel: 'user' | 'assistant'; conteudo: string }) {
  const ehUsuario = papel === 'user';
  return (
    <div className={`flex gap-3 ${ehUsuario ? 'flex-row-reverse' : ''}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          ehUsuario ? 'bg-eco-action text-black' : 'bg-eco-border text-eco-accent'
        }`}
      >
        {ehUsuario ? <User size={15} /> : <Bot size={15} />}
      </span>
      <div
        className={`markdown min-w-0 flex-1 break-words rounded-xl border border-eco-border px-4 py-3 text-sm ${
          ehUsuario ? 'bg-eco-accent/10' : 'bg-eco-panel/70'
        }`}
        // O HTML vem de `markdownParaHtml`, que escapa a resposta do modelo antes
        // de aplicar as marcações — nenhum HTML do modelo é interpretado.
        dangerouslySetInnerHTML={{ __html: markdownParaHtml(conteudo) }}
      />
    </div>
  );
}
