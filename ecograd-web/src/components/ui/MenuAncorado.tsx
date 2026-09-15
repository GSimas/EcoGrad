import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const MARGEM = 8;
const ALTURA_MINIMA = 200;

/**
 * Painel preso a um botão e desenhado num portal. Dentro da tabela ele seria
 * cortado pela área de rolagem e pelo cabeçalho fixo; no portal, posicionado por
 * coordenadas de viewport, ele acompanha o gatilho a cada rolagem.
 */
export function MenuAncorado({ rotulo, rotuloGatilho, conteudoGatilho, classeGatilho, largura = 300, children }: {
  /** Nome do painel para leitores de tela. */
  rotulo: string;
  rotuloGatilho: string;
  conteudoGatilho: ReactNode;
  classeGatilho?: string;
  largura?: number;
  children: (fechar: () => void) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const idPainel = useId();
  const refGatilho = useRef<HTMLButtonElement>(null);
  const refPainel = useRef<HTMLDivElement>(null);
  const [estilo, setEstilo] = useState<CSSProperties | null>(null);

  const posicionar = useCallback(() => {
    const g = refGatilho.current?.getBoundingClientRect();
    if (!g) return;
    const larguraReal = Math.min(largura, window.innerWidth - MARGEM * 2);
    const esquerda = Math.max(MARGEM, Math.min(g.left, window.innerWidth - larguraReal - MARGEM));
    const abaixo = window.innerHeight - g.bottom - MARGEM * 2;
    const acima = g.top - MARGEM * 2;
    // Abre para cima quando embaixo não cabe e em cima sobra mais espaço.
    const paraCima = abaixo < ALTURA_MINIMA && acima > abaixo;
    setEstilo({
      width: larguraReal,
      left: esquerda,
      ...(paraCima
        ? { bottom: window.innerHeight - g.top + MARGEM, maxHeight: Math.max(ALTURA_MINIMA, acima) }
        : { top: g.bottom + MARGEM, maxHeight: Math.max(ALTURA_MINIMA, abaixo) }),
    });
  }, [largura]);

  const fechar = useCallback(() => { setAberto(false); refGatilho.current?.focus(); }, []);

  useLayoutEffect(() => { if (aberto) posicionar(); }, [aberto, posicionar]);
  // Leva o foco para o painel: quem abriu pelo teclado continua de lá.
  useEffect(() => { if (aberto && estilo) refPainel.current?.focus({ preventScroll: true }); }, [aberto, estilo]);

  useEffect(() => {
    if (!aberto) return;
    // `capture` alcança a rolagem de qualquer contêiner, não só a da janela.
    const seguir = () => posicionar();
    const foraDaqui = (e: PointerEvent) => {
      const alvo = e.target as Node | null;
      if (alvo && !refPainel.current?.contains(alvo) && !refGatilho.current?.contains(alvo)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      // Sem deixar o Esc seguir adiante: ele fecharia também o que houver em volta.
      if (e.key === 'Escape') { e.stopPropagation(); fechar(); }
    };
    window.addEventListener('scroll', seguir, true);
    window.addEventListener('resize', seguir);
    document.addEventListener('pointerdown', foraDaqui, true);
    document.addEventListener('keydown', tecla, true);
    return () => {
      window.removeEventListener('scroll', seguir, true);
      window.removeEventListener('resize', seguir);
      document.removeEventListener('pointerdown', foraDaqui, true);
      document.removeEventListener('keydown', tecla, true);
    };
  }, [aberto, posicionar, fechar]);

  return <>
    <button
      ref={refGatilho}
      type="button"
      aria-label={rotuloGatilho}
      title={rotuloGatilho}
      aria-haspopup="dialog"
      aria-expanded={aberto}
      aria-controls={aberto ? idPainel : undefined}
      className={classeGatilho}
      onClick={() => setAberto((v) => !v)}
    >{conteudoGatilho}</button>
    {aberto && estilo && createPortal(
      <div
        ref={refPainel}
        id={idPainel}
        role="dialog"
        aria-label={rotulo}
        tabIndex={-1}
        style={estilo}
        className={cn('eco-vidro pointer-events-auto fixed z-[70] overflow-auto overscroll-contain',
          'rounded-lg border border-eco-border p-3 text-left shadow-xl outline-none')}
      >{children(fechar)}</div>,
      document.body,
    )}
  </>;
}
