/**
 * Exportação de gráficos como imagem.
 *
 * Dois formatos, com propósitos diferentes:
 *
 * - **JPG com fundo**: o fundo opaco do tema é pintado sob o desenho. Serve
 *   para colar em slide, documento ou e-mail, onde um PNG transparente
 *   apareceria com o texto claro sobre papel branco — ilegível.
 * - **PNG sem fundo**: preserva a transparência, para compor sobre outro
 *   fundo em editor de imagem ou layout.
 *
 * A cor de fundo é lida do tema vivo (`--eco-panel`), e não fixada no código,
 * para que a exportação acompanhe a alternância entre claro e escuro.
 */

import { removerAcentos } from './stopwords';

export type FormatoImagem = 'jpg' | 'png';

/** Fator de amplitude do bitmap exportado — imagem nítida em tela retina e impressão. */
const ESCALA = 2;

/**
 * Cor de fundo opaca do tema atual, no formato aceito por canvas e ECharts.
 *
 * `--eco-panel` é o fundo do cartão onde o gráfico é desenhado, então a imagem
 * exportada sai com a mesma cor que o usuário vê atrás do gráfico.
 */
export function fundoOpacoDoTema(): string {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue('--eco-panel').trim();
  // A variável guarda os canais separados por espaço ("22 27 34"), no formato
  // que o Tailwind usa para aplicar opacidade.
  return /^\d+\s+\d+\s+\d+$/.test(bruto) ? `rgb(${bruto})` : '#FFFFFF';
}

/** Nome de arquivo previsível a partir do título do gráfico. */
export function nomeDeArquivo(titulo: string, formato: FormatoImagem): string {
  const base = removerAcentos(titulo)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'grafico';
  return `ecograd-${base}.${formato}`;
}

/** Dispara o download de uma imagem já codificada em data URL. */
export function baixarDataUrl(dataUrl: string, nome: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Converte um `<canvas>` em data URL no formato pedido.
 *
 * O canvas de origem nunca é alterado: para o JPG, o conteúdo é copiado para
 * um canvas temporário já pintado com o fundo do tema. Sem isso, o JPEG — que
 * não tem canal alfa — renderiza os pixels transparentes como preto.
 */
export function canvasParaDataUrl(canvas: HTMLCanvasElement, formato: FormatoImagem): string {
  if (formato === 'png') return canvas.toDataURL('image/png');

  const copia = document.createElement('canvas');
  copia.width = canvas.width;
  copia.height = canvas.height;
  const ctx = copia.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');
  ctx.fillStyle = fundoOpacoDoTema();
  ctx.fillRect(0, 0, copia.width, copia.height);
  ctx.drawImage(canvas, 0, 0);
  return copia.toDataURL('image/jpeg', 0.95);
}

/** Subconjunto da API do ECharts que a exportação usa. */
export interface InstanciaExportavel {
  getDataURL: (opcoes: {
    type: 'png' | 'jpeg';
    backgroundColor?: string;
    pixelRatio?: number;
    excludeComponents?: string[];
  }) => string;
}

export function ehExportavel(valor: unknown): valor is InstanciaExportavel {
  return !!valor && typeof (valor as InstanciaExportavel).getDataURL === 'function';
}

/** Exporta um gráfico ECharts já renderizado. */
export function baixarGraficoECharts(
  instancia: InstanciaExportavel,
  titulo: string,
  formato: FormatoImagem,
): void {
  const dataUrl = instancia.getDataURL(
    formato === 'jpg'
      ? { type: 'jpeg', backgroundColor: fundoOpacoDoTema(), pixelRatio: ESCALA }
      // `'transparent'` sobrepõe o `backgroundColor` da opção, que pode ter
      // sido trocado por uma cor sólida na adaptação de tema.
      : { type: 'png', backgroundColor: 'transparent', pixelRatio: ESCALA },
  );
  baixarDataUrl(dataUrl, nomeDeArquivo(titulo, formato));
}

/** Exporta um gráfico desenhado diretamente em `<canvas>` (rede de forças). */
export function baixarCanvas(
  canvas: HTMLCanvasElement | null | undefined,
  titulo: string,
  formato: FormatoImagem,
): boolean {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
  baixarDataUrl(canvasParaDataUrl(canvas, formato), nomeDeArquivo(titulo, formato));
  return true;
}
