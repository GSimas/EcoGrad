/**
 * Planilha XLSX mínima, sem dependência: um zip sem compressão com as partes
 * OOXML obrigatórias e células em texto embutido (`inlineStr`). Texto embutido
 * nunca vira fórmula, então não precisa da proteção que o CSV aplica.
 * ponytail: zip "stored" (sem deflate) — arquivos maiores que o necessário;
 * comprimir com `pako.deflateRaw` (já instalado) se o tamanho incomodar.
 */
export type Celula = string | number | null | undefined;
export interface Aba { nome: string; linhas: Celula[][] }

const xml = (s: string) => s
  // Caracteres de controle são proibidos em XML 1.0; o Excel recusa o arquivo inteiro.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const coluna = (i: number): string => (i >= 26 ? coluna(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));

function planilha(linhas: Celula[][]): string {
  const corpo = linhas.map((linha, r) => `<row r="${r + 1}">${linha.map((v, c) => {
    const ref = `${coluna(c)}${r + 1}`;
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    // 32.767 caracteres é o teto de uma célula no Excel.
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v).slice(0, 32767))}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${corpo}</sheetData></worksheet>`;
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Uint8Array) => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function zip(arquivos: Array<[nome: string, conteudo: string]>): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;
  for (const [nome, conteudo] of arquivos) {
    const n = enc.encode(nome), d = enc.encode(conteudo), crc = crc32(d);
    const local = new Uint8Array(30 + n.length + d.length), lv = new DataView(local.buffer);
    // assinatura, versão 2.0, flag UTF-8, método 0 (stored), data 1980-01-01
    lv.setUint32(0, 0x04034B50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, d.length, true); lv.setUint32(22, d.length, true); lv.setUint16(26, n.length, true);
    local.set(n, 30); local.set(d, 30 + n.length);
    const central = new Uint8Array(46 + n.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014B50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, d.length, true); cv.setUint32(24, d.length, true); cv.setUint16(28, n.length, true);
    cv.setUint32(42, deslocamento, true); central.set(n, 46);
    locais.push(local); centrais.push(central); deslocamento += local.length;
  }
  const tamanhoCentral = centrais.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22), fv = new DataView(fim.buffer);
  fv.setUint32(0, 0x06054B50, true); fv.setUint16(8, arquivos.length, true); fv.setUint16(10, arquivos.length, true);
  fv.setUint32(12, tamanhoCentral, true); fv.setUint32(16, deslocamento, true);
  const saida = new Uint8Array(deslocamento + tamanhoCentral + 22);
  let p = 0;
  for (const parte of [...locais, ...centrais, fim]) { saida.set(parte, p); p += parte.length; }
  return saida;
}

export function gerarXlsx(abas: Aba[]): Uint8Array<ArrayBuffer> {
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  // Nome de aba: até 31 caracteres, sem []:*?/\
  const nomes = abas.map((a) => a.nome.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Planilha');
  return zip([
    ['[Content_Types].xml', `${cab}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${cab}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets>${nomes.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`],
    ...abas.map((a, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, planilha(a.linhas)]),
  ]);
}
