/**
 * UFSCão de cortesia: 10 perguntas por IP, para conhecer sem chave própria.
 *
 * É a segunda chamada a modelo com a chave do projeto — a primeira é
 * `embedding-consulta` — e a única que escreve texto. Depois das 10, o usuário
 * traz a chave dele e nada aqui é usado; o BYOK da decisão D10 do ADR 001
 * continua sendo o caminho normal, e a cortesia é só a porta de entrada.
 *
 * Custo medido no prompt real: ~9.600 tokens de entrada e ~470 de saída por
 * pergunta, em duas chamadas. Fora do pico da DeepSeek — que no horário de
 * Brasília é madrugada — dá cerca de US$ 0,001 por pergunta.
 *
 * Três travas, em camadas diferentes:
 * - cota vitalícia por IP (`cota-cortesia.ts`), que dá justiça;
 * - teto global do projeto, que é o que garante o orçamento;
 * - caps de etapa, de tamanho e de saída, que limitam o estrago de quem tentar
 *   usar o endpoint como proxy de LLM.
 */
import type { Context } from '@netlify/functions';
import { erro, json } from './lib/gemini';
import { origemAceita } from './lib/origem';
import { PERSONA_UFSCAO } from '../../src/lib/guardrails';
import {
  CHAMADAS_POR_PERGUNTA, CHAVE_GLOBAL, PERGUNTAS_POR_IP,
  duravel, idDoIp, lerCota, somarCota, tetoPerguntas,
} from './lib/cota-cortesia';

const MODELO = 'deepseek-flash';
const URL_MODELO = 'https://api.deepseek.com/v1/chat/completions';

/** Uma síntese de 250 palavras não chega perto disso; o teto é contra saída descontrolada. */
const MAX_TOKENS = 900;
/**
 * Folga sobre o maior pedido legítimo. O planejamento manda ~21 mil caracteres
 * (regras, dicionário das 16 views, exemplos); a resposta pode chegar perto de
 * 36 mil no pior caso — guardrails, até 12 mil de linhas de SQL e 20 obras da
 * amostra com trecho. Quem barra aprofundar é a lista de etapas, não este
 * número: aqui ele é só o limite de payload.
 */
const MAX_CARACTERES = 45000;

/** Abertura de `promptPlanejamento`. Copiada, e `ia-cortesia.test.ts` monta o prompt real e confere. */
const ABERTURA_PLANEJAMENTO = 'Você planeja como responder perguntas sobre o acervo do EcoGrad';

/**
 * Só as etapas da pergunta padrão, e cada uma tem de começar pelo prompt do
 * app. Não é barreira contra quem insiste — é o que impede o endpoint de virar
 * um assistente genérico de graça. Aprofundar fica de fora de propósito: lê até
 * 400 resumos, ~US$ 0,05 num clique, e continua na chave de quem pede.
 *
 * A resposta confere contra a persona de verdade, importada de `guardrails.ts`
 * (modulo sem nenhum import, entao nada mais entra no pacote da funcao). Fixar
 * a frase a mao ja custou caro uma vez: `promptResposta` comeca pela persona, e
 * nao pela abertura de `sistemaSintese`, que so o aprofundar usa.
 */
const ETAPAS: Record<string, string> = {
  planejar: ABERTURA_PLANEJAMENTO,
  corrigir: ABERTURA_PLANEJAMENTO,
  responder: PERSONA_UFSCAO,
};

const ESGOTADA = `Suas ${PERGUNTAS_POR_IP} perguntas de cortesia acabaram. Configure seu provedor de IA para continuar conversando com o UFSCão.`;
const SEM_TETO = 'A cota de cortesia do EcoGrad se esgotou. Configure seu provedor de IA para conversar com o UFSCão.';

const lerChave = () => {
  const runtime = globalThis as typeof globalThis & { Netlify?: { env: { get: (n: string) => string | undefined } } };
  const chave = runtime.Netlify?.env.get('DEEPSEEK_API_KEY') ?? process.env.DEEPSEEK_API_KEY;
  return chave && chave.trim() !== '' ? chave.trim() : null;
};

export default async (req: Request, context: Context): Promise<Response> => {
  if (!origemAceita(req)) return erro('Origem não autorizada.', 403);
  const chave = lerChave();
  const id = idDoIp(context.ip ?? 'desconhecido');

  // A tela pergunta quantas restam antes de oferecer o botão; consultar não gasta.
  if (req.method === 'GET') {
    const [meu, total] = await Promise.all([lerCota(id), lerCota(CHAVE_GLOBAL)]);
    return json({
      disponivel: !!chave && total.p < tetoPerguntas() && await duravel(),
      restantes: Math.max(0, PERGUNTAS_POR_IP - meu.p),
      total: PERGUNTAS_POR_IP,
    });
  }
  if (req.method !== 'POST') return erro('Use POST.', 405);
  if (!chave) return erro('A cortesia não está configurada neste ambiente.', 503);
  // Sem armazenamento durável não há teto que se sustente entre instâncias: sem
  // isso a cortesia é um cheque em branco, então ela simplesmente não abre.
  if (!await duravel()) return erro('A cortesia está indisponível agora.', 503);

  let corpo: { etapa?: unknown; sistema?: unknown; mensagem?: unknown };
  try { corpo = await req.json() as typeof corpo; } catch { return erro('Corpo inválido (JSON esperado).', 400); }

  const { etapa, sistema, mensagem } = corpo;
  if (typeof etapa !== 'string' || !(etapa in ETAPAS)) {
    return erro('A cortesia responde perguntas do UFSCão. Aprofundar a leitura exige seu provedor de IA.', 403);
  }
  if (typeof sistema !== 'string' || typeof mensagem !== 'string' || !mensagem.trim()) return erro('Informe `sistema` e `mensagem`.', 400);
  if (!sistema.startsWith(ETAPAS[etapa])) return erro('Pedido fora do formato do UFSCão.', 403);
  if (sistema.length + mensagem.length > MAX_CARACTERES) return erro('Pedido grande demais para a cortesia.', 413);

  const pergunta = etapa === 'planejar';
  const [meu, total] = await Promise.all([lerCota(id), lerCota(CHAVE_GLOBAL)]);
  if (total.p >= tetoPerguntas()) return erro(SEM_TETO, 503);
  // O teto de perguntas vale ao começar uma: a décima pergunta ainda precisa
  // consultar e responder, e recusar no meio deixaria a última sem resposta. O
  // teto de chamadas é que impede qualquer etapa de virar torneira.
  if (pergunta && meu.p >= PERGUNTAS_POR_IP) return erro(ESGOTADA, 429);
  if (meu.c >= PERGUNTAS_POR_IP * CHAMADAS_POR_PERGUNTA) return erro(ESGOTADA, 429);

  let r: Response;
  try {
    r = await fetch(URL_MODELO, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: MODELO,
        stream: true,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        // O thinking vem ligado por padrão no deepseek-flash, com esforço alto, e
        // o raciocínio é cobrado como saída: desligar é o que mantém a conta de pé.
        thinking: { type: 'disabled' },
        messages: [{ role: 'system', content: sistema }, { role: 'user', content: mensagem }],
      }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(55000)]),
    });
  } catch {
    return erro('Não foi possível falar com o modelo de cortesia.', 502);
  }
  if (!r.ok || !r.body) return erro(`O modelo de cortesia respondeu HTTP ${r.status}.`, 502);

  // Só conta o que o modelo aceitou: erro do provedor não gasta a cota de ninguém.
  await Promise.all([somarCota(id, pergunta), somarCota(CHAVE_GLOBAL, pergunta)]);

  return new Response(r.body, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-cortesia-restantes': String(Math.max(0, PERGUNTAS_POR_IP - meu.p - (pergunta ? 1 : 0))) },
  });
};
