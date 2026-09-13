import { useEffect, useMemo, useRef } from 'react';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { FonteMemes } from '@/lib/memetics';
import { trabalhosDoTermo } from '@/lib/visualizacao-termos';
import type { TipoForesight } from '@/types';
import { Trabalhos } from './Trabalhos';

/** Uses the same extractors as each analysis: title tokens and AI artifacts are not keywords. */
export function TrabalhosDoTermo({ termo, fonteMemes, tipoForesight, redeMemetica = false, onFechar }: {
  redeMemetica?: boolean; termo: string | null; fonteMemes?: FonteMemes; tipoForesight?: TipoForesight; onFechar: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const anterior = useRef(termo);
  useEffect(()=>{if(termo && anterior.current!==termo) heading.current?.focus(); anterior.current=termo;},[termo]);
  const docs = useEcoGradStore((s) => s.docs);
  const relacionados = useMemo(() => termo ? trabalhosDoTermo(docs,termo,fonteMemes ? {modo:redeMemetica?'rede':'propagacao',fonte:fonteMemes} : {modo:'foresight',tipo:tipoForesight??'Palavra-chave'}) : [], [docs, termo, fonteMemes, tipoForesight, redeMemetica]);
  if (!termo) return null;
  return <section className="card space-y-3" aria-label={`Trabalhos do termo ${termo}`}>
    <h3 ref={heading} tabIndex={-1} className="break-words text-lg font-semibold">Trabalhos do termo: {termo}</h3>
    <p className="text-sm text-slate-300">Relação verificada pelo extrator da análise ({redeMemetica ? "rede memética: " : ""}{fonteMemes ?? tipoForesight}). Este conjunto usa todos os anos da base carregada. Tokens de títulos e artefatos de IA não são necessariamente palavras-chave autorais. As contagens científicas podem agrupar títulos iguais.</p>
    <button className="btn" type="button" onClick={onFechar}>Fechar trabalhos do termo</button>
    <Trabalhos docs={relacionados} titulo="Trabalhos relacionados ao termo" sessionKey="grafico.termo.trabalhos" />
  </section>;
}
