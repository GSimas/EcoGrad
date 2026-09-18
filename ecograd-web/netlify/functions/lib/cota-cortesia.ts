/**
 * Cota vitalícia da cortesia, guardada em Netlify Blobs.
 *
 * Duas contagens, porque protegem coisas diferentes: a do IP dá justiça (cada
 * visitante conhece o UFSCão e depois traz a própria chave) e a global protege
 * o orçamento. A global é a que importa: NAT de campus e CGNAT põem muita gente
 * num IP só, e trocar de IP leva trinta segundos — a conta do mês não pode
 * depender da cota por IP.
 */
import { createHash } from 'node:crypto';

/** Perguntas de cortesia por IP, para sempre. */
export const PERGUNTAS_POR_IP = 10;
/** Uma pergunta são duas chamadas ao modelo; três quando o SQL precisa de conserto. */
export const CHAMADAS_POR_PERGUNTA = 3;
/**
 * Teto do projeto, lido a cada pedido para poder ser ajustado sem novo deploy.
 * 3.000 perguntas ≈ US$ 10 no preço de pico da DeepSeek e ≈ US$ 5 fora dele —
 * e fora do pico é o horário comercial brasileiro. Suba o número depois de ver
 * o gasto real no painel; é a calibragem que o preço variável pede.
 */
export const tetoPerguntas = () => Number(process.env.CORTESIA_TETO_PERGUNTAS ?? 3000);

export const CHAVE_GLOBAL = 'total';

export interface Cota {
  /** Perguntas: conta uma vez por pergunta, na etapa de escrever a resposta. */
  p: number;
  /** Chamadas ao modelo: teto separado, para nenhuma etapa virar torneira. */
  c: number;
}
const ZERO: Cota = { p: 0, c: 0 };

/** O IP não é guardado: só o hash com sal, que serve para contar e não para identificar. */
export const idDoIp = (ip: string) =>
  `ip-${createHash('sha256').update(`${process.env.CORTESIA_SAL ?? 'ecograd'}:${ip}`).digest('hex').slice(0, 32)}`;

interface Loja { get(k: string, o: { type: 'json' }): Promise<Cota | null>; setJSON(k: string, v: Cota): Promise<void> }
let loja: Loja | null | undefined;
// ponytail: fora da Netlify (testes, `node` puro) a cota vale por instância e
// some com ela. Em produção o store existe; se faltar, o teto global cai junto
// e a cortesia passa a depender só dos caps de tamanho — por isso `estadoDaLoja`
// é exposto, para a função dizer que está degradada.
const memoria = new Map<string, Cota>();

async function abrir(): Promise<Loja | null> {
  if (loja !== undefined) return loja;
  try {
    const { getStore } = await import('@netlify/blobs');
    loja = getStore({ name: 'ufscao-cortesia', consistency: 'strong' }) as unknown as Loja;
  } catch {
    loja = null;
  }
  return loja;
}

/**
 * Há onde contar de verdade. Sem Blobs a contagem vale por instância, e cada
 * instância fria zeraria o teto — a cortesia prefere não abrir a virar cheque em
 * branco. `CORTESIA_MEMORIA=1` aceita a contagem em memória de propósito, para
 * os testes e para `netlify dev`; em produção ninguém liga isso.
 */
export const duravel = async () => (await abrir()) !== null || process.env.CORTESIA_MEMORIA === '1';

export async function lerCota(chave: string): Promise<Cota> {
  const l = await abrir();
  if (l) {
    try { return (await l.get(chave, { type: 'json' })) ?? ZERO; } catch { /* store indisponível: memória */ }
  }
  return memoria.get(chave) ?? ZERO;
}

/**
 * Soma e grava. Sem compare-and-swap: duas perguntas simultâneas do mesmo IP
 * podem contar uma só. Errar por um não muda nada aqui, e o teto global continua
 * de pé — trocar por CAS custa mais do que o erro que evita.
 */
export async function somarCota(chave: string, pergunta: boolean): Promise<Cota> {
  const atual = await lerCota(chave);
  const nova: Cota = { p: atual.p + (pergunta ? 1 : 0), c: atual.c + 1 };
  const l = await abrir();
  if (l) {
    try { await l.setJSON(chave, nova); return nova; } catch { /* store indisponível: memória */ }
  }
  memoria.set(chave, nova);
  return nova;
}

/** Só para os testes: a cota vive fora do processo em produção. */
export const esquecerTudo = () => { memoria.clear(); loja = undefined; };
