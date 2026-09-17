import { lerStreamChat, provedorPorId, requisicaoChat, type ConfigIA } from '@/lib/provedores-ia';

/** Uma síntese de 250 palavras não chega perto disso; passar daqui é resposta descontrolada. */
const MAX_CARACTERES = 20000;

/**
 * Envia a síntese citada ao provedor do usuário (BYOK, decisão D10 do ADR 001):
 * a requisição sai do navegador direto para o provedor, como no UFSCão, e
 * não passa pelos servidores do EcoGrad. `onTexto` recebe o texto acumulado.
 */
export async function escreverSintese(config: ConfigIA, sistema: string, mensagem: string, onTexto: (acumulado: string) => void, signal: AbortSignal): Promise<string> {
  const provedor = provedorPorId(config.provedor);
  const { url, init } = requisicaoChat(config, sistema, [{ role: 'user', content: mensagem }]);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new Error(`Não foi possível conectar a ${provedor.nome}. Verifique a URL, a rede ou se o provedor aceita chamadas diretas do navegador (CORS).`);
  }
  if (!response.ok || !response.body) {
    const corpo = await response.json().catch(() => null);
    const detalhe = Array.isArray(corpo) ? corpo[0] : corpo;
    throw new Error(`${provedor.nome}: ${detalhe?.error?.message || `resposta indisponível (HTTP ${response.status})`}`);
  }
  let acumulado = '';
  await lerStreamChat(response.body, provedor.formato, (texto) => {
    acumulado += texto;
    if (acumulado.length > MAX_CARACTERES) throw new Error('A síntese passou de 20 mil caracteres e foi interrompida. O texto parcial foi mantido.');
    onTexto(acumulado);
  }, signal);
  if (!acumulado.trim()) throw new Error('A IA encerrou sem retornar texto.');
  return acumulado;
}
