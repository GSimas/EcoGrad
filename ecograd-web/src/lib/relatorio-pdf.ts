/**
 * Desenho do relatório em PDF.
 *
 * Só esta camada conhece jsPDF. Ela recebe blocos prontos de `lib/relatorio` e
 * cuida de papel: margens, quebras, cabeçalho, rodapé e paginação.
 *
 * A biblioteca entra por `import()` dinâmico: são ~350 KB que só interessam a
 * quem clica em exportar, e carregá-los no bundle inicial pesaria em toda
 * visita que nunca vai gerar relatório nenhum.
 *
 * A estética é a da interface (identidade Scientata): papel e tinta, um acento
 * só, cantos retos, rótulos técnicos em mono e caixa alta, e seções numeradas.
 * O jsPDF só traz as fontes-padrão do PDF, e embutir as da interface pesaria
 * no arquivo; por isso Helvetica faz o papel da Manrope, Courier o da DM Mono e
 * Times itálico o da Instrument Serif.
 */
import { FUNDO_DO_RELATORIO, type Bloco, type Relatorio, type TemaRelatorio } from './relatorio';

/** A4 retrato, em milímetros — a unidade que o jsPDF usa aqui. */
const PAGINA = { largura: 210, altura: 297 };
const MARGEM = { topo: 22, base: 18, lado: 18 };
const UTIL = PAGINA.largura - MARGEM.lado * 2;

type Cor = [number, number, number];
interface Paleta {
  texto: Cor;
  fraco: Cor;
  destaque: Cor;
  linha: Cor;
  fundo: Cor;
  faixa: Cor;
}

const rgb = (hex: string): Cor => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Cor;

/**
 * As mesmas paletas da interface. O claro é o padrão porque o destino natural
 * de um PDF é o papel — aqui, o papel quente do EcoGrad, com o verde-petróleo
 * de acento. O escuro é tinta com o limão-sinal, igual à tela.
 */
const PALETAS: Record<TemaRelatorio, Paleta> = {
  claro: { texto: [7, 17, 15], fraco: [77, 89, 84], destaque: [35, 110, 94], linha: [207, 207, 199], fundo: rgb(FUNDO_DO_RELATORIO.claro), faixa: [232, 229, 219] },
  escuro: { texto: [240, 238, 230], fraco: [156, 167, 162], destaque: [184, 255, 74], linha: [44, 56, 52], fundo: rgb(FUNDO_DO_RELATORIO.escuro), faixa: [13, 28, 23] },
};

const SANS = 'helvetica';
const MONO = 'courier';
const SERIFA = 'times';
/** Entreletra dos rótulos mono, em mm. */
const ENTRELETRA = 0.3;

/**
 * Texto mono em caixa alta. O `align: 'right'` do jsPDF não conta o
 * espaçamento entre letras, e o texto alinhado à direita passava da margem:
 * a largura é medida aqui, com o espaçamento, e o texto sai sempre da esquerda.
 */
function escreverMono(doc: Doc, texto: string, x: number, y: number, { cor, tamanho = 6.5, entreletra = ENTRELETRA, direita = false }: { cor: Cor; tamanho?: number; entreletra?: number; direita?: boolean }) {
  const t = texto.toLocaleUpperCase('pt-BR');
  doc.setFont(MONO, 'normal');
  doc.setFontSize(tamanho);
  doc.setTextColor(...cor);
  doc.setCharSpace(entreletra);
  const largura = doc.getTextWidth(t) + entreletra * Math.max(0, t.length - 1);
  doc.text(t, direita ? x - largura : x, y);
  doc.setCharSpace(0);
}

/** Quebra um rótulo mono na largura dada, medindo na fonte e no espaçamento dele. */
function linhasMono(doc: Doc, texto: string, largura: number, tamanho: number): string[] {
  doc.setFont(MONO, 'normal');
  doc.setFontSize(tamanho);
  const t = texto.toLocaleUpperCase('pt-BR');
  // Cada caractere mono tem a mesma largura: o espaçamento entra como parte dela.
  const porCaractere = doc.getTextWidth('M') + ENTRELETRA;
  return doc.splitTextToSize(t, largura * (doc.getTextWidth('M') / porCaractere));
}

/** Subconjunto do jsPDF que este módulo usa — evita `any` espalhado. */
interface Doc {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number }; getNumberOfPages: () => number };
  setFont: (nome: string, estilo?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  setLineWidth: (n: number) => void;
  setCharSpace: (n: number) => void;
  getTextWidth: (t: string) => number;
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
  link: (x: number, y: number, w: number, h: number, o: { url: string }) => void;
}

/** O que a autotable passa aos ganchos de célula — só o que é usado aqui. */
interface CelulaTabela {
  section: 'head' | 'body' | 'foot';
  row: { index: number };
  column: { index: number };
  cell: {
    x: number; y: number; width: number; height: number;
    padding: (lado: 'top' | 'left') => number;
    text: string[];
    styles: { textColor: unknown; fontSize: number; valign: string };
  };
}

/** Link da célula, se a coluna dela tem links e a linha tem um endereço. */
function urlDaCelula(bloco: Extract<Bloco, { tipo: 'tabela' }>, d: CelulaTabela): string | null {
  if (d.section !== 'body' || !bloco.links || d.column.index !== bloco.links.coluna) return null;
  return bloco.links.urls[d.row.index] ?? null;
}

/**
 * Sublinha cada linha do texto da célula. A autotable não sublinha, e a
 * posição da linha de base vem das mesmas medidas que ela usou para escrever:
 * alinhamento ao topo, altura de linha 1,15 × corpo.
 */
function sublinhar(doc: Doc, d: CelulaTabela, cor: Cor) {
  const pt = 25.4 / 72;
  const corpo = d.cell.styles.fontSize * pt;
  const entrelinha = corpo * 1.15;
  const x = d.cell.x + d.cell.padding('left');
  const topo = d.cell.y + d.cell.padding('top');
  doc.setFont(SANS, 'normal');
  doc.setFontSize(d.cell.styles.fontSize);
  doc.setDrawColor(...cor);
  doc.setLineWidth(0.15);
  d.cell.text.forEach((linha, i) => {
    const y = topo + corpo * 0.95 + i * entrelinha + 0.35;
    doc.line(x, y, x + doc.getTextWidth(linha), y);
  });
}

/** Caneta: sabe onde está na página e quando precisa virar. */
class Caneta {
  y = MARGEM.topo;
  /**
   * Páginas já pintadas, por número absoluto. O fundo é um retângulo de página
   * inteira: pintá-lo duas vezes apagaria o que já está desenhado. A autotable
   * abre páginas por conta própria no meio de uma tabela longa, e avisa por um
   * gancho que também dispara na página corrente — daí o controle por número,
   * e não por "acabei de virar".
   */
  private pintadas = new Set<number>();
  constructor(private doc: Doc, private paleta: Paleta) { this.pintarFundo(); }

  pintarFundo() {
    const pagina = this.doc.internal.getNumberOfPages();
    if (this.pintadas.has(pagina)) return;
    this.pintadas.add(pagina);
    this.doc.setFillColor(...this.paleta.fundo);
    this.doc.rect(0, 0, PAGINA.largura, PAGINA.altura, 'F');
  }

  /** Abre página nova quando `altura` não cabe no que resta. */
  garantir(altura: number) {
    if (this.y + altura <= PAGINA.altura - MARGEM.base) return;
    this.doc.addPage();
    this.pintarFundo();
    this.y = MARGEM.topo;
  }

  paragrafo(texto: string, { tamanho, cor, fonte = SANS, estilo = 'normal', espaco = 2, barra, recuo = 0 }: { tamanho: number; cor: Cor; fonte?: string; estilo?: string; espaco?: number; barra?: Cor; recuo?: number }) {
    this.doc.setFont(fonte, estilo);
    this.doc.setFontSize(tamanho);
    this.doc.setTextColor(...cor);
    const linhas = this.doc.splitTextToSize(texto, UTIL - recuo);
    const alturaLinha = tamanho * 0.45;
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
      this.doc.text(linha, MARGEM.lado + recuo, this.y);
      this.y += alturaLinha;
    }
    this.y += espaco;
  }

  /** Rótulo técnico: mono, caixa alta e entreletra aberta, como os sobretítulos da interface. */
  rotulo(texto: string, x: number, y: number, { cor, tamanho = 6.5, entreletra = ENTRELETRA }: { cor: Cor; tamanho?: number; entreletra?: number }) {
    escreverMono(this.doc, texto, x, y, { cor, tamanho, entreletra });
  }

  /** Sobretítulo com traço de acento à esquerda: "—— ECOGRAD / RELATÓRIO". */
  sobretitulo(texto: string) {
    this.doc.setDrawColor(...this.paleta.destaque);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGEM.lado, this.y - 1.2, MARGEM.lado + 9, this.y - 1.2);
    this.rotulo(texto, MARGEM.lado + 12, this.y, { cor: this.paleta.fraco });
    this.y += 6;
  }
}

/** Cabeçalho das páginas internas, rodapé e paginação — escritos no fim, quando o total já é conhecido. */
function moldura(doc: Doc, paleta: Paleta, titulo: string) {
  const total = doc.internal.getNumberOfPages();
  const dois = (n: number) => String(n).padStart(2, '0');
  const mono = (texto: string, x: number, y: number, alinhar?: 'right') =>
    escreverMono(doc, texto, x, y, { cor: paleta.fraco, direita: alinhar === 'right' });
  // A marca já está à esquerda; à direita, só o que distingue este relatório (o carimbo).
  const complemento = titulo.split(' · ').filter((parte) => parte !== 'EcoGrad').join(' · ');
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...paleta.linha);
    doc.setLineWidth(0.2);
    // A capa fica sem cabeçalho: ela já é o título.
    if (p > 1) {
      mono('EcoGrad / Relatório', MARGEM.lado, 12);
      mono(complemento, PAGINA.largura - MARGEM.lado, 12, 'right');
      doc.line(MARGEM.lado, 14.5, PAGINA.largura - MARGEM.lado, 14.5);
    }
    const y = PAGINA.altura - MARGEM.base + 8;
    doc.line(MARGEM.lado, y - 3.5, PAGINA.largura - MARGEM.lado, y - 3.5);
    mono('EcoGrad · recorte local do Repositório Institucional da UFSC', MARGEM.lado, y);
    mono(`${dois(p)} / ${dois(total)}`, PAGINA.largura - MARGEM.lado, y, 'right');
  }
}

export async function gerarPDF(relatorio: Relatorio, tema: TemaRelatorio): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const paleta = PALETAS[tema];
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' }) as unknown as Doc;
  doc.setProperties({ title: relatorio.titulo, creator: 'EcoGrad', subject: 'Relatório de análise do acervo da UFSC' });

  const caneta = new Caneta(doc, paleta);
  /** Numeração das seções, como os "01 · 02" da identidade. Recomeça a cada título. */
  let secao = 0;

  /**
   * Marca da capa: "Eco" em Helvetica e "Grad" em serifa itálica no acento —
   * o mesmo gesto do título da interface. O texto do bloco é "EcoGrad · resto".
   */
  const capa = (texto: string) => {
    const [marca, ...resto] = texto.split(' · ');
    caneta.y = MARGEM.topo + 18;
    caneta.sobretitulo('Ecologia do Conhecimento · UFSC');
    caneta.y += 10;
    const tamanho = 46;
    const base = marca.replace(/Grad$/, '');
    doc.setFont(SANS, 'normal');
    doc.setFontSize(tamanho);
    doc.setTextColor(...paleta.texto);
    doc.text(base, MARGEM.lado, caneta.y);
    const largura = doc.getTextWidth(base);
    if (marca.endsWith('Grad')) {
      doc.setFont(SERIFA, 'italic');
      doc.setTextColor(...paleta.destaque);
      doc.text('Grad', MARGEM.lado + largura + 0.5, caneta.y);
    }
    caneta.y += 12;
    if (resto.length) caneta.paragrafo(resto.join(' · '), { tamanho: 15, cor: paleta.texto, espaco: 10 });
    doc.setDrawColor(...paleta.linha);
    doc.setLineWidth(0.2);
    doc.line(MARGEM.lado, caneta.y - 4, PAGINA.largura - MARGEM.lado, caneta.y - 4);
    caneta.y += 4;
  };

  const desenhar = (bloco: Bloco, naCapa = false) => {
    switch (bloco.tipo) {
      case 'pagina':
        doc.addPage();
        caneta.y = MARGEM.topo;
        caneta.pintarFundo();
        return;

      case 'titulo':
        if (naCapa && bloco.texto.startsWith('EcoGrad')) { capa(bloco.texto); return; }
        caneta.garantir(24);
        secao = 0;
        caneta.sobretitulo('EcoGrad / Relatório');
        // A linha de base é o `y`: o texto grande sobe acima dela e cobriria o sobretítulo.
        caneta.y += 4;
        if (bloco.url) {
          // Título de documento: o bloco inteiro do título vira link para a fonte.
          const inicio = caneta.y;
          const pagina = doc.internal.getNumberOfPages();
          caneta.paragrafo(bloco.texto, { tamanho: 20, cor: paleta.destaque, estilo: 'bold', espaco: 1.5 });
          const aviso = caneta.y;
          caneta.paragrafo('Abrir no Repositório Institucional da UFSC', { tamanho: 7.5, cor: paleta.fraco, espaco: 5 });
          // Do topo do título ao fim do aviso; se uma quebra de página cortou o
          // bloco, o retângulo cairia na página errada — aí fica sem área.
          if (doc.internal.getNumberOfPages() === pagina) doc.link(MARGEM.lado, inicio - 7, UTIL, aviso - inicio + 8, { url: bloco.url });
          return;
        }
        caneta.paragrafo(bloco.texto, { tamanho: 20, cor: paleta.texto, estilo: 'bold', espaco: 5 });
        return;

      case 'subtitulo': {
        // Subtítulo sozinho no pé da página fica órfão do que anuncia.
        caneta.garantir(20);
        secao += 1;
        caneta.y += 2;
        caneta.rotulo(String(secao).padStart(2, '0'), MARGEM.lado, caneta.y, { cor: paleta.destaque, tamanho: 8, entreletra: 0 });
        caneta.paragrafo(bloco.texto, { tamanho: 12.5, cor: paleta.texto, estilo: 'bold', espaco: 3, recuo: 9 });
        return;
      }

      case 'paragrafo':
        caneta.paragrafo(bloco.texto, { tamanho: 9.5, cor: paleta.texto });
        return;

      case 'nota':
        caneta.paragrafo(bloco.texto, { tamanho: 8, cor: paleta.fraco, espaco: 1.8 });
        return;

      case 'ia': {
        // Tarja: o texto de modelo de linguagem não pode se confundir com o
        // que foi apurado do acervo. É uma barra lateral, e não um retângulo:
        // o retângulo se perderia na quebra de página.
        caneta.garantir(20);
        const barra = paleta.destaque;
        caneta.paragrafo('TEXTO GERADO POR INTELIGÊNCIA ARTIFICIAL', { tamanho: 7, fonte: MONO, cor: paleta.destaque, estilo: 'bold', espaco: 1, barra });
        caneta.paragrafo('Pode conter erros, inclusive trabalhos e nomes inexistentes. Confira cada afirmação nas fontes antes de usá-la.', { tamanho: 7.5, cor: paleta.fraco, espaco: 2, barra });
        caneta.paragrafo(bloco.texto, { tamanho: 9, cor: paleta.texto, espaco: 3, barra });
        return;
      }

      case 'indicadores': {
        // Cartões retos com filete, como os indicadores da interface.
        const porLinha = 4;
        const vao = 3;
        const largura = (UTIL - vao * (porLinha - 1)) / porLinha;
        const altura = 19;
        for (let i = 0; i < bloco.itens.length; i += porLinha) {
          const faixa = bloco.itens.slice(i, i + porLinha);
          caneta.garantir(altura + vao);
          faixa.forEach((item, col) => {
            const x = MARGEM.lado + col * (largura + vao);
            doc.setFillColor(...paleta.faixa);
            doc.setDrawColor(...paleta.linha);
            doc.setLineWidth(0.2);
            doc.rect(x, caneta.y, largura, altura, 'FD');
            linhasMono(doc, item.rotulo, largura - 6, 6).slice(0, 2)
              .forEach((linha, n) => caneta.rotulo(linha, x + 3, caneta.y + 5 + n * 2.8, { cor: paleta.fraco, tamanho: 6 }));
            doc.setFont(SANS, 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...paleta.texto);
            doc.text(doc.splitTextToSize(item.valor, largura - 6)[0] ?? '', x + 3, caneta.y + 15);
          });
          caneta.y += altura + vao;
        }
        caneta.y += 3;
        return;
      }

      case 'tabela': {
        // A legenda vem junto da tabela, e não solta: `garantir` reserva as
        // duas de uma vez para o título não ficar órfão no pé da página.
        caneta.garantir(30);
        caneta.paragrafo(bloco.titulo, { tamanho: 9, cor: paleta.texto, estilo: 'bold', espaco: 1.5 });
        autoTable(doc as never, {
          startY: caneta.y,
          head: [bloco.colunas.map((c) => c.toLocaleUpperCase('pt-BR'))],
          body: bloco.linhas.map((l) => [...l]),
          margin: { left: MARGEM.lado, right: MARGEM.lado, top: MARGEM.topo, bottom: MARGEM.base + 6 },
          styles: { font: SANS, fontSize: 7.5, cellPadding: 1.8, textColor: paleta.texto, lineColor: paleta.linha, lineWidth: 0.1, overflow: 'linebreak' },
          // Cabeçalho como o das tabelas da interface: mono em caixa alta.
          headStyles: { font: MONO, fontStyle: 'normal', fontSize: 6.5, textColor: paleta.fraco, fillColor: paleta.faixa },
          // As duas cores precisam ser declaradas. Pintar só a alternada deixa
          // a outra no branco padrão da autotable — sobre o papel ou a tinta
          // isso dá uma faixa branca no meio da página.
          bodyStyles: { fillColor: paleta.fundo },
          alternateRowStyles: { fillColor: paleta.faixa },
          // Cada página que a tabela abrir precisa do fundo antes das linhas.
          willDrawPage: () => caneta.pintarFundo(),
          // Título com link: na cor do acento e sublinhado, como um link da
          // interface, e a célula inteira clicável. Sem link, fica texto comum.
          didParseCell: (d: CelulaTabela) => {
            if (urlDaCelula(bloco, d)) d.cell.styles.textColor = paleta.destaque;
          },
          didDrawCell: (d: CelulaTabela) => {
            const url = urlDaCelula(bloco, d);
            if (!url) return;
            doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url });
            sublinhar(doc, d, paleta.destaque);
          },
        } as never);
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

  for (const bloco of relatorio.capa) desenhar(bloco, true);
  if (relatorio.corpo.length > 0) desenhar({ tipo: 'pagina' });
  for (const bloco of relatorio.corpo) desenhar(bloco);

  moldura(doc, paleta, relatorio.titulo);
  return doc.output('blob');
}
