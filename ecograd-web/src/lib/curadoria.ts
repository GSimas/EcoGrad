import type { ItemExtracao } from './ia-state';
import type { OntologiaIA } from '../types';
import { CATEGORIAS_EVIDENCIA, type EvidenciaIA } from './ia-evidencias';

export type CategoriaTermo = EvidenciaIA['categoria'];
export interface DecisaoTermo {
  estado: 'aprovado' | 'rejeitado'; categoria: CategoriaTermo; termo: string;
  trecho: string; justificativa: string; quando: string;
}
export interface Curadoria { schema: 1; termos: Record<string, DecisaoTermo[]> }
export const ROTULOS_CATEGORIA = ['Teorias e modelos', 'Ferramentas e artefatos', 'Métodos e técnicas'];
export function propostas(item: ItemExtracao) {
  return CATEGORIAS_EVIDENCIA.flatMap(categoria => (item.ontologia?.[categoria] ?? []).map((termo, indice) => ({
    chave: JSON.stringify([categoria, indice]), categoria, termo,
    trecho: item.evidencias?.find(e => e.categoria === categoria && e.termo === termo)?.trecho ?? '',
  })));
}
export function decisaoAtual(item: ItemExtracao, chave: string) {
  if (item.curadoria && item.curadoria.schema !== 1) throw new Error('Versão da curadoria incompatível.');
  return item.curadoria?.termos[chave]?.at(-1);
}
export function validarDecisao(d: DecisaoTermo, resumo: string) {
  if (!d || !['aprovado','rejeitado'].includes(d.estado) || !CATEGORIAS_EVIDENCIA.includes(d.categoria) ||
      typeof d.termo !== 'string' || !d.termo.trim() || d.termo.length > 500 ||
      typeof d.justificativa !== 'string' || !d.justificativa.trim() || d.justificativa.length > 2000 ||
      typeof d.trecho !== 'string' || d.trecho.length > 1000 || !Number.isFinite(Date.parse(d.quando))) {
    throw new Error('Informe termo, categoria e justificativa válidos para registrar a decisão.');
  }
  if (d.estado === 'aprovado' && (d.trecho.trim().length < 10 || !resumo.includes(d.trecho))) {
    throw new Error('A aprovação exige um trecho literal do resumo, entre 10 e 1.000 caracteres.');
  }
}
export function resultadoCurado(item: ItemExtracao) {
  const ontologia: OntologiaIA = { teorias_e_modelos: [], ferramentas_e_artefatos: [], metodos_e_tecnicas: [] };
  let pendentes = 0, rejeitados = 0, aprovados = 0;
  for (const p of propostas(item)) {
    const d = decisaoAtual(item, p.chave);
    if (!d) { pendentes++; continue; }
    validarDecisao(d, item.fonte?.resumo ?? '');
    if (d.estado === 'rejeitado') { rejeitados++; continue; }
    if (ontologia[d.categoria].includes(d.termo)) throw new Error('Duas aprovações produzem o mesmo termo e categoria. Revise ou rejeite a duplicata.');
    ontologia[d.categoria].push(d.termo); aprovados++;
  }
  return { ontologia, pendentes, rejeitados, aprovados };
}
/** Append-only decisions; the model proposal and its evidence remain untouched. */
export function registrarDecisao(item: ItemExtracao, chave: string, decisao: DecisaoTermo): ItemExtracao {
  if (item.estado !== 'concluido' || !propostas(item).some(p => p.chave === chave)) throw new Error('Proposta não encontrada neste documento.');
  validarDecisao(decisao, item.fonte?.resumo ?? '');
  const historico = item.curadoria?.termos[chave] ?? [];
  if (historico.length >= 50) throw new Error('Limite de 50 decisões por termo. Exporte a revisão antes de prosseguir.');
  const next: ItemExtracao = { ...item, curadoria: { schema: 1, termos: { ...item.curadoria?.termos, [chave]: [...historico, { ...decisao }] } } };
  resultadoCurado(next);
  return next;
}
