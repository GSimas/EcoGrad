import type { ChatMessage } from '../types';

export type FormatoApi = 'openai' | 'anthropic' | 'google';
export interface Provedor { id: string; nome: string; formato: FormatoApi; baseUrl: string; modelo: string; chaves: string }
export interface ConfigIA { provedor: string; modelo: string; baseUrl: string; chave: string }

/** Pontos de partida editáveis: o nome do modelo pode mudar no provedor sem nova versão do EcoGrad. */
export const PROVEDORES: readonly Provedor[] = [
  { id: 'openai', nome: 'OpenAI', formato: 'openai', baseUrl: 'https://api.openai.com/v1', modelo: 'gpt-5-mini', chaves: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', nome: 'Anthropic', formato: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', modelo: 'claude-opus-5', chaves: 'https://console.anthropic.com/settings/keys' },
  { id: 'google', nome: 'Google Gemini', formato: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', modelo: 'gemini-2.5-flash', chaves: 'https://aistudio.google.com/apikey' },
  { id: 'openrouter', nome: 'OpenRouter', formato: 'openai', baseUrl: 'https://openrouter.ai/api/v1', modelo: 'openrouter/auto', chaves: 'https://openrouter.ai/keys' },
  { id: 'groq', nome: 'Groq', formato: 'openai', baseUrl: 'https://api.groq.com/openai/v1', modelo: 'llama-3.3-70b-versatile', chaves: 'https://console.groq.com/keys' },
  { id: 'mistral', nome: 'Mistral', formato: 'openai', baseUrl: 'https://api.mistral.ai/v1', modelo: 'mistral-large-latest', chaves: 'https://console.mistral.ai/api-keys' },
  { id: 'deepseek', nome: 'DeepSeek', formato: 'openai', baseUrl: 'https://api.deepseek.com/v1', modelo: 'deepseek-chat', chaves: 'https://platform.deepseek.com/api_keys' },
  { id: 'xai', nome: 'xAI (Grok)', formato: 'openai', baseUrl: 'https://api.x.ai/v1', modelo: 'grok-4', chaves: 'https://console.x.ai' },
  { id: 'personalizado', nome: 'Outro compatível com OpenAI', formato: 'openai', baseUrl: '', modelo: '', chaves: '' },
];
export const provedorPorId = (id: string) => PROVEDORES.find((p) => p.id === id) ?? PROVEDORES[PROVEDORES.length - 1];

// Modelos que aceitam o fallback automático do servidor quando o classificador recusa a solicitação.
const FALLBACK_ANTHROPIC = new Set(['claude-opus-5', 'claude-fable-5-1']);

export function validarConfigIA(c: ConfigIA): string | null {
  if (!c.chave.trim()) return 'Informe a chave de API do provedor.';
  if (!c.modelo.trim()) return 'Informe o modelo.';
  let url: URL;
  try { url = new URL(c.baseUrl); } catch { return 'Informe uma URL base válida.'; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return 'Use HTTPS na URL base (HTTP apenas para localhost).';
  return null;
}

/** Monta a chamada direta do navegador ao provedor: a chave nunca passa pelos servidores do EcoGrad. */
export function requisicaoChat(c: ConfigIA, sistema: string, mensagens: readonly ChatMessage[]): { url: string; init: RequestInit } {
  const base = c.baseUrl.trim().replace(/\/+$/, '');
  const modelo = c.modelo.trim(), chave = c.chave.trim();
  const post = (headers: Record<string, string>, body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const { formato } = provedorPorId(c.provedor);
  if (formato === 'anthropic') {
    const fallback = FALLBACK_ANTHROPIC.has(modelo);
    return {
      url: `${base}/messages`,
      init: post(
        { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', ...(fallback ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}) },
        // O dossiê é grande e se repete a cada pergunta: o cache do prefixo barateia a conversa.
        { model: modelo, max_tokens: 64000, stream: true, system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }], messages: mensagens, ...(fallback ? { fallbacks: 'default' } : {}) },
      ),
    };
  }
  if (formato === 'google') {
    return {
      url: `${base}/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`,
      init: post({ 'x-goog-api-key': chave }, {
        systemInstruction: { parts: [{ text: sistema }] },
        contents: mensagens.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.3 },
      }),
    };
  }
  return { url: `${base}/chat/completions`, init: post({ Authorization: `Bearer ${chave}` }, { model: modelo, stream: true, messages: [{ role: 'system', content: sistema }, ...mensagens] }) };
}

/** SSE de cada formato. O fim da conexão nunca conta como sucesso sem confirmação explícita do provedor. */
export async function lerStreamChat(body: ReadableStream<Uint8Array>, formato: FormatoApi, onTexto: (texto: string) => void, signal: AbortSignal) {
  const reader = body.getReader(); const decoder = new TextDecoder(); let buffer = '', fim = false;
  const texto = (t: unknown) => { if (typeof t === 'string' && t && !fim) onTexto(t); };
  const parcial = (motivo: unknown) => new Error(`Resposta parcial: finalização ${String(motivo)}.`);
  const linha = (l: string) => {
    if (!l.startsWith('data:')) return;
    const raw = l.slice(5).trim(); if (!raw || raw === '[DONE]') return;
    const e = JSON.parse(raw);
    if (e.error) throw new Error(e.error.message || 'O provedor retornou um erro durante a resposta.');
    if (formato === 'anthropic') {
      if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') texto(e.delta.text);
      const motivo = e.type === 'message_delta' ? e.delta?.stop_reason : undefined;
      if (motivo === 'refusal') throw new Error('O modelo recusou esta solicitação.');
      if (motivo === 'end_turn' || motivo === 'stop_sequence') fim = true; else if (motivo) throw parcial(motivo);
    } else if (formato === 'google') {
      if (e.promptFeedback?.blockReason) throw new Error('O provedor bloqueou esta solicitação.');
      const c = e.candidates?.[0]; for (const p of c?.content?.parts ?? []) if (!p.thought) texto(p.text);
      if (c?.finishReason) { if (c.finishReason === 'STOP') fim = true; else throw parcial(c.finishReason); }
    } else {
      const c = e.choices?.[0]; texto(c?.delta?.content);
      if (c?.finish_reason) { if (c.finish_reason === 'stop') fim = true; else throw parcial(c.finish_reason); }
    }
  };
  const abort = () => { void reader.cancel(); }; signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) { signal.throwIfAborted(); const r = await reader.read(); if (r.done) break; buffer += decoder.decode(r.value, { stream: true }); const linhas = buffer.split('\n'); buffer = linhas.pop() ?? ''; for (const l of linhas) linha(l.replace(/\r$/, '')); }
    buffer += decoder.decode(); if (buffer.trim()) linha(buffer.trim()); signal.throwIfAborted();
    if (!fim) throw new Error('Conexão encerrada antes da confirmação de resposta completa.');
  } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

const PREFERENCIAS = 'ecograd-ia-byok-v1', SEGREDO = 'ecograd-ia-chave-v1';
export type ConfigSalva = ConfigIA & { lembrar: boolean };
/** A chave fica na sessão da aba, ou neste navegador quando o usuário pede para lembrar. */
export function lerConfigIA(): ConfigSalva | null {
  try {
    const p = JSON.parse(localStorage.getItem(PREFERENCIAS) ?? 'null');
    if (!p || typeof p.provedor !== 'string' || typeof p.modelo !== 'string' || typeof p.baseUrl !== 'string') return null;
    return { provedor: p.provedor, modelo: p.modelo, baseUrl: p.baseUrl, lembrar: p.lembrar === true, chave: (p.lembrar === true ? localStorage : sessionStorage).getItem(SEGREDO) ?? '' };
  } catch { return null; }
}
export function salvarConfigIA({ chave, lembrar, provedor, modelo, baseUrl }: ConfigSalva) {
  localStorage.setItem(PREFERENCIAS, JSON.stringify({ provedor, modelo: modelo.trim(), baseUrl: baseUrl.trim(), lembrar }));
  (lembrar ? localStorage : sessionStorage).setItem(SEGREDO, chave.trim());
  (lembrar ? sessionStorage : localStorage).removeItem(SEGREDO);
}
export function esquecerChaveIA() {
  try { localStorage.removeItem(SEGREDO); sessionStorage.removeItem(SEGREDO); } catch { /* armazenamento indisponível: nada foi salvo */ }
}
