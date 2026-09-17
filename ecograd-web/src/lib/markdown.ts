/**
 * Renderizador Markdown mínimo para as respostas do UFSCão, o consultor de IA.
 *
 * Segurança: o texto é escapado ANTES de qualquer transformação, então nenhum
 * HTML vindo do modelo é interpretado. Só as marcações reconhecidas abaixo
 * viram tags, e apenas URLs http/https viram links (sempre `target="_blank"`
 * com `rel="noopener noreferrer"`, como exige a especificação).
 */

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function urlSegura(url: string): string | null {
  const limpa = url.trim();
  return /^https?:\/\/[^\s<>"']+$/i.test(limpa) ? limpa : null;
}

function inline(texto: string): string {
  return texto
    // [rótulo](url) — abre o repositório da UFSC em nova aba
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_completo, rotulo: string, url: string) => {
      const href = urlSegura(url);
      if (!href) return rotulo;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${rotulo}</a>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

/** Linha de tabela: tem barra e algum conteúdo entre barras. */
const ehLinhaTabela = (t: string) => t.includes('|') && /\S/.test(t.replace(/\|/g, ''));
/** Separador do cabeçalho: `|---|:--:|`, com ou sem as barras das pontas. */
const ehSeparadorTabela = (t = '') => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(t.trim());

/** Células de uma linha, sem as barras das pontas. */
function celulas(linha: string): string[] {
  let t = linha.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

const alinhamento = (marca: string) => {
  const t = marca.trim();
  if (t.startsWith(':') && t.endsWith(':')) return ' style="text-align:center"';
  if (t.endsWith(':')) return ' style="text-align:right"';
  return '';
};

/**
 * Tabela em HTML. Vive num `div` com rolagem própria: tabela larga dentro do
 * balão do chat empurraria a conversa inteira para fora da tela.
 */
function tabelaHtml(cabecalho: string[], marcas: string[], corpo: string[][]): string {
  const alinhamentos = cabecalho.map((_, i) => alinhamento(marcas[i] ?? ''));
  const th = cabecalho.map((c, i) => `<th${alinhamentos[i]}>${inline(c)}</th>`).join('');
  const linhas = corpo.map((linha) => {
    // Linha curta ou longa demais não invalida a tabela: completa-se ao cabeçalho.
    const celulasDaLinha = cabecalho.map((_, i) => `<td${alinhamentos[i]}>${inline(linha[i] ?? '')}</td>`).join('');
    return `<tr>${celulasDaLinha}</tr>`;
  }).join('');
  return `<div class="eco-tabela-markdown"><table><thead><tr>${th}</tr></thead><tbody>${linhas}</tbody></table></div>`;
}

/** Converte um subconjunto de Markdown em HTML já sanitizado. */
export function markdownParaHtml(markdown: string): string {
  const linhas = escaparHtml(markdown).split('\n');
  const saida: string[] = [];
  let listaAberta: 'ul' | 'ol' | null = null;
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    if (paragrafo.length > 0) {
      saida.push(`<p>${inline(paragrafo.join(' '))}</p>`);
      paragrafo = [];
    }
  };
  const fecharLista = () => {
    if (listaAberta) {
      saida.push(`</${listaAberta}>`);
      listaAberta = null;
    }
  };

  for (let i = 0; i < linhas.length; i++) {
    const t = linhas[i].trim();

    if (t === '') {
      fecharParagrafo();
      fecharLista();
      continue;
    }

    // Tabela: só quando a linha seguinte é o separador do cabeçalho — sem isso,
    // qualquer frase com barra viraria tabela.
    if (ehLinhaTabela(t) && ehSeparadorTabela(linhas[i + 1])) {
      fecharParagrafo();
      fecharLista();
      const cabecalho = celulas(t);
      const marcas = celulas(linhas[i + 1]);
      const corpo: string[][] = [];
      let j = i + 2;
      for (; j < linhas.length && ehLinhaTabela(linhas[j].trim()); j++) corpo.push(celulas(linhas[j].trim()));
      saida.push(tabelaHtml(cabecalho, marcas, corpo));
      i = j - 1;
      continue;
    }

    const cabecalho = /^(#{1,4})\s+(.*)$/.exec(t);
    if (cabecalho) {
      fecharParagrafo();
      fecharLista();
      const nivel = Math.min(cabecalho[1].length + 2, 6);
      saida.push(`<h${nivel}>${inline(cabecalho[2])}</h${nivel}>`);
      continue;
    }

    const itemOrdenado = /^\d+[.)]\s+(.*)$/.exec(t);
    const itemLista = /^[-*+]\s+(.*)$/.exec(t);

    if (itemOrdenado || itemLista) {
      fecharParagrafo();
      const tipo = itemOrdenado ? 'ol' : 'ul';
      if (listaAberta !== tipo) {
        fecharLista();
        saida.push(`<${tipo}>`);
        listaAberta = tipo;
      }
      saida.push(`<li>${inline((itemOrdenado ?? itemLista)![1])}</li>`);
      continue;
    }

    fecharLista();
    paragrafo.push(t);
  }

  fecharParagrafo();
  fecharLista();
  return saida.join('\n');
}
