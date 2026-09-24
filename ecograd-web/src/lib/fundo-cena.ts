/**
 * A cena do fundo decorativo: ondas lentas e uma rede de pontos que se ligam
 * quando ficam perto. Um só código de desenho para os dois lugares em que ele
 * roda — o `fundo.worker`, sobre um `OffscreenCanvas`, e a própria página,
 * nos navegadores sem esse recurso —, para o fundo ser idêntico nos dois.
 */

/** Um nó da rede. Posição e deriva em pixels de CSS. */
interface Ponto { x: number; y: number; dx: number; dy: number; r: number }

export interface Paleta { onda: string; malha: string; ponto: string; pontoAlfa: number; forca: number }

type Contexto2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const AREA_POR_PONTO = 13000;
const MIN_PONTOS = 12;
const MAX_PONTOS = 80;
/** Acima disso dois nós deixam de se enxergar. Limitado pela largura em painéis estreitos. */
const ALCANCE = 200;

export function criarCena(ctx: Contexto2D, canvas: { width: number; height: number }) {
  let largura = 0;
  let altura = 0;
  let pontos: Ponto[] = [];
  let fase = 0;

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

  /** Ajusta o bitmap ao tamanho do hospedeiro. Devolve `false` enquanto ele não tem área. */
  const medir = (width: number, height: number, dpr: number) => {
    if (width < 1 || height < 1) return false;
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

  const desenhar = (cores: Paleta) => {
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

  /** Um passo da animação: a fase das ondas e a deriva dos pontos. */
  const avancar = () => {
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
  };

  return { medir, desenhar, avancar };
}
