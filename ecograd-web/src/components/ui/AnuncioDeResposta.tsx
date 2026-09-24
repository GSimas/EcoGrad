import { useEffect, useRef, useState } from 'react';
import { markdownParaHtml } from '@/lib/markdown';

/** O texto corrido de uma resposta em markdown, como o leitor de tela deve ouvi-la. */
function textoDoMarkdown(markdown: string): string {
  const doc = new DOMParser().parseFromString(markdownParaHtml(markdown), 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Anuncia a leitores de tela a resposta do UFSCão quando ela termina de chegar,
 * uma vez e inteira.
 *
 * O texto em streaming não fica numa região viva: a cada trecho o conteúdo é
 * trocado, e o leitor releria o parágrafo inteiro — ou anunciaria pedaços de
 * palavra. Quem enxerga acompanha a escrita; quem ouve recebe a resposta pronta,
 * e continua podendo relê-la na conversa. Invisível e fora do fluxo (`sr-only`):
 * não ocupa espaço nem desloca nada na tela.
 */
export function AnuncioDeResposta({ total, ultima }: {
  /** Quantas respostas a conversa tem: o anúncio só acontece quando cresce. */
  total: number;
  /** A resposta mais recente, em markdown. */
  ultima?: string;
}) {
  const [texto, setTexto] = useState('');
  const anterior = useRef(total);
  useEffect(() => {
    if (total > anterior.current && ultima) setTexto(`Resposta do UFSCão: ${textoDoMarkdown(ultima)}`);
    anterior.current = total;
  }, [total, ultima]);
  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{texto}</div>;
}
