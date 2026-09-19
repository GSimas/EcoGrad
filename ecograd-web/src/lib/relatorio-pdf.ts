/**
 * Desenho do relatório em PDF.
 *
 * Só esta camada conhece jsPDF. Ela recebe blocos prontos de `lib/relatorio` e
 * cuida de papel: margens, quebras, cabeçalho, rodapé e paginação.
 *
 * A biblioteca entra por `import()` dinâmico: são ~350 KB que só interessam a
 * quem clica em exportar, e carregá-los no bundle inicial pesaria em toda
 * visita que nunca vai gerar relatório nenhum.
 */
import type { Bloco, Relatorio, TemaRelatorio } from './relatorio';

/** A4 retrato, em milímetros — a unidade que o jsPDF usa aqui. */
const PAGINA = { largura: 210, altura: 297 };
const MARGEM = { topo: 18, base: 16, lado: 16 };
const UTIL = PAGINA.largura - MARGEM.lado * 2;

interface Paleta {
  texto: [number, number, number];
  fraco: [number, number, number];
  destaque: [number, number, number];
  linha: [number, number, number];
  fundo: [number, number, number] | null;
  faixa: [number, number, number];
}

/**
 * O tema claro é o padrão porque o destino natural de um PDF é o papel. O
 * escuro existe para quem quer o relatório igual ao que vê na tela.
 */
const PALETAS: Record<TemaRelatorio, Paleta> = {
  claro: { texto: [30, 41, 59], fraco: [100, 116, 139], destaque: [180, 83, 9], linha: [203, 213, 225], fundo: null, faixa: [241, 245, 249] },
  escuro: { texto: [226, 232, 240], fraco: [148, 163, 184], destaque: [243, 156, 18], linha: [51, 65, 85], fundo: [14, 17, 23], faixa: [30, 41, 59] },
};

/** Subconjunto do jsPDF que este módulo usa — evita `any` espalhado. */
interface Doc {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number }; getNumberOfPages: () => number };
  setFont: (nome: string, estilo?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  setLineWidth: (n: number) => void;
  text: (t: string | string[], x: number, y: number, o?: Record<string, unknown>) => void;
  splitTextToSize: (t: string, l: number) => string[];
  rect: (x: number, y: number, w: number, h: number, estilo?: string) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  addImage: (d: string, f: string, x: number, y: number, w: number, h: number, alias?: string, compressao?: string) => void;
  addPage: () => void;
  setPage: (n: number) => void;
  output: (tipo: string) => Blob;
  lastAutoTable?: { finalY?: number };
  setProperties: (p: Record<string, string>) => void;
}

/** Caneta: sabe onde está na página e quando precisa virar. */
class Caneta {
  y = MARGEM.topo;
  /**
   * Páginas já pintadas, por número absoluto. O fundo escuro é um retângulo
   * de página inteira: pintá-lo duas vezes apagaria o que já está desenhado.
   * A autotable abre páginas por conta própria no meio de uma tabela longa,
   * e avisa por um gancho que também dispara na página corrente — daí o
   * controle por número, e não por "acabei de virar".
   */
  private pintadas = new Set<number>();
  constructor(private doc: Doc, private paleta: Paleta) { this.pintarFundo(); }

  pintarFundo() {
    const f = this.paleta.fundo;
    if (!f) return;
    const pagina = this.doc.internal.getNumberOfPages();
    if (this.pintadas.has(pagina)) return;
    this.pintadas.add(pagina);
    this.doc.setFillColor(...f);
    this.doc.rect(0, 0, PAGINA.largura, PAGINA.altura, 'F');
  }

  /** Abre página nova quando `altura` não cabe no que resta. */
  garantir(altura: number) {
    if (this.y + altura <= PAGINA.altura - MARGEM.base) return;
    this.doc.addPage();
    this.pintarFundo();
    this.y = MARGEM.topo;
  }

  paragrafo(texto: string, { tamanho, cor, estilo = 'normal', espaco = 2, barra }: { tamanho: number; cor: [number, number, number]; estilo?: string; espaco?: number; barra?: [number, number, number] }) {
    this.doc.setFont('helvetica', estilo);
    this.doc.setFontSize(tamanho);
    this.doc.setTextColor(...cor);
    const linhas = this.doc.splitTextToSize(texto, UTIL);
    const alturaLinha = tamanho * 0.42;
    // Parágrafo longo quebra entre páginas linha a linha, e não inteiro: um
    // bloco de ressalvas de 15 linhas nunca caberia numa página só.
    for (const linha of linhas) {
      this.garantir(alturaLinha);
      // A barra da tarja é desenhada por linha, e não de uma vez do começo ao
      // fim: `line` desenha sempre na página corrente, e um trecho que cruza a
      // quebra deixaria a barra inteira na página errada, indo até o rodapé.
      if (barra) {
        this.doc.setDrawColor(...barra);
        this.doc.setLineWidth(0.6);
        this.doc.line(MARGEM.lado - 3, this.y - alturaLinha + 0.8, MARGEM.lado - 3, this.y + 0.8);
      }
      this.doc.text(linha, MARGEM.lado, this.y);
      this.y += alturaLinha;
    }
    this.y += espaco;
  }
}

/** Rodapé e paginação, escritos no fim, quando o total de páginas já é conhecido. */
function rodapes(doc: Doc, paleta: Paleta) {
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...paleta.fraco);
    doc.setDrawColor(...paleta.linha);
    doc.setLineWidth(0.2);
    const y = PAGINA.altura - MARGEM.base + 6;
    doc.line(MARGEM.lado, y - 3.5, PAGINA.largura - MARGEM.lado, y - 3.5);
    doc.text('EcoGrad · recorte local do Repositório Institucional da UFSC', MARGEM.lado, y);
    doc.text(`${p}/${total}`, PAGINA.largura - MARGEM.lado, y, { align: 'right' });
  }
}

export async function gerarPDF(relatorio: Relatorio, tema: TemaRelatorio): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const paleta = PALETAS[tema];
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' }) as unknown as Doc;
  doc.setProperties({ title: relatorio.titulo, creator: 'EcoGrad', subject: 'Relatório de análise do acervo da UFSC' });

  const caneta = new Caneta(doc, paleta);

  const desenhar = (bloco: Bloco) => {
    switch (bloco.tipo) {
      case 'pagina':
        doc.addPage();
        caneta.y = MARGEM.topo;
        caneta.pintarFundo();
        return;

      case 'titulo':
        caneta.garantir(16);
        caneta.paragrafo(bloco.texto, { tamanho: 18, cor: paleta.destaque, estilo: 'bold', espaco: 4 });
        return;

      case 'subtitulo':
        // Subtítulo sozinho no pé da página fica órfão do que anuncia.
        caneta.garantir(18);
        caneta.paragrafo(bloco.texto, { tamanho: 12, cor: paleta.texto, estilo: 'bold', espaco: 2.5 });
        return;

      case 'paragrafo':
        caneta.paragrafo(bloco.texto, { tamanho: 9.5, cor: paleta.texto });
        return;

      case 'nota':
        caneta.paragrafo(bloco.texto, { tamanho: 8, cor: paleta.fraco, espaco: 1.5 });
        return;

      case 'ia': {
        // Tarja: o texto de modelo de linguagem não pode se confundir com o
        // que foi apurado do acervo. É uma barra lateral, e não um retângulo:
        // o retângulo se perderia na quebra de página.
        caneta.garantir(20);
        const barra = paleta.destaque;
        caneta.paragrafo('TEXTO GERADO POR INTELIGÊNCIA ARTIFICIAL', { tamanho: 7.5, cor: paleta.destaque, estilo: 'bold', espaco: 1, barra });
        caneta.paragrafo('Pode conter erros, inclusive trabalhos e nomes inexistentes. Confira cada afirmação nas fontes antes de usá-la.', { tamanho: 7.5, cor: paleta.fraco, espaco: 2, barra });
        caneta.paragrafo(bloco.texto, { tamanho: 9, cor: paleta.texto, espaco: 3, barra });
        return;
      }

      case 'indicadores': {
        const porLinha = 4;
        const largura = UTIL / porLinha;
        for (let i = 0; i < bloco.itens.length; i += porLinha) {
          const faixa = bloco.itens.slice(i, i + porLinha);
          caneta.garantir(14);
          faixa.forEach((item, col) => {
            const x = MARGEM.lado + col * largura;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(...paleta.fraco);
            doc.text(doc.splitTextToSize(item.rotulo, largura - 3)[0] ?? '', x, caneta.y);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...paleta.texto);
            doc.text(doc.splitTextToSize(item.valor, largura - 3)[0] ?? '', x, caneta.y + 6);
          });
          caneta.y += 14;
        }
        caneta.y += 2;
        return;
      }

      case 'tabela': {
        // A legenda vem junto da tabela, e não solta: `garantir` reserva as
        // duas de uma vez para o título não ficar órfão no pé da página.
        caneta.garantir(30);
        caneta.paragrafo(bloco.titulo, { tamanho: 9, cor: paleta.texto, estilo: 'bold', espaco: 1 });
        autoTable(doc as never, {
          startY: caneta.y,
          head: [[...bloco.colunas]],
          body: bloco.linhas.map((l) => [...l]),
          margin: { left: MARGEM.lado, right: MARGEM.lado, top: MARGEM.topo, bottom: MARGEM.base + 6 },
          styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, textColor: paleta.texto, lineColor: paleta.linha, lineWidth: 0.1, overflow: 'linebreak' },
          headStyles: { fontStyle: 'bold', textColor: paleta.texto, fillColor: paleta.faixa },
          // As duas cores precisam ser declaradas. Pintar só a alternada deixa
          // a outra no branco padrão da autotable — no tema escuro isso dá
          // texto claro sobre linha clara, ilegível.
          bodyStyles: { fillColor: paleta.fundo ?? [255, 255, 255] },
          alternateRowStyles: { fillColor: paleta.faixa },
          // Cada página que a tabela abrir precisa do fundo antes das linhas.
          willDrawPage: () => caneta.pintarFundo(),
        });
        caneta.y = (doc.lastAutoTable?.finalY ?? caneta.y) + 3;
        if (bloco.nota) caneta.paragrafo(bloco.nota, { tamanho: 7.5, cor: paleta.fraco, espaco: 3 });
        return;
      }

      case 'imagem': {
        const largura = UTIL;
        const altura = Math.min(largura * bloco.proporcao, PAGINA.altura - MARGEM.topo - MARGEM.base - 10);
        caneta.garantir(altura + 2);
        // O formato vem do próprio dado: gráfico sai em JPEG por tamanho, mas
        // um PNG continua válido aqui.
        const formato = bloco.dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(bloco.dataUrl, formato, MARGEM.lado, caneta.y, largura, altura, undefined, 'MEDIUM');
        caneta.y += altura + 4;
        return;
      }
    }
  };

  for (const bloco of relatorio.capa) desenhar(bloco);
  if (relatorio.corpo.length > 0) desenhar({ tipo: 'pagina' });
  for (const bloco of relatorio.corpo) desenhar(bloco);

  rodapes(doc, paleta);
  return doc.output('blob');
}
