import { useAparencia } from '@/services/aparencia';
import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasBoundary } from './CanvasBoundary';
import type { ForceGraphMethods } from 'react-force-graph-2d';
const ForceGraph2D = lazy(() => import('react-force-graph-2d'));
import { useSessionField } from '@/hooks/useSessionField';
import { Tabela } from './Tabela';
import type { GraphNode, GraphLink } from '@/types';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Pause, Play, ZoomIn, ZoomOut } from 'lucide-react';
import { BaixarImagem } from './BaixarImagem';
import { Dica } from './primitives';
import { useEmJanela } from './contexto-janela';
import { baixarCanvas, type FormatoImagem } from '@/lib/exportar-imagem';

type Camera = { zoom: number; x: number; y: number };
export function RedeInterativa({ id, titulo, nodes, links, descricao, contexto, onSelecionar, desenharNo, pausadoPadrao = true, notasNaDica: notasNaDicaPedidas }: {
  id: string; titulo: string; nodes: readonly GraphNode[]; links: readonly GraphLink[]; descricao: string;
  contexto?: Record<string, unknown>; onSelecionar: (no: GraphNode) => void;
  /** Estado inicial do movimento, antes de o usuário pausar ou retomar. */
  pausadoPadrao?: boolean;
  /** Contagem, descrição e instruções de teclado numa dica "i", em vez de dois parágrafos. */
  notasNaDica?: boolean;
  desenharNo?: (no: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, escala: number, corTexto: string) => void;
}) {
  const { claro, reduzir } = useAparencia();
  const emJanela = useEmJanela();
  const notasNaDica = notasNaDicaPedidas ?? emJanela;
  const ref = useRef<ForceGraphMethods>();
  const container = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(300);
  const [vista, setVista] = useSessionField('rede.' + id + '.vista', 'rede');
  const [pausado, setPausado] = useSessionField('rede.' + id + '.pausado', pausadoPadrao);
  const pausaEfetiva = pausado || reduzir;
  const [camera, setCamera] = useSessionField<Camera | null>('rede.' + id + '.camera', null);
  const cameraAtual = useRef(camera); cameraAtual.current = camera;
  const entrada = useRef(1);
  const frameEntrada = useRef<number | null>(null);
  // A deferred canvas can mount after effects have run. Restore on attachment too.
  const conectar = useMemo(() => ({
    get current() { return ref.current; },
    set current(instance: ForceGraphMethods | undefined) {
      ref.current = instance ?? undefined;
      const saved = cameraAtual.current;
      if (instance && saved) { instance.zoom(saved.zoom, 0); instance.centerAt(saved.x, saved.y, 0); }
    },
  }), []);
  const frameCamera = useRef<number | null>(null);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      if (frameCamera.current !== null) cancelAnimationFrame(frameCamera.current);
      if (frameEntrada.current !== null) cancelAnimationFrame(frameEntrada.current);
      frameCamera.current = null;
      frameEntrada.current = null;
    };
  }, [id]);
  const salvarCamera = () => {
    // The canvas adapter can emit zoom synchronously during its React render.
    // Commit only after that render; cancel late callbacks when leaving the view.
    if (frameCamera.current !== null) return;
    frameCamera.current = requestAnimationFrame(() => {
      frameCamera.current = null;
      const r = ref.current;
      if (!montado.current || !r) return;
      const center = r.centerAt(); const next = {zoom:r.zoom(),x:center.x,y:center.y};
      const prev = cameraAtual.current;
      if (!prev || Math.abs(prev.zoom-next.zoom)>0.00001 || Math.abs(prev.x-next.x)>0.00001 || Math.abs(prev.y-next.y)>0.00001) setCamera(next);
    });
  };
  // Only clones are handed to the layout engine, which mutates coordinates and link endpoints.
  const dados = useMemo(() => ({ nodes: nodes.map((n) => ({...n})), links: links.map((l) => ({...l})) }), [nodes, links]);
  const hasNodes = nodes.length > 0;
  const tipos = [...new Set(nodes.map((n) => n.tipo))];
  useEffect(() => {
    if (frameEntrada.current !== null) cancelAnimationFrame(frameEntrada.current);
    if (reduzir || !hasNodes) {
      entrada.current = 1;
      return;
    }
    entrada.current = 0;
    const inicio = performance.now();
    const duracao = 560;
    const animar = (agora: number) => {
      const linear = Math.min(1, (agora - inicio) / duracao);
      entrada.current = 1 - Math.pow(1 - linear, 3);
      if (linear < 1) frameEntrada.current = requestAnimationFrame(animar);
      else frameEntrada.current = null;
    };
    frameEntrada.current = requestAnimationFrame(animar);
    return () => {
      if (frameEntrada.current !== null) cancelAnimationFrame(frameEntrada.current);
      frameEntrada.current = null;
    };
  }, [dados, reduzir, hasNodes]);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setLargura(Math.max(1, e.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [vista]);
  useEffect(() => {
    const c = cameraAtual.current;
    if (c && ref.current) { ref.current.zoom(c.zoom, 0); ref.current.centerAt(c.x, c.y, 0); }
  }, [id, largura, vista, hasNodes]);
  useEffect(() => { if (!pausaEfetiva) ref.current?.d3ReheatSimulation(); }, [pausaEfetiva]);
  const mover = (x: number, y: number) => {
    const r = ref.current; if (!r) return;
    const c = r.centerAt(); const passo = 60 / r.zoom();
    r.centerAt(c.x + x * passo, c.y + y * passo, 0);
  };
  const zoom = (fator: number) => { const r = ref.current; if (r) r.zoom(Math.max(0.1, Math.min(12, r.zoom() * fator)), 0); };
  // O force-graph desenha num `<canvas>` próprio; a exportação copia o bitmap
  // como ele está na tela, respeitando zoom e enquadramento atuais.
  const baixarImagem = (formato: FormatoImagem) => baixarCanvas(container.current?.querySelector('canvas'), titulo, formato);
  const instrucoes = `Use os controles por teclado para ajustar a câmera e a tabela de nós para navegar. Posição e distância no desenho são produzidas pelo layout; não são indicadores científicos. ${reduzir ? 'Movimento reduzido: rede pausada pela preferência de aparência.' : pausado ? 'Movimento pausado.' : 'Movimento ativo.'}`;
  return <section className="min-w-0 space-y-3" aria-label={titulo}>
    {!notasNaDica && <p className="text-sm text-slate-300">{nodes.length} nós · {links.length} conexões visíveis. {descricao}</p>}
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Visualização de ${titulo}`}>
      {['rede','nos','conexoes'].map((v) => <button type="button" key={v} className="btn" aria-pressed={vista === v} onClick={() => setVista(v)}>{v === 'rede' ? 'Ver rede' : v === 'nos' ? 'Nós em tabela' : 'Conexões em tabela'}</button>)}
      {notasNaDica && <Dica rotulo={`Como ler: ${titulo}`}>
        <p>{nodes.length} nós · {links.length} conexões visíveis. {descricao}</p>
        <p>{instrucoes}</p>
      </Dica>}
    </div>
    {vista === 'nos' ? <Tabela titulo={`Nós de ${titulo}`} contexto={contexto} descricao={descricao} linhas={nodes.map((n) => ({nome:n.id,id:n.id,tipo:n.tipo,tamanho:n.size}))} colunas={[{chave:'nome',rotulo:'Nome completo'},{chave:'tipo',rotulo:'Tipo na rede'},{chave:'tamanho',rotulo:'Tamanho visual (unidade do desenho)'}]} onAbrir={(l)=>{const n=nodes.find((n)=>n.id===l.id);if(n) onSelecionar(n);}} />
      : vista === 'conexoes' ? <Tabela titulo={`Conexões de ${titulo}`} contexto={contexto} descricao="A tabela contém as mesmas arestas do recorte visual. A espessura é um atributo do desenho, não uma medida de qualidade. Explore um nó pela tabela de nós." linhas={links.map((l)=>({origem:l.source,destino:l.target,espessura:l.width??1}))} colunas={[{chave:'origem',rotulo:'Nó de origem'},{chave:'destino',rotulo:'Nó de destino'},{chave:'espessura',rotulo:'Espessura visual'}]} />
      : <>
        {!notasNaDica && <p className="text-xs text-slate-400">{instrucoes}</p>}
        <div ref={container} className="eco-network-canvas overflow-hidden rounded-lg border border-eco-border bg-eco-bg" role="img" aria-label={`${titulo}: representação visual; nós e conexões disponíveis nas tabelas`}>
          {!nodes.length ? <p className="p-6 text-sm">Nenhum nó no recorte. Ajuste os filtros acima; os controles continuam disponíveis.</p> : <CanvasBoundary><ForceGraph2D
            ref={conectar} graphData={dados} width={largura} height={440} backgroundColor="rgba(0,0,0,0)"
            minZoom={0.1} maxZoom={12} nodeVal={(n)=>Math.max(0.01, Math.max(1,(n as GraphNode).size/8) * entrada.current * entrada.current)} nodeColor={(n)=>claro && (n as GraphNode).color.toUpperCase()==='#FFFFFF' ? '#2A3732' : (n as GraphNode).color}
            nodeLabel={(n)=>`${(n as GraphNode).tipo}: ${(n as GraphNode).id}`.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
            linkColor={()=>claro ? `rgba(71,85,105,${0.65 * entrada.current})` : `rgba(171,184,202,${0.65 * entrada.current})`} linkWidth={(l)=>((l as GraphLink).width??1) * entrada.current}
            cooldownTicks={pausaEfetiva?0:120} warmupTicks={30} d3VelocityDecay={0.35}
            nodeCanvasObjectMode={() => desenharNo ? 'replace' : 'after'}
            nodeCanvasObject={desenharNo ? (n,ctx,k)=>{
              const node = n as GraphNode & {x?:number;y?:number};
              const x = node.x ?? 0; const y = node.y ?? 0; const escalaEntrada = entrada.current;
              ctx.save(); ctx.globalAlpha *= escalaEntrada; ctx.translate(x,y); ctx.scale(escalaEntrada,escalaEntrada); ctx.translate(-x,-y);
              desenharNo({...node, color: claro && node.color.toUpperCase()==='#FFFFFF' ? '#2A3732' : node.color},ctx,k,claro ? '#16241F' : '#DEE2DC');
              ctx.restore();
            } : (n,ctx,k)=>{ const node=n as GraphNode & {x:number;y:number}; ctx.save(); ctx.globalAlpha *= entrada.current; ctx.beginPath(); ctx.arc(node.x,node.y,Math.sqrt(Math.max(1,node.size/8))*4*entrada.current,0,Math.PI*2);ctx.strokeStyle=claro?'#2A3732':'#CBD2CE';ctx.lineWidth=1/k;ctx.stroke();ctx.restore(); }}
            onNodeClick={(n)=>onSelecionar(n as GraphNode)}
            onZoomEnd={salvarCamera}
          /></CanvasBoundary>}
        </div>
        {/* Só ícones: o nome de cada ação vai no `aria-label` e no `title`, que o
            leitor de tela lê e o mouse mostra ao repousar. */}
        <div className="eco-network-controls flex flex-wrap gap-2" role="group" aria-label={`Controles de ${titulo}`}>
          {([
            { rotulo: 'Ampliar rede', Icone: ZoomIn, acao: () => zoom(1.3) },
            { rotulo: 'Reduzir rede', Icone: ZoomOut, acao: () => zoom(1 / 1.3) },
            { rotulo: 'Enquadrar todos os nós', Icone: Maximize2, acao: () => ref.current?.zoomToFit(0, 30) },
            { rotulo: pausaEfetiva ? 'Retomar movimento' : 'Pausar movimento', Icone: pausaEfetiva ? Play : Pause, acao: () => setPausado(!pausado), bloqueado: reduzir },
            { rotulo: 'Mover à esquerda', Icone: ArrowLeft, acao: () => mover(-1, 0) },
            { rotulo: 'Mover à direita', Icone: ArrowRight, acao: () => mover(1, 0) },
            { rotulo: 'Mover acima', Icone: ArrowUp, acao: () => mover(0, -1) },
            { rotulo: 'Mover abaixo', Icone: ArrowDown, acao: () => mover(0, 1) },
          ]).map(({ rotulo, Icone, acao, bloqueado }, i) => <button key={i} type="button" className="btn h-11 w-11 px-0"
            disabled={!hasNodes || !!bloqueado} onClick={acao} aria-label={rotulo} title={rotulo}><Icone size={17} aria-hidden="true" /></button>)}
          <BaixarImagem titulo={titulo} onBaixar={baixarImagem} disabled={!hasNodes} />
        </div>
        <p className="text-xs text-slate-300" role="status">Zoom: {Math.round((camera?.zoom ?? 1)*100)}%.</p>
        <ul className="flex flex-wrap gap-3 text-xs" aria-label={`Legenda de ${titulo}`}>{tipos.map((tipo)=><li key={tipo} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full border border-slate-500" style={{backgroundColor:(nodes.find((n)=>n.tipo===tipo && n.color!=='#FFFFFF') ?? nodes.find((n)=>n.tipo===tipo))?.color}} />{tipo}</li>)}</ul>
      </>}
  </section>;
}
