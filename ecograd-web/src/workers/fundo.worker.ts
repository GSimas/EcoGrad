/// <reference lib="webworker" />
/**
 * Worker do fundo decorativo. Recebe o `OffscreenCanvas` do `FundoDinamico` e
 * anima a cena aqui: dezenas de pontos, milhares de segmentos por quadro. Na
 * página, esse laço ocupava a main thread o tempo todo, inclusive com a tela
 * parada, e disputava cada quadro com a digitação e os cliques.
 */
import { criarCena, type Paleta } from '../lib/fundo-cena';

export type MensagemFundo =
  | { tipo: 'iniciar'; canvas: OffscreenCanvas; largura: number; altura: number; dpr: number; cores: Paleta; reduzir: boolean; visivel: boolean }
  | { tipo: 'medir'; largura: number; altura: number; dpr: number }
  | { tipo: 'aparencia'; cores: Paleta; reduzir: boolean }
  | { tipo: 'visivel'; visivel: boolean };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
// Chrome, Firefox e Safari recentes têm rAF em worker; sem ele, um quadro a cada ~16 ms.
const pedirQuadro: (f: () => void) => void = typeof ctx.requestAnimationFrame === 'function'
  ? (f) => { ctx.requestAnimationFrame(f); }
  : (f) => { setTimeout(f, 16); };

let cena: ReturnType<typeof criarCena> | null = null;
let cores: Paleta;
let reduzir = false;
let sujo = true;
let visivel = true;
let iniciado = false;
let agendado = false;

function agendar() {
  if (agendado) return;
  agendado = true;
  pedirQuadro(passo);
}

function passo() {
  agendado = false;
  // Com a aba escondida o laço para de vez; volta quando ela reaparece.
  if (!cena || !visivel) return;
  agendar();
  // Em movimento reduzido a cena fica parada; só redesenha se algo mudou
  // (tema, contraste, tamanho do painel).
  if (reduzir) {
    if (!sujo) return;
    sujo = false;
    cena.desenhar(cores);
    return;
  }
  sujo = false;
  cena.avancar();
  cena.desenhar(cores);
}

/** Mesmo protocolo do laço na página: a primeira medição com área dá a partida. */
function medir(largura: number, altura: number, dpr: number) {
  if (!cena) return;
  if (!iniciado) {
    if (!cena.medir(largura, altura, dpr)) return;
    iniciado = true;
    agendar();
  } else if (cena.medir(largura, altura, dpr)) {
    // Redesenha na mesma tarefa: o quadro entregue à página já vem no tamanho novo.
    cena.desenhar(cores);
  }
}

ctx.addEventListener('message', (evento: MessageEvent<MensagemFundo>) => {
  const msg = evento.data;
  if (msg.tipo === 'iniciar') {
    const contexto = msg.canvas.getContext('2d');
    if (!contexto) return;
    cena = criarCena(contexto, msg.canvas);
    cores = msg.cores;
    reduzir = msg.reduzir;
    visivel = msg.visivel;
    medir(msg.largura, msg.altura, msg.dpr);
  } else if (msg.tipo === 'medir') {
    medir(msg.largura, msg.altura, msg.dpr);
  } else if (msg.tipo === 'aparencia') {
    cores = msg.cores;
    reduzir = msg.reduzir;
    sujo = true;
  } else {
    visivel = msg.visivel;
    if (visivel && iniciado) agendar();
  }
});
