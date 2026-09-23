import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useAparencia } from '@/services/aparencia';

/** Quanto a roda precisa girar para avançar um cartão. Trackpads mandam deltas pequenos e seguidos. */
const LIMIAR_RODA = 30;
/** Pausa entre dois passos da roda: um giro longo anda um cartão por vez, não dispara até o fim. */
const TRAVA_RODA_MS = 280;
/** Deslocamento a partir do qual apertar e soltar vira arrasto, e não clique. */
const LIMIAR_ARRASTO = 5;
const DURACAO_MS = 360;
/** Intervalo da rolagem automática. */
const INTERVALO_AUTOMATICO_MS = 3000;

/**
 * Carrossel lateral e infinito: a roda do mouse anda um cartão por vez, o mouse
 * arrasta a faixa, e cada cartão ganha nitidez e escala conforme se aproxima do
 * centro — os de longe ficam menores, apagados e desfocados (regras de
 * `.eco-carrossel-item` em `index.css`).
 *
 * O infinito são três cópias da lista lado a lado: a do meio é a real, e as das
 * pontas são reflexos `inert`, fora do teclado e do leitor de tela. Quando a
 * posição escorrega para uma cópia, ela salta exatamente uma lista de volta ao
 * meio — os cartões são idênticos, então o salto não se vê.
 *
 * A distância de cada cartão ao centro vai para a variável `--distancia`, em
 * cartões: o CSS é quem transforma esse número em escala, desfoque e opacidade.
 */
export function Carrossel({ rotulo, children, cabecalho }: { rotulo: string; children: ReactNode; cabecalho?: ReactNode }) {
  const trilho = useRef<HTMLDivElement>(null);
  const itens = Children.toArray(children);
  const n = itens.length;
  // Com um cartão só não há o que girar: nada de cópias.
  const infinito = n > 1;
  const copias = infinito ? 3 : 1;
  const [atual, setAtual] = useState(0);
  /** Índice na faixa estendida (0 … 3n−1) do cartão mais perto do centro. */
  const centroRef = useRef(infinito ? n : 0);
  /** Cartão para onde a animação em curso está indo: cliques seguidos contam a partir dele. */
  const destinoRef = useRef<number | null>(null);
  const animacaoRef = useRef(0);
  const garantiaRef = useRef(0);
  const arrasto = useRef<{ x: number; rolagem: number; moveu: boolean; id: number } | null>(null);
  const reduzir = useAparencia((s) => s.reduzir);
  /**
   * Rolagem automática: o botão entre as setas a liga e desliga. Quem pediu
   * movimento reduzido começa com ela parada. Mouse em cima ou foco dentro
   * suspendem sem desligar — ninguém lê um cartão que foge — e qualquer passo
   * manual reinicia a contagem dos 3 segundos.
   */
  const [pausado, setPausado] = useState(reduzir);
  const [suspenso, setSuspenso] = useState(false);
  const [relogio, setRelogio] = useState(0);
  const reiniciarRelogio = useCallback(() => setRelogio((x) => x + 1), []);

  /** Largura de uma cópia inteira da lista, com os vãos: o tamanho exato do salto invisível. */
  const larguraDaLista = useCallback((el: HTMLElement) =>
    infinito ? (el.children[n] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft : 0, [infinito, n]);

  /** Traz a posição de volta à cópia do meio, sem movimento visível. */
  const recentrar = useCallback(() => {
    const el = trilho.current;
    if (!el || !infinito) return;
    const lista = larguraDaLista(el);
    if (el.scrollLeft < lista * 0.5) el.scrollLeft += lista;
    else if (el.scrollLeft > lista * 1.5) el.scrollLeft -= lista;
  }, [infinito, larguraDaLista]);

  /**
   * Anima a rolagem quadro a quadro. O `scrollTo({ behavior: 'smooth' })` do
   * navegador disputa com o `scroll-snap` e, em alguns ambientes, nem sai do
   * lugar; por isso o encaixe é desligado durante o trajeto e religado no fim.
   */
  const irPara = useCallback((indice: number) => {
    const el = trilho.current;
    if (!el || !el.children.length) return;
    const limite = Math.max(0, Math.min(indice, el.children.length - 1));
    const alvo = el.children[limite] as HTMLElement;
    const destino = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, alvo.offsetLeft + alvo.offsetWidth / 2 - el.clientWidth / 2));
    cancelAnimationFrame(animacaoRef.current);
    window.clearTimeout(garantiaRef.current);
    const concluir = () => {
      cancelAnimationFrame(animacaoRef.current);
      window.clearTimeout(garantiaRef.current);
      el.scrollLeft = destino;
      el.style.scrollSnapType = '';
      destinoRef.current = null;
      recentrar();
    };
    if (reduzir) { concluir(); return; }
    destinoRef.current = limite;
    const origem = el.scrollLeft;
    const inicio = performance.now();
    el.style.scrollSnapType = 'none';
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / DURACAO_MS);
      el.scrollLeft = origem + (destino - origem) * (1 - (1 - t) ** 3);
      if (t < 1) animacaoRef.current = requestAnimationFrame(passo);
      else concluir();
    };
    animacaoRef.current = requestAnimationFrame(passo);
    // Aba em segundo plano não entrega quadros: sem esta garantia o encaixe
    // ficaria desligado e o carrossel parado no meio do caminho.
    garantiaRef.current = window.setTimeout(concluir, DURACAO_MS + 150);
  }, [reduzir, recentrar]);
  const mover = useCallback((direcao: number) => irPara((destinoRef.current ?? centroRef.current) + direcao), [irPara]);
  useEffect(() => () => { cancelAnimationFrame(animacaoRef.current); window.clearTimeout(garantiaRef.current); }, []);
  const moverManual = useCallback((direcao: number) => { mover(direcao); reiniciarRelogio(); }, [mover, reiniciarRelogio]);

  useEffect(() => {
    if (pausado || suspenso || !infinito) return;
    const relogioAtual = window.setInterval(() => {
      if (!document.hidden && !arrasto.current) mover(1);
    }, INTERVALO_AUTOMATICO_MS);
    return () => window.clearInterval(relogioAtual);
  }, [pausado, suspenso, infinito, mover, relogio]);

  // Começa com o primeiro cartão real no centro — à esquerda dele, o último, pela volta.
  useLayoutEffect(() => {
    const el = trilho.current;
    const primeiro = el?.children[infinito ? n : 0] as HTMLElement | undefined;
    if (!el || !primeiro) return;
    el.scrollLeft = Math.max(0, primeiro.offsetLeft + primeiro.offsetWidth / 2 - el.clientWidth / 2);
  }, [n, infinito]);

  // Distância ao centro: recalculada a cada quadro de rolagem e a cada mudança de largura.
  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    let quadro = 0;
    let parada = 0;
    const medir = () => {
      quadro = 0;
      const filhos = [...el.children] as HTMLElement[];
      if (!filhos.length) return;
      const caixa = el.getBoundingClientRect();
      const centro = caixa.left + caixa.width / 2;
      const passo = filhos.length > 1 ? filhos[1].offsetLeft - filhos[0].offsetLeft : filhos[0].offsetWidth;
      let maisPerto = 0;
      let menor = Infinity;
      filhos.forEach((filho, i) => {
        const r = filho.getBoundingClientRect();
        const distancia = Math.abs(r.left + r.width / 2 - centro) / Math.max(passo, 1);
        if (distancia < menor) { menor = distancia; maisPerto = i; }
        filho.style.setProperty('--distancia', Math.min(distancia, 3).toFixed(3));
      });
      centroRef.current = maisPerto;
      setAtual(maisPerto % n);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
      // Rolagem nativa (toque, trackpad): recentraliza quando ela para.
      window.clearTimeout(parada);
      parada = window.setTimeout(() => { if (destinoRef.current === null && !arrasto.current) recentrar(); }, 160);
    };
    medir();
    el.addEventListener('scroll', aoRolar, { passive: true });
    const observador = new ResizeObserver(() => { recentrar(); aoRolar(); });
    observador.observe(el);
    return () => { el.removeEventListener('scroll', aoRolar); observador.disconnect(); cancelAnimationFrame(quadro); window.clearTimeout(parada); };
  }, [n, recentrar]);

  // Roda: nativa e não passiva, porque o `onWheel` do React não pode impedir a rolagem da página.
  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    let acumulado = 0;
    let travado = false;
    let destrava = 0;
    const aoGirar = (e: WheelEvent) => {
      if (e.ctrlKey) return; // zoom do navegador
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      // Sem volta infinita, as pontas devolvem a rolagem à página.
      const fim = el.scrollWidth - el.clientWidth;
      if (!infinito && ((delta < 0 && el.scrollLeft <= 1) || (delta > 0 && el.scrollLeft >= fim - 1))) return;
      e.preventDefault();
      if (travado) return;
      acumulado += delta;
      if (Math.abs(acumulado) < LIMIAR_RODA) return;
      moverManual(Math.sign(acumulado));
      acumulado = 0;
      travado = true;
      destrava = window.setTimeout(() => { travado = false; }, TRAVA_RODA_MS);
    };
    el.addEventListener('wheel', aoGirar, { passive: false });
    return () => { el.removeEventListener('wheel', aoGirar); window.clearTimeout(destrava); };
  }, [moverManual, infinito]);

  // Arrasto com o mouse. No toque a rolagem nativa já arrasta — e melhor.
  const aoApertar = (e: PointerEvent<HTMLDivElement>) => {
    const el = trilho.current;
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return;
    cancelAnimationFrame(animacaoRef.current);
    window.clearTimeout(garantiaRef.current);
    destinoRef.current = null;
    arrasto.current = { x: e.clientX, rolagem: el.scrollLeft, moveu: false, id: e.pointerId };
  };
  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    const el = trilho.current;
    const a = arrasto.current;
    if (!el || !a) return;
    const dx = e.clientX - a.x;
    if (!a.moveu) {
      if (Math.abs(dx) < LIMIAR_ARRASTO) return;
      a.moveu = true;
      el.setPointerCapture(a.id);
      el.style.scrollSnapType = 'none';
      el.dataset.arrastando = 'true';
    }
    el.scrollLeft = a.rolagem - dx;
    // No meio do arrasto a faixa também dá a volta: salta uma lista e leva junto o ponto de partida.
    if (infinito) {
      const lista = larguraDaLista(el);
      if (el.scrollLeft < lista * 0.5) { el.scrollLeft += lista; a.rolagem += lista; }
      else if (el.scrollLeft > lista * 1.5) { el.scrollLeft -= lista; a.rolagem -= lista; }
    }
  };
  const aoSoltar = () => {
    const el = trilho.current;
    const a = arrasto.current;
    arrasto.current = null;
    if (!el || !a?.moveu) return;
    delete el.dataset.arrastando;
    if (el.hasPointerCapture(a.id)) el.releasePointerCapture(a.id);
    // Encaixa no cartão que ficou mais perto do centro.
    irPara(centroRef.current);
    reiniciarRelogio();
    // O clique que encerra o arrasto não pode abrir a dica do cartão embaixo do mouse.
    const engolir = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
    el.addEventListener('click', engolir, { capture: true, once: true });
    window.setTimeout(() => el.removeEventListener('click', engolir, { capture: true }), 0);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const primeiro = infinito ? n : 0;
    if (e.key === 'ArrowRight') { e.preventDefault(); moverManual(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moverManual(-1); }
    else if (e.key === 'Home') { e.preventDefault(); irPara(primeiro); }
    else if (e.key === 'End') { e.preventDefault(); irPara(primeiro + n - 1); }
  };

  const dois = (x: number) => String(x).padStart(2, '0');
  const rotuloPausa = pausado ? 'Retomar rolagem automática' : 'Pausar rolagem automática';
  return <section role="group" aria-label={rotulo} aria-roledescription="carrossel" className="space-y-2"
    onPointerEnter={(e) => { if (e.pointerType === 'mouse') setSuspenso(true); }} onPointerLeave={() => setSuspenso(false)}
    onFocus={() => setSuspenso(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSuspenso(false); }}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="eco-sobretitulo">{rotulo}</span>
        {cabecalho}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-xs tabular-nums tracking-[.1em] text-slate-400" aria-hidden="true">{dois(atual + 1)} / {dois(n)}</span>
        <button type="button" className="btn h-11 w-11 px-0" onClick={() => moverManual(-1)} disabled={n < 2} aria-label="Indicador anterior" title="Indicador anterior"><ChevronLeft size={16} aria-hidden="true" /></button>
        <button type="button" className="btn h-11 w-11 px-0" onClick={() => setPausado((p) => !p)} disabled={!infinito} aria-label={rotuloPausa} title={rotuloPausa}>
          {pausado ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="btn h-11 w-11 px-0" onClick={() => moverManual(1)} disabled={n < 2} aria-label="Próximo indicador" title="Próximo indicador"><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <div ref={trilho} role="region" tabIndex={0} onKeyDown={aoTeclar}
      onPointerDown={aoApertar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
      aria-label={`${rotulo}: role com a roda do mouse, arraste ou use as setas`}
      className="eco-carrossel relative flex gap-3 overflow-x-auto py-3">
      {Array.from({ length: copias }, (_, c) => itens.map((item, i) => {
        const reflexo = infinito && c !== 1;
        return <div key={`${c}-${i}`} className="eco-carrossel-item"
          aria-hidden={reflexo || undefined}
          // `inert` tira o reflexo do teclado; o React 18 não o aceita como propriedade.
          ref={reflexo ? (no) => no?.setAttribute('inert', '') : undefined}
          aria-current={!reflexo && i === atual ? 'true' : undefined}>{item}</div>;
      }))}
    </div>
  </section>;
}
