import { useCallback, useRef } from 'react';
import { GRAUS_POR_PIXEL, normalizarCamera, type Camera3D } from '@/lib/espaco-topologico';

/** Superfície do zrender usada aqui: só o registro de eventos do canvas. */
interface ZRenderArrastavel {
  on: (evento: string, handler: (e: EventoZRender) => void) => void;
  setCursorStyle?: (cursor: string) => void;
}
interface EventoZRender {
  offsetX: number;
  offsetY: number;
  /** Evento do DOM por trás; é dele que sai o tipo de ponteiro. */
  event?: { pointerType?: string };
}

/** Distância em pixels a partir da qual o gesto deixa de ser clique e vira giro. */
export const LIMIAR_ARRASTO = 4;

export interface ArrastoOrbital {
  /** Entregue ao `onReady` do gráfico: registra os handlers no zrender. */
  aoMontar: (instancia: unknown) => void;
  /** Se o gesto atual passou do limiar — o clique dele não deve abrir nada. */
  houveArrasto: () => boolean;
}

/**
 * Giro do cubo 3D arrastando com o mouse.
 *
 * Os handlers são registrados uma única vez, quando o gráfico nasce, e por isso
 * leem tudo por refs: o zrender não é recriado quando o ângulo muda. O ângulo em
 * curso é publicado a cada quadro de animação, e não a cada evento de mouse,
 * para que um gesto rápido não enfileire dezenas de reprojeções de até dois mil
 * pontos.
 *
 * `aoGirar` recebe o ângulo enquanto o botão está pressionado e `aoSoltar`, o
 * ângulo final. A separação existe porque gravar cada quadro na sessão faria o
 * histórico de navegação serializar a análise inteira dezenas de vezes por
 * segundo — o ângulo em curso pertence ao componente, e só o final à sessão.
 */
export function useArrastoOrbital(
  camera: Camera3D,
  aoGirar: (c: Camera3D) => void,
  aoSoltar: (c: Camera3D) => void,
): ArrastoOrbital {
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const aoGirarRef = useRef(aoGirar);
  aoGirarRef.current = aoGirar;
  const aoSoltarRef = useRef(aoSoltar);
  aoSoltarRef.current = aoSoltar;

  const inicio = useRef<{ x: number; y: number; camera: Camera3D } | null>(null);
  const emCurso = useRef<Camera3D | null>(null);
  const girou = useRef(false);
  const quadro = useRef(0);

  const aoMontar = useCallback((instancia: unknown) => {
    const zr = (instancia as { getZr: () => ZRenderArrastavel }).getZr();

    zr.on('mousedown', (e) => {
      // Toque fica de fora: o zrender traduz `touchstart` em `mousedown`, e
      // capturar o gesto aqui impediria a pessoa de rolar a página no celular.
      if (e.event?.pointerType === 'touch') return;
      inicio.current = { x: e.offsetX, y: e.offsetY, camera: cameraRef.current };
      girou.current = false;
    });

    zr.on('mousemove', (e) => {
      const partida = inicio.current;
      if (!partida) return;
      const dx = e.offsetX - partida.x;
      const dy = e.offsetY - partida.y;
      if (!girou.current && Math.hypot(dx, dy) < LIMIAR_ARRASTO) return;
      girou.current = true;
      zr.setCursorStyle?.('grabbing');
      emCurso.current = normalizarCamera({
        azimute: partida.camera.azimute + dx * GRAUS_POR_PIXEL,
        // Arrastar para baixo inclina a câmera para baixo: o topo do cubo se
        // fecha, como em qualquer visualizador 3D.
        elevacao: partida.camera.elevacao + dy * GRAUS_POR_PIXEL,
      });
      if (quadro.current) return;
      quadro.current = requestAnimationFrame(() => {
        quadro.current = 0;
        if (emCurso.current) aoGirarRef.current(emCurso.current);
      });
    });

    const soltar = () => {
      if (quadro.current) {
        cancelAnimationFrame(quadro.current);
        quadro.current = 0;
      }
      const fim = emCurso.current;
      inicio.current = null;
      emCurso.current = null;
      if (fim && girou.current) aoSoltarRef.current(fim);
    };
    zr.on('mouseup', soltar);
    // Soltar o botão fora do canvas não gera `mouseup` aqui; sem isto o cubo
    // continuaria preso ao ponteiro depois de o gesto terminar lá fora.
    zr.on('globalout', soltar);
  }, []);

  return { aoMontar, houveArrasto: () => girou.current };
}
