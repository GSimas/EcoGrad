/**
 * O PDF de um trabalho, no repositório da UFSC.
 *
 * O EcoGrad não hospeda nem serve arquivo nenhum: o endereço aponta para o
 * repositório, e é o navegador de quem lê que vai buscá-lo lá. O controle de
 * acesso (embargo, restrição) continua sendo do repositório, e a estatística de
 * download também.
 *
 * A coleta grava o nome e a sequência (`coleta/coletar_ufsc.py`); o handle vem
 * da `url` do registro. A forma montada aqui é a que o DSpace serve inline —
 * sem `Content-Disposition: attachment`, que faria o navegador baixar em vez de
 * exibir.
 */
import type { ArquivoPdf, Documento } from '@/types';

const HOST_REPOSITORIO = 'repositorio.ufsc.br';
/** `123456789/272516` — os dois números do handle do DSpace. */
const HANDLE = /\/handle\/(\d+\/\d+)(?:[/?#]|$)/;

/**
 * Handle do DSpace na `url` do registro, ou `null`.
 *
 * Só aceita o host do repositório: o endereço montado a partir daqui vai para o
 * `src` de um iframe, e um registro com URL de outro domínio não pode decidir o
 * que a página embute. A forma antiga `/xmlui/handle/` também vale — ela ainda
 * aparece na base, vinda de coletas mais antigas.
 */
export function handleDoRegistro(url: string): string | null {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return null;
  }
  if (alvo.protocol !== 'https:' && alvo.protocol !== 'http:') return null;
  if (alvo.hostname !== HOST_REPOSITORIO) return null;
  return HANDLE.exec(alvo.pathname)?.[1] ?? null;
}

/** Endereço do PDF no repositório, ou `null` quando o registro não permite montá-lo. */
export function urlDoPdf(doc: Documento, arquivo: ArquivoPdf): string | null {
  const handle = handleDoRegistro(doc.url);
  if (!handle || !arquivo.n.trim() || !Number.isInteger(arquivo.s)) return null;
  return `https://${HOST_REPOSITORIO}/bitstream/handle/${handle}/${encodeURIComponent(arquivo.n)}?sequence=${arquivo.s}`;
}

/** `1,3 MB` — vazio quando o repositório não informou o tamanho. */
export function tamanhoLegivel(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export interface PdfDoTrabalho {
  arquivo: ArquivoPdf;
  url: string;
  /** O que aparece na lista quando o trabalho tem mais de um PDF. */
  rotulo: string;
}

/**
 * Os PDFs abertos do trabalho, na ordem do repositório.
 *
 * Um item pode ter mais de um — é comum o trabalho vir acompanhado da ata de
 * defesa assinada, ou de pranchas. Quem lê escolhe; o EcoGrad não tenta adivinhar
 * qual é "o" trabalho, porque o metadado não diz.
 */
export function pdfsDoTrabalho(doc: Documento): PdfDoTrabalho[] {
  return (doc.arquivos ?? []).flatMap((arquivo) => {
    const url = urlDoPdf(doc, arquivo);
    if (!url) return [];
    const tamanho = tamanhoLegivel(arquivo.b);
    return [{ arquivo, url, rotulo: tamanho ? `${arquivo.n} · ${tamanho}` : arquivo.n }];
  });
}

/**
 * Se vale embutir o PDF na própria página.
 *
 * Em navegador de celular o `<iframe>` de PDF costuma render em branco — iOS
 * nunca exibiu, e o Chrome do Android manda baixar. Ali abrir em outra aba, no
 * visualizador nativo, é o que de fato mostra o documento. A checagem é por
 * capacidade do ponteiro, não por string de User-Agent: um notebook com tela
 * sensível ao toque continua tendo `hover`, e embute normalmente.
 */
export function podeEmbutirPdf(combina: (consulta: string) => boolean): boolean {
  return !combina('(hover: none) and (pointer: coarse)');
}
