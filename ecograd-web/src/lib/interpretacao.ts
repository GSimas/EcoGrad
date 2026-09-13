/** Metadados de apresentação; não modifica os dados nem a seleção científica. */
import type { Documento, Quadrante, TipoForesight } from '../types';
import { extrairTermosForesight } from './foresight-math';

export const LEITURA_QUADRANTE: Record<Quadrante, string> = {
  '↗️ Tendência': 'Momentum alto · novidade alta',
  '↖️ Sinal Fraco': 'Momentum baixo · novidade alta',
  '↘️ Mainstream': 'Momentum alto · novidade baixa',
  '↙️ Base/Declínio': 'Momentum baixo · novidade baixa',
};

/** Rótulos de leitura; as chaves e os vereditos originais continuam exportados. */
export const LEITURA_VEREDITO: Record<string, string> = {
  '✅ Sucesso (Emergiu/Explodiu)': 'Critério atendido: crescimento ≥ 25% e volume posterior ≥ 3',
  '❌ Falso Positivo (Ruído)': 'Critério não atendido: crescimento ≥ 25% e volume posterior ≥ 3',
  '✅ Confirmado (Continuou Fogo)': 'Critério atendido: crescimento ≥ 10% e volume posterior ≥ 3',
  '❌ Falso Positivo (Esfriou)': 'Critério não atendido: crescimento ≥ 10% e volume posterior ≥ 3',
  '✅ Confirmado (Caiu/Morreu)': 'Critério atendido: variação ≤ 0% ou volume posterior < 3',
  '❌ Falso Negativo (Ressurgiu)': 'Critério não atendido: variação ≤ 0% ou volume posterior < 3',
  '✅ Confirmado (Platô/Caiu)': 'Critério atendido: variação ≤ 5%',
  '❌ Falso Negativo (Voltou a Crescer)': 'Critério não atendido: variação ≤ 5%',
};

export function coberturaRadar(docs: readonly Documento[], janela: number, tipo: TipoForesight) {
  const datados = docs.filter((d) => d.ano !== null && Number.isFinite(d.ano));
  const anos = datados.map((d) => d.ano as number);
  const primeiro = anos.length ? Math.min(...anos) : null;
  const ultimo = anos.length ? Math.max(...anos) : null;
  const corte = ultimo === null ? null : ultimo - janela;
  return {
    primeiro, ultimo, corte,
    passado: datados.filter((d) => (d.ano as number) <= (corte ?? -Infinity)).length,
    recente: datados.filter((d) => (d.ano as number) > (corte ?? Infinity)).length,
    semAno: docs.length - datados.length,
    comTermosDatados: datados.filter((d) => extrairTermosForesight(d, tipo).length > 0).length,
    limiteOcorrencias: Math.max(10, datados.length * 0.1),
  };
}

export function motivoRadarVazio(c: ReturnType<typeof coberturaRadar>) {
  if (c.ultimo === null) return 'A seleção não contém anos válidos. Use Editar seleção para escolher uma coleção com datas.';
  if (c.comTermosDatados === 0) return 'Não há termos desta dimensão em registros com ano válido. Experimente outra dimensão; para artefatos, prepare ou importe o catálogo em Memética.';
  if (!c.passado || !c.recente) return 'A janela não separa registros em dois períodos. Reduza a janela recente; se todos os registros forem do mesmo ano, escolha uma coleção com maior cobertura temporal em Editar seleção.';
  return 'Nenhum termo atende aos cortes de frequência neste recorte. Experimente outra dimensão ou janela, ou amplie as coleções em Editar seleção. Alterar o percentil não inclui termos excluídos por frequência.';
}

export function corteEfetivo(kmeans: boolean, quantidade: number, percentil: number) {
  if (quantidade === 0) return { metodo: 'Aguardando termos elegíveis', percentil: null, linhas: 'Os cortes só são calculados quando há termos elegíveis.' };
  return kmeans && quantidade >= 4
    ? { metodo: 'K-Means (4 clusters)', percentil: null, linhas: 'Medianas dos centroides: referências visuais, não fronteiras exatas dos clusters.' }
    : { metodo: 'Percentil', percentil: kmeans ? 0.65 : percentil, linhas: kmeans ? 'Menos de 4 termos: aplicado o fallback científico de percentil 65.' : 'Cortes calculados sobre os termos elegíveis da seleção; alto e baixo são relativos a esses cortes.' };
}
