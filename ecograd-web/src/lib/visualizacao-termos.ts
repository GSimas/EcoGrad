import type { Documento, TipoForesight } from '../types';
import { extrairMemesCompletos, type FonteMemes } from './memetics';
import { memesDoDocumento } from './memetic-network';
import { extrairTermosForesight } from './foresight-math';
/** Exact matching with each original extractor; the three analyses normalize terms differently. */
export function trabalhosDoTermo(docs: readonly Documento[], termo: string, origem: { modo: 'rede' | 'propagacao'; fonte: FonteMemes } | { modo: 'foresight'; tipo: TipoForesight }) {
  return docs.filter((d) => {
    const termos = origem.modo === 'foresight' ? extrairTermosForesight(d, origem.tipo)
      : origem.modo === 'rede' ? memesDoDocumento(d, origem.fonte) : extrairMemesCompletos(d, origem.fonte);
    return termos.includes(termo);
  });
}
