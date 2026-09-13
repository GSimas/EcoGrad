/**
 * Utilidades compartilhadas pelas Netlify Functions.
 * Fica em `lib/` porque a Netlify trata todo arquivo na raiz de
 * `netlify/functions/` como um endpoint publicável — este é só um módulo.
 * Porta de `gemini_utils.py` e `app_config.py` para o runtime serverless:
 * a GEMINI_API_KEY vive só aqui, nunca no bundle do cliente.
 */

export const MODELOS_TEXTO = ['gemini-2.5-flash-lite'] as const;
export const MODELOS_RAPIDOS = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'] as const;
export const MODELOS_CHAT = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const;

const BASE_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

export function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function erro(mensagem: string, status = 500): Response {
  return json({ error: mensagem }, status);
}

export function lerChaveGemini(): string | null {
  const runtime=globalThis as typeof globalThis & {Netlify?:{env:{get:(name:string)=>string|undefined}}};
  const chave = runtime.Netlify?.env.get('GEMINI_API_KEY') ?? process.env.GEMINI_API_KEY;
  return chave && chave.trim() !== '' ? chave : null;
}

export interface ConteudoGemini {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface OpcoesGeracao {
  signal?: AbortSignal;
  contents: ConteudoGemini[];
  modelos?: readonly string[];
  temperature?: number;
  systemInstruction?: string;
  responseMimeType?: string;
}

function corpoRequisicao(opcoes: OpcoesGeracao): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = { temperature: opcoes.temperature ?? 0.3 };
  if (opcoes.responseMimeType) generationConfig.responseMimeType = opcoes.responseMimeType;

  const corpo: Record<string, unknown> = { contents: opcoes.contents, generationConfig };
  if (opcoes.systemInstruction) {
    corpo.systemInstruction = { parts: [{ text: opcoes.systemInstruction }] };
  }
  return corpo;
}

/**
 * Chamada não-streaming com fallback entre modelos, equivalente ao laço
 * `for model_name in model_candidates` de `gemini_utils.generate_content`.
 */
export async function gerarConteudo(opcoes: OpcoesGeracao): Promise<string> {
  const chave = lerChaveGemini();
  if (!chave) throw new Error('GEMINI_API_KEY não configurada no ambiente da função.');

  const modelos = opcoes.modelos ?? MODELOS_TEXTO;
  let ultimoErro: Error | null = null;

  for (const modelo of modelos) {
    opcoes.signal?.throwIfAborted();
    try {
      const r = await fetch(`${BASE_GEMINI}/${modelo}:generateContent`, {
        method: 'POST',
        signal: opcoes.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(corpoRequisicao(opcoes)),
      });
      if (!r.ok) throw new Error(`${modelo}: HTTP ${r.status} — ${(await r.text()).slice(0, 300)}`);

      const dados = (await r.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const texto = dados.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if(!texto.trim()) throw new Error('O provedor retornou texto vazio.');
      return texto;
    } catch (e) {
      opcoes.signal?.throwIfAborted();
      ultimoErro = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw ultimoErro ?? new Error('Falha ao chamar a API Gemini.');
}

/**
 * Backoff exponencial — transcrição de `_chamar_gemini_com_retry` (backend.py:737):
 * tentativa 1 imediata, depois 2s e 4s.
 */
export async function gerarComRetry(
  opcoes: OpcoesGeracao,
  maxTentativas = 3,
  delayBase = 2000,
): Promise<string> {
  let ultimoErro: Error | null = null;
  for (let tentativa = 0; tentativa < maxTentativas; tentativa += 1) {
    try {
      return await gerarConteudo(opcoes);
    } catch (e) {
      opcoes.signal?.throwIfAborted();
      ultimoErro = e instanceof Error ? e : new Error(String(e));
      if (tentativa < maxTentativas - 1) {
        await esperar(delayBase * 2 ** tentativa, opcoes.signal);
      }
    }
  }
  throw ultimoErro ?? new Error('Falha ao chamar a API Gemini.');
}

/** Abre um stream SSE do Gemini e devolve a resposta bruta para repasse. */
export async function abrirStream(opcoes: OpcoesGeracao): Promise<Response> {
  const chave = lerChaveGemini();
  if (!chave) throw new Error('GEMINI_API_KEY não configurada no ambiente da função.');

  const modelos = opcoes.modelos ?? MODELOS_CHAT;
  let ultimoErro: Error | null = null;

  for (const modelo of modelos) {
    opcoes.signal?.throwIfAborted();
    try {
      const r = await fetch(`${BASE_GEMINI}/${modelo}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        signal: opcoes.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(corpoRequisicao(opcoes)),
      });
      if (!r.ok || !r.body) {
        throw new Error(`${modelo}: HTTP ${r.status} — ${(await r.text()).slice(0, 300)}`);
      }
      return r;
    } catch (e) {
      opcoes.signal?.throwIfAborted();
      ultimoErro = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw ultimoErro ?? new Error('Falha ao abrir o stream do Gemini.');
}

export function esperar(ms:number,signal?:AbortSignal):Promise<void> {
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal?.reason);};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});});
}
