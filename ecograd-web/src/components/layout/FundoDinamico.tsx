import { useEffect, useRef } from 'react';
import { useAparencia } from '@/services/aparencia';
import { cn } from '@/lib/utils';

/** Um nó da rede. Posição e deriva em pixels de CSS. */
interface Ponto { x: number; y: number; dx: number; dy: number; r: number }

interface Paleta { onda: string; malha: string; ponto: string; pontoAlfa: number; forca: number }

const AREA_POR_PONTO = 13000;
const MIN_PONTOS = 12;
const MAX_PONTOS = 80;
/** Acima disso dois nós deixam de se enxergar. Limitado pela largura em painéis estreitos. */
const ALCANCE = 200;

const lerCor = (nome: string, alternativa: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return /^\d+ \d+ \d+$/.test(v) ? v : alternativa;
};

/**
 * No escuro a rede brilha com o âmbar da marca sobre azul frio; no claro, tons
 * frios saturados, que o fundo quase branco exigiria para aparecer. `forca`
 * compensa a diferença de percepção entre os dois fundos.
 */
function paleta(claro: boolean): Paleta {
  const acento = lerCor('--eco-accent', claro ? '137 70 0' : '255 182 72');
  // No claro o desenho é feito de azuis de ALTA luminância: sobre um fundo quase
  // branco é o matiz que o torna visível, enquanto tons médios escureceriam a
  // base e derrubariam o contraste do texto auxiliar que passa por cima.
  return claro
    ? { onda: '150 190 235', malha: '120 165 215', ponto: '95 145 205', pontoAlfa: 0.5, forca: 1 }
    : { onda: acento, malha: '150 190 255', ponto: acento, pontoAlfa: 0.5, forca: 1 };
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
  const estado = useRef({ reduzir, cores: null as Paleta | null, sujo: true });

  useEffect(() => {
    estado.current.reduzir = reduzir;
    estado.current.cores = paleta(claro);
    estado.current.sujo = true;
  }, [reduzir, claro]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hospedeiro.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    let largura = 0;
    let altura = 0;
    let pontos: Ponto[] = [];
    let fase = 0;
    let quadro = 0;
    let vivo = true;

    const semear = () => {
      const alvo = Math.min(MAX_PONTOS, Math.max(MIN_PONTOS, Math.round((largura * altura) / AREA_POR_PONTO)));
      // Só completa ou apara a lista: os pontos que já existem seguem onde estão.
      pontos = pontos.slice(0, alvo);
      while (pontos.length < alvo) {
        pontos.push({
          x: Math.random() * largura,
          y: Math.random() * altura,
          // Deriva lenta: a rede deve respirar, não correr.
          dx: (Math.random() - 0.5) * 0.3,
          dy: (Math.random() - 0.5) * 0.3,
          r: 1.4 + Math.random() * 2.4,
        });
      }
    };

    const medir = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const mudou = width !== largura || height !== altura;
      largura = width;
      altura = height;
      if (mudou) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      semear();
      return true;
    };

    const ondas = (cores: Paleta) => {
      for (let i = 0; i < 3; i++) {
        const base = altura * (0.32 + i * 0.2);
        const amplitude = Math.min(altura * 0.14, 70) * (1 - i * 0.16);
        const comprimento = Math.max(largura * 0.7, 170) * (1 + i * 0.32);
        ctx.beginPath();
        ctx.moveTo(0, altura);
        ctx.lineTo(0, base);
        for (let x = 0; x <= largura; x += 5) {
          ctx.lineTo(x, base + Math.sin(x / comprimento * Math.PI * 2 + fase * (0.7 + i * 0.28) + i) * amplitude);
        }
        ctx.lineTo(largura, altura);
        ctx.closePath();
        ctx.fillStyle = `rgb(${cores.onda} / ${(0.17 - i * 0.045) * cores.forca})`;
        ctx.fill();
      }
    };

    const desenhar = () => {
      const cores = estado.current.cores ?? paleta(document.documentElement.dataset.tema === 'claro');
      ctx.clearRect(0, 0, largura, altura);
      ondas(cores);
      const alcance = Math.min(ALCANCE, Math.max(largura, altura) * 0.6);
      for (let i = 0; i < pontos.length; i++) {
        for (let j = i + 1; j < pontos.length; j++) {
          const dx = pontos[i].x - pontos[j].x;
          const dy = pontos[i].y - pontos[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > alcance) continue;
          ctx.beginPath();
          ctx.moveTo(pontos[i].x, pontos[i].y);
          ctx.lineTo(pontos[j].x, pontos[j].y);
          // Some suavemente conforme os nós se afastam.
          ctx.strokeStyle = `rgb(${cores.malha} / ${(1 - dist / alcance) * 0.5 * cores.forca})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      for (const p of pontos) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${cores.ponto} / ${cores.pontoAlfa})`;
        ctx.fill();
      }
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
        desenhar();
        return;
      }
      estado.current.sujo = false;
      fase += 0.01;
      for (const p of pontos) {
        p.x += p.dx;
        p.y += p.dy;
        // Reflete nas bordas: mantém a densidade estável sem reposicionar nada.
        if (p.x < 0 || p.x > largura) p.dx *= -1;
        if (p.y < 0 || p.y > altura) p.dy *= -1;
        p.x = Math.min(Math.max(p.x, 0), largura);
        p.y = Math.min(Math.max(p.y, 0), altura);
      }
      desenhar();
    };

    // A primeira medição pode cair num layout ainda sem dimensões; o observador
    // precisa existir de qualquer forma, ou o canvas fica parado no tamanho padrão.
    let iniciado = false;
    const iniciar = () => {
      if (iniciado || !medir()) return;
      iniciado = true;
      quadro = requestAnimationFrame(passo);
    };
    const observador = new ResizeObserver(() => {
      if (!iniciado) iniciar();
      else if (medir()) estado.current.sujo = true;
    });
    observador.observe(host);
    iniciar();
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
      observador.disconnect();
    };
  }, []);

  return (
    <div ref={hospedeiro} aria-hidden="true" className={cn('eco-fundo overflow-hidden', className)}>
      <canvas ref={canvasRef} className="opacity-95 blur-[5px]" />
    </div>
  );
}
