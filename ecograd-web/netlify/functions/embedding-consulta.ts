/**
 * Vetor da pergunta para a busca por significado (ADR 004, fase B, decisão E3).
 *
 * É a única chamada a modelo com a chave do projeto que o app faz sozinho: o
 * vetor do documento foi calculado na carga, e a resposta escrita continua na
 * chave do usuário. Custa cerca de US$ 0,000004 por pergunta, e por isso as
 * travas aqui são contra abuso, não contra uso:
 *
 * - só aceita chamada vinda do próprio site (ou de `EMBEDDING_ORIGENS`);
 * - texto curto: pergunta, não documento;
 * - limite por IP por minuto.
 */
import type { Context } from '@netlify/functions';
import { erro, json, lerChaveGemini } from './lib/gemini';
import { origemAceita } from './lib/origem';

const MODELO = 'gemini-embedding-2';
const DIMENSOES = 768;
const MAX_CARACTERES = 1000;
const POR_MINUTO = 30;

// ponytail: contador em memória vale por instância da função, e instâncias
// frias recomeçam do zero. Contra abuso sério, trocar por Netlify Blobs ou pelo
// limite de taxa do próprio Netlify.
const chamadas = new Map<string, number[]>();

function permitida(ip: string) {
  const agora = Date.now();
  const recentes = (chamadas.get(ip) ?? []).filter((t) => agora - t < 60000);
  if (recentes.length >= POR_MINUTO) return false;
  recentes.push(agora);
  chamadas.set(ip, recentes);
  if (chamadas.size > 5000) chamadas.clear();
  return true;
}

export default async (req: Request, context: Context): Promise<Response> => {
  if (req.method !== 'POST') return erro('Use POST.', 405);
  if (!origemAceita(req)) return erro('Origem não autorizada.', 403);
  if (!permitida(context.ip ?? 'desconhecido')) return erro('Muitas perguntas em pouco tempo. Tente de novo em um minuto.', 429);

  const chave = lerChaveGemini();
  if (!chave) return erro('Busca por significado indisponível: chave do projeto não configurada.', 503);

  let texto: unknown;
  try { ({ texto } = await req.json() as { texto?: unknown }); } catch { return erro('Corpo inválido (JSON esperado).', 400); }
  if (typeof texto !== 'string' || !texto.trim()) return erro('Informe `texto`.', 400);

  try {
    const pedir = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:embedContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
      // Formato de consulta da documentação do modelo, par do "title: … | text: …" dos documentos.
      body: JSON.stringify({ content: { parts: [{ text: `task: search result | query: ${texto.trim().slice(0, MAX_CARACTERES)}` }] }, output_dimensionality: DIMENSOES }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(10000)]),
    });
    let r = await pedir();
    // Cota por minuto da chave compartilhada: uma espera curta costuma bastar.
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500)); r = await pedir(); }
    if (!r.ok) return erro(`O modelo de embedding respondeu HTTP ${r.status}.`, 502);
    const { embedding } = await r.json() as { embedding?: { values?: number[] } };
    if (embedding?.values?.length !== DIMENSOES) return erro('Vetor com dimensão inesperada.', 502);
    return json({ modelo: MODELO, vetor: embedding.values });
  } catch {
    return erro('Não foi possível calcular o vetor da pergunta.', 502);
  }
};
