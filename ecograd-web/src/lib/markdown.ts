/**
 * Renderizador Markdown mínimo para as respostas do Consultor IA.
 *
 * Segurança: o texto é escapado ANTES de qualquer transformação, então nenhum
 * HTML vindo do modelo é interpretado. Só as marcações reconhecidas abaixo
 * viram tags, e apenas URLs http/https viram links (sempre `target="_blank"`
 * com `rel="noopener noreferrer"`, como exige a especificação).
 */

function escaparHtml(texto: string): string {
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

  for (const linha of linhas) {
    const t = linha.trim();

    if (t === '') {
      fecharParagrafo();
      fecharLista();
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
