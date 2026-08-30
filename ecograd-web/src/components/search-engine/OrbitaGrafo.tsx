import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { CORES_TIPO, gerarOrbitaLocal, type GrafoHistorico, type MetodoTamanho } from '@/lib/orbit';
import type { GraphNode, SnaGlobal } from '@/types';

const METODOS: MetodoTamanho[] = [
  'Tamanho Fixo',
  'Betweenness',
  'Closeness',
  'Degree Centrality',
  'Clustering',
];

/** Desenha a forma de cada tipo de nó (diamante/estrela/quadrado/triângulo/círculo). */
function desenharNo(no: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, escala: number) {
  const { x = 0, y = 0 } = no;
  const r = Math.max(2, no.size / 6);
  ctx.fillStyle = no.color;
  ctx.beginPath();

  switch (no.shape) {
    case 'diamond':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case 'square':
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      break;
    case 'triangle':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.8);
      ctx.lineTo(x - r, y + r * 0.8);
      ctx.closePath();
      break;
    case 'star': {
      const pontas = 5;
      for (let i = 0; i < pontas * 2; i += 1) {
        const raio = i % 2 === 0 ? r : r * 0.45;
        const ang = (i * Math.PI) / pontas - Math.PI / 2;
        const px = x + Math.cos(ang) * raio;
        const py = y + Math.sin(ang) * raio;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
  ctx.fill();

  // O rótulo só aparece com zoom suficiente, para não poluir o canvas
  if (escala > 1.4) {
    const fonte = 11 / escala;
    ctx.font = `${fonte}px Inter, sans-serif`;
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(no.label.length > 26 ? `${no.label.slice(0, 26)}…` : no.label, x, y + r + 1);
  }
}

/**
 * Órbita de Relacionamentos com player temporal.
 * O grafo histórico é montado uma vez; cada frame só refaz o recorte por ano,
 * o que mantém a animação fluida (60 FPS) mesmo em bases grandes.
 */
export function OrbitaGrafo({
  grafo,
  termoFoco,
  snaGlobal,
  onSelecionarNo,
}: {
  grafo: GrafoHistorico;
  termoFoco: string;
  snaGlobal: SnaGlobal | null;
  onSelecionarNo?: (id: string, tipo: string) => void;
}) {
  const anos = grafo.anos;
  const anoMax = anos.length > 0 ? anos[anos.length - 1] : new Date().getFullYear();
  const anoMin = anos.length > 0 ? anos[0] : anoMax;

  const [anoLimite, setAnoLimite] = useState(anoMax);
  const [tocando, setTocando] = useState(false);
  const [profundidade, setProfundidade] = useState(1);
  const [metodoTamanho, setMetodoTamanho] = useState<MetodoTamanho>('Tamanho Fixo');
  const containerRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);

  useEffect(() => {
    setAnoLimite(anoMax);
    setTocando(false);
  }, [termoFoco, anoMax]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Player temporal: avança um ano a cada 700ms e para no último
  useEffect(() => {
    if (!tocando) return undefined;
    const id = window.setInterval(() => {
      setAnoLimite((atual) => {
        if (atual >= anoMax) {
          setTocando(false);
          return anoMax;
        }
        return atual + 1;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [tocando, anoMax]);

  const dados = useMemo(
    () =>
      gerarOrbitaLocal(grafo, termoFoco, {
        profundidade,
        anoLimite,
        metodoTamanho,
        snaGlobal,
      }),
    [grafo, termoFoco, profundidade, anoLimite, metodoTamanho, snaGlobal],
  );

  // O force-graph muta os objetos que recebe; clonar evita corromper o memo
  const dadosGrafo = useMemo(
    () => ({ nodes: dados.nodes.map((n) => ({ ...n })), links: dados.links.map((l) => ({ ...l })) }),
    [dados],
  );

  const aoClicar = useCallback(
    (no: object) => {
      const n = no as GraphNode;
      onSelecionarNo?.(n.id, n.tipo);
    },
    [onSelecionarNo],
  );

  if (dados.nodes.length === 0) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-500">
          Sem conexões para <strong>{termoFoco}</strong> até {anoLimite}.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={() => setTocando((v) => !v)}>
            {tocando ? <Pause size={14} /> : <Play size={14} />}
            {tocando ? 'Pausar' : 'Play'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setTocando(false);
              setAnoLimite(anoMin);
            }}
          >
            <RotateCcw size={14} /> Reiniciar
          </button>
        </div>

        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-slate-400">
          Recorte temporal: até <span className="font-semibold text-eco-accent">{anoLimite}</span>
          <input
            type="range"
            min={anoMin}
            max={anoMax}
            value={anoLimite}
            onChange={(e) => {
              setTocando(false);
              setAnoLimite(Number(e.target.value));
            }}
            className="accent-eco-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Profundidade
          <select
            value={profundidade}
            onChange={(e) => setProfundidade(Number(e.target.value))}
            className="input py-1.5"
          >
            <option value={1}>1 salto</option>
            <option value={2}>2 saltos</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Tamanho dos nós
          <select
            value={metodoTamanho}
            onChange={(e) => setMetodoTamanho(e.target.value as MetodoTamanho)}
            className="input py-1.5"
          >
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <div ref={containerRef} className="overflow-hidden rounded-xl border border-eco-border bg-black/30">
        <ForceGraph2D
          graphData={dadosGrafo}
          width={largura}
          height={520}
          backgroundColor="rgba(0,0,0,0)"
          nodeCanvasObject={(no, ctx, escala) =>
            desenharNo(no as GraphNode & { x?: number; y?: number }, ctx, escala)
          }
          nodePointerAreaPaint={(no, cor, ctx) => {
            const n = no as GraphNode & { x?: number; y?: number };
            ctx.fillStyle = cor;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, Math.max(3, n.size / 5), 0, 2 * Math.PI);
            ctx.fill();
          }}
          nodeLabel={(no) => (no as GraphNode).title}
          linkColor={() => 'rgba(149,165,166,0.35)'}
          linkWidth={1}
          cooldownTicks={120}
          d3VelocityDecay={0.35}
          onNodeClick={aoClicar}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>
          {dados.nodes.length} nós · {dados.links.length} conexões
        </span>
        {Object.entries(CORES_TIPO)
          .filter(([tipo]) => tipo !== 'Desconhecido' && tipo !== 'Palavra-chave')
          .map(([tipo, cor]) => (
            <span key={tipo} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
              {tipo}
            </span>
          ))}
      </div>
    </div>
  );
}
