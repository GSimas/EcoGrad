import { Select } from '@/components/ui/Select';
import { useAparencia } from '@/services/aparencia';
import { useSessionField } from '@/hooks/useSessionField';
import { useEffect, useMemo, useState } from 'react';
import { RedeInterativa } from '@/components/ui/RedeInterativa';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { gerarOrbitaLocal, type GrafoHistorico, type MetodoTamanho } from '@/lib/orbit';
import type { GraphNode, SnaGlobal } from '@/types';

const METODOS: MetodoTamanho[] = [
  'Tamanho Fixo',
  'Betweenness',
  'Closeness',
  'Degree Centrality',
  'Clustering',
];

/** Desenha a forma de cada tipo de nó (diamante/estrela/quadrado/triângulo/círculo). */
function desenharNo(no: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, escala: number, corTexto: string) {
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
  ctx.strokeStyle = corTexto;
  ctx.lineWidth = 1 / escala;
  ctx.stroke();

  // O rótulo só aparece com zoom suficiente, para não poluir o canvas
  if (escala > 1.4) {
    const fonte = 11 / escala;
    ctx.font = `${fonte}px Inter, sans-serif`;
    ctx.fillStyle = corTexto;
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
  const reduzir = useAparencia(s => s.reduzir);
  const anos = grafo.anos;
  const anoMax = anos.length > 0 ? anos[anos.length - 1] : new Date().getFullYear();
  const anoMin = anos.length > 0 ? anos[0] : anoMax;

  const [anoLimite, setAnoLimite] = useSessionField('orbita.ano', anoMax);
  const [tocando, setTocando] = useState(false);
  const [profundidade, setProfundidade] = useSessionField('orbita.profundidade', 1);
  const [metodoTamanho, setMetodoTamanho] = useSessionField<MetodoTamanho>('orbita.tamanho', 'Tamanho Fixo');
  useEffect(() => {
    setAnoLimite((ano) => Math.min(anoMax, Math.max(anoMin, ano)));
    setTocando(false);
  }, [termoFoco, anoMax]);

  useEffect(() => { if (reduzir) setTocando(false); }, [reduzir]);

  // Player temporal: avança um ano a cada 700ms e para no último
  useEffect(() => {
    if (!tocando || reduzir) return undefined;
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
  }, [tocando, anoMax, reduzir]);

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

  return (
    <div className="space-y-3">
      <Card className="grid gap-4 sm:flex sm:flex-wrap sm:items-end">
        <div className="flex items-center gap-2">
          <button type="button" className="btn" disabled={reduzir} title={reduzir ? "Movimento reduzido: ajuste o ano manualmente" : undefined} onClick={() => setTocando((v) => !v)}>
            {tocando ? <Pause size={14} /> : <Play size={14} />}
            {tocando ? 'Pausar evolução' : 'Reproduzir evolução'}
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

        <label className="flex min-w-0 w-full sm:min-w-[220px] sm:flex-1 flex-col gap-1 text-xs text-slate-400">
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
          <Select aria-label="Profundidade" valor={String(profundidade)} onChange={(v) => setProfundidade(Number(v))} opcoes={[{ valor: '1', rotulo: '1 salto' }, { valor: '2', rotulo: '2 saltos' }]} />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Tamanho dos nós
          <Select aria-label="Tamanho dos nós" valor={metodoTamanho} onChange={(v) => setMetodoTamanho(v as MetodoTamanho)} opcoes={METODOS.map((m) => ({ valor: m, rotulo: m }))} />
        </label>
      </Card>

      <RedeInterativa id={`orbita.${termoFoco}`} titulo="Órbita de relacionamentos" nodes={dados.nodes} links={dados.links} contexto={{anoLimite,profundidade,metodoTamanho,limiteVisualNos:600}} descricao={`Recorte acumulado até ${anoLimite}, ${profundidade} salto(s). Tamanho dos nós: ${metodoTamanho}. O foco é um losango; documentos, quadrados; orientação, estrelas; conceitos, triângulos; demais tipos, círculos. Registros sem ano entram no algoritmo com ano zero. Títulos e nomes iguais podem ser agregados; o recorte visual limita-se a 600 nós.`} onSelecionar={(n)=>onSelecionarNo?.(n.id,n.tipo)} desenharNo={desenharNo} />
    </div>
  );
}
