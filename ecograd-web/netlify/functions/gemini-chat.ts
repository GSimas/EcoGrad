/**
 * Consultor Acadêmico IA com streaming.
 * Transcrição do system prompt e do dossiê de `pages/2_Chat.py`.
 *
 * O dossiê institucional (líderes de rede, especialidades docentes e catálogo
 * com LINKs) é montado aqui, no servidor, a partir do resumo enviado pelo cliente —
 * assim o prompt completo nunca precisa trafegar duas vezes nem ficar exposto.
 */
import { abrirStream, erro, lerChaveGemini, MODELOS_CHAT } from './lib/gemini';

interface DocenteResumo {
  nome: string;
  total: number;
  temas: string[];
}

interface ItemCatalogo {
  titulo: string;
  autores: string[];
  orientador: string;
  macrotema: string;
  conceitos: string[];
  url?: string;
}

interface DossiePayload {
  nomePrograma: string;
  totalDocumentos: number;
  /** Top-10 orientadores por Degree Centrality. */
  lideresVolume: string[];
  /** Top-10 orientadores por Betweenness Centrality. */
  pontesInterdisciplinares: string[];
  /** Top-20 conceitos por Degree Centrality. */
  principaisConceitos: string[];
  docentes: DocenteResumo[];
  catalogo: ItemCatalogo[];
}

interface Payload {
  mensagens?: Array<{ role: 'user' | 'assistant'; content: string }>;
  dossie?: DossiePayload;
}

/** Teto de itens do catálogo, igual ao `dados[:1500]` do Streamlit. */
const MAX_CATALOGO = 1500;

function montarDossie(d: DossiePayload): string {
  let ctx = `=== DOSSIÊ INSTITUCIONAL: ${d.nomePrograma.toUpperCase()} ===\n`;
  ctx += `Total de Trabalhos Publicados: ${d.totalDocumentos}\n`;
  ctx += `Corpo Docente (Orientadores Ativos): ${d.docentes.length}\n\n`;

  ctx += '--- MÉTRICAS DE REDE (SNA) ---\n';
  ctx += `Líderes em Volume de Orientação (Degree Centrality): ${d.lideresVolume.join(', ')}\n`;
  ctx += `Pontes Interdisciplinares (Betweenness Centrality - Conectam diferentes áreas): ${d.pontesInterdisciplinares.join(', ')}\n`;
  ctx += `Principais Conceitos Pesquisados: ${d.principaisConceitos.join(', ')}\n\n`;

  ctx += '--- PERFIL DE ORIENTAÇÃO (MAPA DE ESPECIALISTAS) ---\n';
  for (const doc of d.docentes) {
    ctx += `- ${doc.nome} | Orientou: ${doc.total} trabalhos | Especialidades: [${doc.temas.join(', ')}]\n`;
  }

  ctx += '\n--- CATÁLOGO DE TESES E DISSERTAÇÕES (BASE PARA RECOMENDAÇÃO) ---\n';
  for (const item of d.catalogo.slice(0, MAX_CATALOGO)) {
    const pks = item.conceitos.slice(0, 4).join(', ');
    const linkInfo = item.url ? ` | LINK: ${item.url}` : '';
    ctx += `TÍTULO: ${item.titulo} | AUTOR: ${item.autores.join(', ')} | ORIENTADOR: ${item.orientador} | TEMA: ${item.macrotema} | CONCEITOS: ${pks}${linkInfo}\n`;
  }

  return ctx;
}

function montarSystemPrompt(nomePrograma: string, dossie: string): string {
  return `
Você é o Consultor Acadêmico e Analista de Inteligência de Redes especializado no(s) programa(s): ${nomePrograma} da Universidade Federal de Santa Catarina (UFSC).

Seu cérebro foi carregado com a taxonomia completa, estatísticas de rede e o catálogo de produções deste ecossistema.

SUA MISSÃO:
1. Auxiliar futuros mestrandos e doutorandos a refinarem suas propostas de pesquisa.
2. Recomendar o melhor Orientador(a) ou Co-orientador(a) com base na ideia do candidato, cruzando a ideia dele com as 'Especialidades' dos professores listados.
3. Sugerir teses/dissertações anteriores para o aluno ler e se inspirar. SEMPRE que recomendar um trabalho que possua um LINK no catálogo, você DEVE formatar o título como um hiperlink Markdown clicável. Exemplo: [Título da Tese](https://link-da-tese.ufsc.br).
4. Explicar a dinâmica da rede do programa (quem são os líderes de pesquisa, quem atua como ponte interdisciplinar).

REGRAS DE CONDUTA:
- Seja acolhedor, altamente profissional e acadêmico.
- Baseie suas recomendações EXCLUSIVAMENTE nos dados fornecidos no Dossiê abaixo.
- Use a sintaxe Markdown para criar hiperlinks nos títulos dos documentos recomendados.
- Se a ideia de projeto do candidato fugir completamente do escopo do programa, seja honesto e diga que o programa pode não ser o melhor encaixe, ou sugira uma adaptação para os 'Principais Conceitos Pesquisados'.

DOSSIÊ DE CONHECIMENTO (BASE DE DADOS):
${dossie}
`;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return erro('Use POST.', 405);
  if (!lerChaveGemini()) {
    return erro('GEMINI_API_KEY não encontrada nas variáveis de ambiente da Netlify.', 503);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return erro('Corpo da requisição inválido (JSON esperado).', 400);
  }

  const mensagens = payload.mensagens ?? [];
  const dossiePayload = payload.dossie;
  if (mensagens.length === 0 || !dossiePayload) {
    return erro('Informe `mensagens` e `dossie`.', 400);
  }

  const systemPrompt = montarSystemPrompt(dossiePayload.nomePrograma, montarDossie(dossiePayload));

  const contents = mensagens.map((m) => ({
    role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
    parts: [{ text: m.content }],
  }));

  let upstream: Response;
  try {
    upstream = await abrirStream({
      contents,
      modelos: MODELOS_CHAT,
      temperature: 0.3,
      systemInstruction: systemPrompt,
    });
  } catch (e) {
    return erro(`Erro na comunicação com a IA do Google: ${e instanceof Error ? e.message : String(e)}`, 502);
  }

  // Converte o SSE do Gemini em texto puro, que o cliente lê incrementalmente
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const linhas = buffer.split('\n');
          buffer = linhas.pop() ?? '';

          for (const linha of linhas) {
            if (!linha.startsWith('data:')) continue;
            const bruto = linha.slice(5).trim();
            if (!bruto || bruto === '[DONE]') continue;
            try {
              const evento = JSON.parse(bruto) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
              };
              const texto = evento.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
              if (texto) controller.enqueue(encoder.encode(texto));
            } catch {
              // Fragmento SSE incompleto — ignora e aguarda o próximo chunk
            }
          }
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(`\n\n_Erro durante o streaming: ${e instanceof Error ? e.message : String(e)}_`),
        );
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
