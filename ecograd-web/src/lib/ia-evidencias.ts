import type { OntologiaIA } from '../types';
export const CATEGORIAS_EVIDENCIA = ['teorias_e_modelos','ferramentas_e_artefatos','metodos_e_tecnicas'] as const;
export interface EvidenciaIA { categoria: typeof CATEGORIAS_EVIDENCIA[number]; termo: string; trecho: string }
export interface FonteExtracao { origem?: 'extracao' | 'curadoria'; titulo: string; url: string; resumo: string; resumoSha256: string }
/** Exact excerpts establish provenance, not scientific correctness of classification. */
export function validarEvidencias(ontologia: OntologiaIA, value: unknown, resumo: string): EvidenciaIA[] {
  if (!Array.isArray(value) || value.length > 300) throw new Error('Extração sem evidências válidas.');
  const keys = new Set<string>();
  for (const e of value) {
    if (!e || !CATEGORIAS_EVIDENCIA.includes(e.categoria) || typeof e.termo !== 'string' ||
      typeof e.trecho !== 'string' || e.trecho.trim().length < 10 || e.trecho.length > 1000 || !resumo.includes(e.trecho) ||
      !ontologia[e.categoria as EvidenciaIA['categoria']].includes(e.termo)) throw new Error('Evidência não corresponde a um trecho literal do resumo ou à extração.');
    const key = JSON.stringify([e.categoria,e.termo]);
    if (keys.has(key)) throw new Error('Evidência duplicada.');
    keys.add(key);
  }
  for (const categoria of CATEGORIAS_EVIDENCIA) {
    if (new Set(ontologia[categoria]).size !== ontologia[categoria].length) throw new Error('Termos duplicados na extração.');
    for (const termo of ontologia[categoria]) if (!keys.has(JSON.stringify([categoria,termo]))) throw new Error('Termo extraído sem trecho de apoio.');
  }
  return value.map(({categoria,termo,trecho}) => ({categoria,termo,trecho}));
}
export async function hashResumo(resumo: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(resumo)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
