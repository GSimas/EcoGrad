import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { Aviso, Card } from '@/components/ui/primitives';
import { markdownParaHtml } from '@/lib/markdown';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import type { ChatMessage, SnaGlobal } from '@/types';

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

  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [entrada, setEntrada] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [parcial, setParcial] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, parcial]);

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
      catalogo: docs.slice(0, 1500).map((d) => ({
        titulo: d.titulo,
        autores: d.autores,
        orientador: d.orientador,
        macrotema: d.macrotema,
        conceitos: d.palavras_chave,
        url: d.url || undefined,
      })),
    };
  }, [docs, snaGlobal, nomePrograma]);

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto || streaming) return;

    const historico: ChatMessage[] = [...mensagens, { role: 'user', content: texto }];
    setMensagens(historico);
    setEntrada('');
    setParcial('');
    setErro(null);
    setStreaming(true);

    try {
      const r = await fetch('/api/gemini-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: historico, dossie }),
      });

      if (!r.ok || !r.body) {
        const detalhe = await r.text().catch(() => '');
        throw new Error(detalhe || `HTTP ${r.status}`);
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acumulado = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acumulado += decoder.decode(value, { stream: true });
        setParcial(acumulado);
      }

      setMensagens([...historico, { role: 'assistant', content: acumulado }]);
      setParcial('');
    } catch (e) {
      setErro(`Erro na comunicação com a IA do Google: ${e instanceof Error ? e.message : String(e)}`);
      setParcial('');
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bot size={22} /> Consultoria Acadêmica de IA
        </h1>
        <p className="text-sm text-slate-400">
          Especialista em: {nomePrograma} · Sempre verifique as respostas, o chatbot pode ser
          impreciso.
        </p>
      </header>

      {mensagens.length === 0 && !parcial && (
        <Aviso>
          Bem-vindo! Descreva sua ideia de projeto, pergunte sobre o perfil dos professores, ou peça
          indicações de teses alinhadas com seu interesse de pesquisa.
        </Aviso>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {mensagens.map((m, i) => (
          <Balao key={i} papel={m.role} conteudo={m.content} />
        ))}
        {parcial && <Balao papel="assistant" conteudo={`${parcial}▌`} />}
        {streaming && !parcial && (
          <p className="text-sm text-slate-500">O consultor está analisando o dossiê...</p>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div ref={fimRef} />
      </div>

      <Card className="flex items-end gap-2">
        <textarea
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          rows={2}
          placeholder="Ex: Quero pesquisar sobre governança de dados na saúde. Quem seria o melhor orientador?"
          className="input min-h-[56px] resize-none"
          disabled={streaming}
        />
        <button type="button" className="btn btn-primary h-[42px]" onClick={enviar} disabled={streaming}>
          <Send size={15} /> Enviar
        </button>
      </Card>
    </div>
  );
}

function Balao({ papel, conteudo }: { papel: 'user' | 'assistant'; conteudo: string }) {
  const ehUsuario = papel === 'user';
  return (
    <div className={`flex gap-3 ${ehUsuario ? 'flex-row-reverse' : ''}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          ehUsuario ? 'bg-eco-accent text-black' : 'bg-eco-border text-eco-accent'
        }`}
      >
        {ehUsuario ? <User size={15} /> : <Bot size={15} />}
      </span>
      <div
        className={`markdown max-w-[85%] rounded-xl border border-eco-border px-4 py-3 text-sm ${
          ehUsuario ? 'bg-eco-accent/10' : 'bg-eco-panel/70'
        }`}
        // O HTML vem de `markdownParaHtml`, que escapa a resposta do modelo antes
        // de aplicar as marcações — nenhum HTML do modelo é interpretado.
        dangerouslySetInnerHTML={{ __html: markdownParaHtml(conteudo) }}
      />
    </div>
  );
}
