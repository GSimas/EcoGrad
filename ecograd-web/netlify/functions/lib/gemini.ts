/**
 * Utilidades compartilhadas pelas Netlify Functions.
 * Fica em `lib/` porque a Netlify trata todo arquivo na raiz de
 * `netlify/functions/` como um endpoint publicável — este é só um módulo.
 * Porta de `gemini_utils.py` e `app_config.py` para o runtime serverless.
 *
 * O texto (síntese e ontologia) sai pela DeepSeek, com a DEEPSEEK_API_KEY. A
 * GEMINI_API_KEY fica só para o vetor da pergunta (`embedding-consulta`): os
 * vetores do índice foram calculados com o `gemini-embedding-2`, e a DeepSeek
 * não tem API de embeddings. Nenhuma das duas chaves entra no bundle do cliente.
 */

export const MODELOS_TEXTO = ['deepseek-flash'] as const;
export const MODELOS_RAPIDOS = ['deepseek-flash'] as const;

const URL_DEEPSEEK = 'https://api.deepseek.com/v1/chat/completions';

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

function lerEnv(nome: string): string | null {
  const runtime=globalThis as typeof globalThis & {Netlify?:{env:{get:(name:string)=>string|undefined}}};
  const chave = runtime.Netlify?.env.get(nome) ?? process.env[nome];
  return chave && chave.trim() !== '' ? chave.trim() : null;
}

/** Só o embedding da pergunta ainda usa o Gemini. */
export const lerChaveGemini = () => lerEnv('GEMINI_API_KEY');
export const lerChaveDeepseek = () => lerEnv('DEEPSEEK_API_KEY');

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

function corpoRequisicao(modelo: string, opcoes: OpcoesGeracao): Record<string, unknown> {
  const messages = [
    ...(opcoes.systemInstruction ? [{ role: 'system', content: opcoes.systemInstruction }] : []),
    ...opcoes.contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map((p) => p.text).join('') })),
  ];
  return {
    model: modelo,
    messages,
    temperature: opcoes.temperature ?? 0.3,
    // O thinking vem ligado por padrão no deepseek-flash, e o raciocínio é cobrado como saída.
    thinking: { type: 'disabled' },
    ...(opcoes.responseMimeType === 'application/json' ? { response_format: { type: 'json_object' } } : {}),
  };
}

/**
 * Chamada não-streaming com fallback entre modelos, equivalente ao laço
 * `for model_name in model_candidates` de `gemini_utils.generate_content`.
 */
export async function gerarConteudo(opcoes: OpcoesGeracao): Promise<string> {
  const chave = lerChaveDeepseek();
  if (!chave) throw new Error('DEEPSEEK_API_KEY não configurada no ambiente da função.');

  const modelos = opcoes.modelos ?? MODELOS_TEXTO;
  let ultimoErro: Error | null = null;

  for (const modelo of modelos) {
    opcoes.signal?.throwIfAborted();
    try {
      const r = await fetch(URL_DEEPSEEK, {
        method: 'POST',
        signal: opcoes.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
        body: JSON.stringify(corpoRequisicao(modelo, opcoes)),
      });
      if (!r.ok) throw new Error(`${modelo}: HTTP ${r.status} — ${(await r.text()).slice(0, 300)}`);

      const dados = (await r.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
      const texto = dados.choices?.[0]?.message?.content ?? '';
      if(!texto.trim()) throw new Error('O provedor retornou texto vazio.');
      return texto;
    } catch (e) {
      opcoes.signal?.throwIfAborted();
      ultimoErro = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw ultimoErro ?? new Error('Falha ao chamar a API DeepSeek.');
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
  throw ultimoErro ?? new Error('Falha ao chamar a API DeepSeek.');
}

export function esperar(ms:number,signal?:AbortSignal):Promise<void> {
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal?.reason);};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});});
}
