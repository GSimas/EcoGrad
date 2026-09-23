import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ExternalLink, FileText, X } from 'lucide-react';
import { pdfsDoTrabalho, podeEmbutirPdf, tamanhoLegivel, type PdfDoTrabalho } from '@/lib/pdf';
import type { Documento } from '@/types';

const combinaMedia = (consulta: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches;

/**
 * Abre o PDF do trabalho sem sair do EcoGrad.
 *
 * O arquivo vem do repositório da UFSC, direto para o navegador de quem lê:
 * nada é baixado, copiado ou reservido aqui. Quando o item tem mais de um PDF,
 * a escolha é de quem lê — o metadado não diz qual é o trabalho e qual é a ata
 * de defesa ou a prancha.
 */
export function VerPdf({ doc }: { doc: Documento }) {
  const pdfs = useMemo(() => pdfsDoTrabalho(doc), [doc]);
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState(0);
  if (!pdfs.length) return null;

  const atual = pdfs[Math.min(escolhido, pdfs.length - 1)];
  const unico = pdfs.length === 1;
  const tamanho = unico ? tamanhoLegivel(atual.arquivo.b) : '';
  const embutir = podeEmbutirPdf(combinaMedia);

  return (
    <Dialog.Root open={aberto} onOpenChange={(v) => { setAberto(v); if (v) setEscolhido(0); }}>
      <Dialog.Trigger className="btn min-h-11 text-eco-accent">
        <FileText size={15} aria-hidden className="mr-1.5 inline-block align-text-bottom" />
        Ver PDF{tamanho && ` · ${tamanho}`}
        <span className="sr-only">: {doc.titulo}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="eco-dialog-overlay fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-modal="true"
          className="eco-dialog-content fixed left-1/2 top-1/2 z-50 flex h-[92dvh] w-[min(64rem,96vw)]
            -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl
            border border-eco-border bg-eco-panel shadow-2xl shadow-black/60 focus:outline-none"
        >
          <header className="flex items-start gap-3 border-b border-eco-border p-3 sm:p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-eco-accent/15 text-eco-accent">
              <FileText size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="line-clamp-2 text-sm font-semibold text-slate-100">
                {doc.titulo || 'Trabalho sem título'}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-400">
                Arquivo servido pelo Repositório Institucional da UFSC. O EcoGrad não hospeda o documento;
                o acesso, quando restrito, continua sendo decidido lá.
              </Dialog.Description>
            </div>
            <a
              className="btn min-h-11 shrink-0 text-eco-accent"
              href={atual.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={15} aria-hidden className="mr-1.5 inline-block align-text-bottom" />
              Nova aba
            </a>
            <Dialog.Close
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/5 hover:text-slate-200"
              aria-label="Fechar o PDF"
            >
              <X size={18} aria-hidden />
            </Dialog.Close>
          </header>

          {pdfs.length > 1 && (
            <div className="space-y-2 border-b border-eco-border p-3 sm:p-4">
              <p className="text-xs text-slate-400">
                Este registro tem {pdfs.length} arquivos no repositório. Qual deles é o trabalho, e qual é
                ata de defesa ou prancha, o metadado não informa.
              </p>
              <div role="group" aria-label="Arquivos deste registro" className="flex flex-wrap gap-2">
                {pdfs.map((pdf, i) => (
                  <button
                    key={`${pdf.arquivo.s}-${pdf.arquivo.n}`}
                    type="button"
                    className="btn min-h-11 max-w-full"
                    aria-pressed={i === escolhido}
                    onClick={() => setEscolhido(i)}
                  >
                    <span className="block truncate text-xs">{pdf.rotulo}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!embutir ? (
            <EmNovaAba pdf={atual} motivo="Neste navegador o PDF não abre dentro da página. Ele abre no visualizador do seu aparelho." />
          ) : !atual.exibivel ? (
            <EmNovaAba
              pdf={atual}
              motivo="O repositório envia arquivos acima de 8 MB como download, e não para exibir — é uma configuração do servidor da UFSC. Este abre no visualizador do seu computador."
            />
          ) : (
            <iframe
              // `key` força o iframe a recarregar ao trocar de arquivo: sem ele o
              // navegador mantém o PDF anterior no visualizador nativo.
              key={atual.url}
              src={atual.url}
              title={`PDF: ${atual.arquivo.n}`}
              className="min-h-0 flex-1 bg-white"
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * O que aparece no lugar do PDF quando ele não abre embutido — em navegador de
 * celular, ou quando o repositório manda o arquivo como download. Não é um erro a
 * esconder: é o caminho que funciona ali, dito com todas as letras, em vez de um
 * quadro branco que não explica nada.
 */
function EmNovaAba({ pdf, motivo }: { pdf: PdfDoTrabalho; motivo: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <FileText size={40} aria-hidden className="text-eco-accent" />
      <p className="max-w-prose text-sm text-slate-200">{motivo}</p>
      <a className="btn btn-primary min-h-11" href={pdf.url} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={15} aria-hidden className="mr-1.5 inline-block align-text-bottom" />
        Abrir {pdf.arquivo.n}
      </a>
      {pdf.arquivo.b ? <p className="text-xs text-slate-400">{tamanhoLegivel(pdf.arquivo.b)}</p> : null}
    </div>
  );
}
