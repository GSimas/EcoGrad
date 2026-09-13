import { useEcoGradStore } from '../stores/useEcoGradStore';
import { indexarDocumentos } from '../lib/ontologia-importacao';
import { hashResumo } from '../lib/ia-evidencias';
import { registrarDecisao, resultadoCurado, type DecisaoTermo } from '../lib/curadoria';
import { parseOntologia } from '../lib/foresight-math';
import type { OntologiaIA } from '../types';

export async function decidirTermo(id: string, chave: string, decisao: Omit<DecisaoTermo, 'quando'>) {
  const s = useEcoGradStore.getState(), lote = s.ia.lote;
  if (!lote || lote.aplicado || lote.estado === 'executando' || lote.baseVersion !== s.baseVersion) throw new Error('Lote indisponível para curadoria.');
  const matches = (await indexarDocumentos(s.docs)).filter(x => x.id === id);
  const itens = lote.itens.filter(i => i.id === id);
  if (matches.length !== 1 || itens.length !== 1) throw new Error('Identidade ausente ou ambígua.');
  const d = matches[0].documento, item = itens[0], resumoSha256 = await hashResumo(d.resumo);
  if (item.fonte && (item.fonte.resumo !== d.resumo || item.fonte.resumoSha256 !== resumoSha256 || item.fonte.titulo !== d.titulo || item.fonte.url !== d.url)) throw new Error('A fonte mudou desde a extração. Não é possível aprovar sobre outro resumo.');
  const next = registrarDecisao({ ...item, fonte: item.fonte ?? { origem: 'curadoria', titulo: d.titulo, url: d.url, resumo: d.resumo, resumoSha256 } }, chave, { ...decisao, quando: new Date().toISOString() });
  const atual = useEcoGradStore.getState();
  if (atual.analysisId !== s.analysisId || atual.docs !== s.docs || atual.ia.lote !== lote || atual.baseVersion !== s.baseVersion) throw new Error('A análise ou revisão mudou. Tente novamente.');
  atual.setIA({ lote: { ...lote, itens: lote.itens.map(i => i.id === id ? next : i) } });
}

/** Commit approved projections only. Revalidate the exact review after all asynchronous work. */
export async function aplicarCuradoria(guard: () => void) {
  const s = useEcoGradStore.getState(), lote = s.ia.lote;
  if (!lote || lote.aplicado || lote.estado === 'executando' || lote.baseVersion !== s.baseVersion) throw new Error('Lote indisponível para aplicação.');
  const check = () => {
    guard(); const atual = useEcoGradStore.getState();
    if (atual.analysisId !== s.analysisId || atual.docs !== s.docs || atual.ia.lote !== lote || atual.baseVersion !== s.baseVersion) throw new Error('A análise ou curadoria mudou. Revise novamente antes de aplicar.');
  };
  check();
  const index = await indexarDocumentos(s.docs), mapa = new Map<string, OntologiaIA>();
  for (const item of lote.itens.filter(i => i.estado === 'concluido')) {
    const result = resultadoCurado(item);
    if (result.pendentes) throw new Error('Decida todos os termos propostos antes de aplicar o lote.');
    if (!result.aprovados) continue;
    const matches = index.filter(x => x.id === item.id);
    if (matches.length !== 1 || mapa.has(item.id)) throw new Error('Identidade ausente ou ambígua na aplicação.');
    const doc = matches[0].documento;
    if (!item.fonte || item.fonte.resumo !== doc.resumo || item.fonte.resumoSha256 !== await hashResumo(doc.resumo) || item.fonte.titulo !== doc.titulo || item.fonte.url !== doc.url) throw new Error('A fonte mudou desde a revisão.');
    if (parseOntologia(doc.ontologia_ia)) throw new Error('O documento já foi enriquecido. A curadoria não substitui resultados existentes silenciosamente.');
    mapa.set(item.id, result.ontologia);
  }
  if (!mapa.size) throw new Error('Nenhum termo aprovado para aplicar. A análise permanece inalterada.');
  check();
  const n = await s.aplicarOntologia(mapa, false, check);
  useEcoGradStore.getState().setIA({ lote: { ...lote, aplicado: true } });
  return n;
}
