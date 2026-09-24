import { useEffect, useRef, type MutableRefObject } from 'react';
import { useAparencia } from '@/services/aparencia';
import { cn } from '@/lib/utils';
import { criarCena, type Paleta } from '@/lib/fundo-cena';
import type { MensagemFundo } from '@/workers/fundo.worker';

const lerCor = (nome: string, alternativa: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return /^\d+ \d+ \d+$/.test(v) ? v : alternativa;
};

/**
 * No escuro a rede acende com o limão-sinal da Scientata sobre malha ciano; no
 * claro, verdes-petróleo claros sobre o papel. `forca` compensa a diferença de
 * percepção entre os dois fundos — as ondas ficam discretas, como o brilho
 * difuso do herói da Scientata, e a rede é quem desenha.
 */
function paleta(claro: boolean): Paleta {
  const acento = lerCor('--eco-accent', claro ? '35 110 94' : '184 255 74');
  // No claro o desenho usa tons de ALTA luminância: tons médios escureceriam a
  // base e derrubariam o contraste do texto auxiliar que passa por cima.
  return claro
    ? { onda: '150 200 185', malha: '110 170 155', ponto: '80 145 128', pontoAlfa: 0.5, forca: 0.8 }
    : { onda: acento, malha: '83 215 208', ponto: acento, pontoAlfa: 0.55, forca: 0.35 };
}

const dprAtual = () => Math.min(window.devicePixelRatio || 1, 2);

interface Estado { reduzir: boolean; cores: Paleta | null; sujo: boolean }

/**
 * Workers por canvas. Um canvas só transfere o controle uma vez, e no
 * StrictMode o efeito desmonta e remonta no mesmo instante: o encerramento é
 * adiado e cancelado se o mesmo canvas voltar a ser usado.
 */
const workers = new WeakMap<HTMLCanvasElement, { worker: Worker; encerrar?: ReturnType<typeof setTimeout> }>();
const enviar = (worker: Worker, msg: MensagemFundo, transferir: Transferable[] = []) => worker.postMessage(msg, transferir);

/**
 * Anima a cena num worker, sobre um `OffscreenCanvas`: nenhum quadro passa pela
 * main thread. Devolve `null` onde o navegador não oferece o recurso, e o
 * chamador usa o laço na própria página.
 */
function animarNoWorker(canvas: HTMLCanvasElement, host: HTMLElement, estado: MutableRefObject<Estado>, claro: () => boolean): (() => void) | null {
  let registro = workers.get(canvas);
  if (registro) clearTimeout(registro.encerrar);
  else {
    if (typeof canvas.transferControlToOffscreen !== 'function' || typeof Worker === 'undefined') return null;
    let worker: Worker;
    try {
      // O worker nasce antes da transferência: sem ele, o canvas ficaria
      // transferido e inutilizável também para o laço na página.
      worker = new Worker(new URL('../../workers/fundo.worker.ts', import.meta.url), { type: 'module' });
      const offscreen = canvas.transferControlToOffscreen();
      const { width, height } = host.getBoundingClientRect();
      enviar(worker, {
        tipo: 'iniciar', canvas: offscreen, largura: width, altura: height, dpr: dprAtual(),
        cores: estado.current.cores ?? paleta(claro()), reduzir: estado.current.reduzir, visivel: !document.hidden,
      }, [offscreen]);
    } catch {
      return null;
    }
    registro = { worker };
    workers.set(canvas, registro);
  }
  const { worker } = registro;
  const observador = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    enviar(worker, { tipo: 'medir', largura: width, altura: height, dpr: dprAtual() });
  });
  observador.observe(host);
  const visibilidade = () => enviar(worker, { tipo: 'visivel', visivel: !document.hidden });
  document.addEventListener('visibilitychange', visibilidade);
  const atual = registro;
  return () => {
    observador.disconnect();
    document.removeEventListener('visibilitychange', visibilidade);
    atual.encerrar = setTimeout(() => { worker.terminate(); workers.delete(canvas); }, 0);
  };
}

/** O laço na própria página, para navegadores sem `OffscreenCanvas`. */
function animarNaPagina(canvas: HTMLCanvasElement, host: HTMLElement, estado: MutableRefObject<Estado>, claro: () => boolean): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const cena = criarCena(ctx, canvas);
  let quadro = 0;
  let vivo = true;
  const cores = () => estado.current.cores ?? paleta(claro());
  const medir = () => {
    const { width, height } = host.getBoundingClientRect();
    return cena.medir(width, height, dprAtual());
  };

  const passo = () => {
    if (!vivo) return;
    quadro = requestAnimationFrame(passo);
    if (document.hidden) return;
    // Em movimento reduzido a cena fica parada; só redesenha se algo mudou
    // (tema, contraste, tamanho do painel).
    if (estado.current.reduzir) {
      if (!estado.current.sujo) return;
      estado.current.sujo = false;
      cena.desenhar(cores());
      return;
    }
    estado.current.sujo = false;
    cena.avancar();
    cena.desenhar(cores());
  };

  // A primeira medição pode cair num layout ainda sem dimensões; o observador
  // precisa existir de qualquer forma, ou o canvas fica parado no tamanho padrão.
  let iniciado = false;
  const iniciar = () => {
    if (iniciado || !medir()) return;
    iniciado = true;
    quadro = requestAnimationFrame(passo);
  };
  // Mudar `canvas.width` apaga o desenho. Esperar o próximo quadro para
  // redesenhar deixava a pintura deste quadro com o canvas vazio — e, ao
  // recolher ou abrir a lateral, a largura muda a cada quadro da transição:
  // o fundo piscava. Redesenhar aqui, no retorno do observador, acontece
  // antes da pintura.
  const observador = new ResizeObserver(() => {
    if (!iniciado) iniciar();
    else if (medir()) cena.desenhar(cores());
  });
  observador.observe(host);
  iniciar();
  return () => {
    vivo = false;
    cancelAnimationFrame(quadro);
    observador.disconnect();
  };
}

/**
 * Fundo decorativo: ondas lentas ao fundo e uma rede de pontos que se conectam
 * quando ficam perto. O desenho é puramente estético — `aria-hidden`, sem
 * ponteiro — e some em alto contraste (regra em `index.css`).
 *
 * O laço é montado uma única vez. Tema e movimento entram por `estado`, e não
 * pelas dependências do efeito: reconstruir o canvas a cada troca sortearia
 * pontos novos e a mudança apareceria como um piscar.
 */
export function FundoDinamico({ className }: { className?: string }) {
  const hospedeiro = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduzir = useAparencia((s) => s.reduzir);
  const claro = useAparencia((s) => s.claro);
  const estado = useRef<Estado>({ reduzir, cores: null, sujo: true });

  useEffect(() => {
    estado.current.reduzir = reduzir;
    estado.current.cores = paleta(claro);
    estado.current.sujo = true;
    const canvas = canvasRef.current;
    const registro = canvas ? workers.get(canvas) : undefined;
    if (registro) enviar(registro.worker, { tipo: 'aparencia', cores: estado.current.cores, reduzir });
  }, [reduzir, claro]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hospedeiro.current;
    if (!canvas || !host) return;
    const claroAgora = () => document.documentElement.dataset.tema === 'claro';
    return animarNoWorker(canvas, host, estado, claroAgora) ?? animarNaPagina(canvas, host, estado, claroAgora);
  }, []);

  return (
    <div ref={hospedeiro} aria-hidden="true" className={cn('eco-fundo overflow-hidden', className)}>
      <canvas ref={canvasRef} className="opacity-95 blur-[5px]" />
    </div>
  );
}
