/**
 * Memética: fecundidade, mortalidade infantil e longevidade dos memes.
 * Transcrição de `calcular_metricas_memeticas` (backend.py:1008).
 */
import type { Documento, FecundidadeRow, LongevidadeRow, MetricasMemeticas } from '@/types';
import { removerAcentos, STOPWORDS_NORMALIZADAS } from './stopwords';
import { parseOntologia } from './foresight-math';

export type FonteMemes = 'Palavras-chave' | 'Artefatos Extraídos';

/**
 * Extrai o conjunto de memes de um documento.
 * - "Palavras-chave": palavras-chave normalizadas + tokens do título (≥3 letras,
 *   sem stopwords), tudo sem acento e em minúsculas.
 * - "Artefatos Extraídos": teorias + ferramentas + métodos da ontologia da IA,
 *   preservando nomes compostos (apenas `capitalize()`).
 */
export function extrairMemesCompletos(d: Documento, fonte: FonteMemes): string[] {
  const memes = new Set<string>();

  if (fonte === 'Palavras-chave') {
    for (const p of d.palavras_chave) {
      const v = removerAcentos(String(p).toLowerCase().trim());
      if (v) memes.add(v);
    }
    const tituloNorm = removerAcentos(String(d.titulo ?? '').toLowerCase());
    const palavrasTitulo = tituloNorm.match(/\b[a-z]{3,}\b/g) ?? [];
    for (const p of palavrasTitulo) if (!STOPWORDS_NORMALIZADAS.has(p)) memes.add(p);
  } else {
    const onto = parseOntologia(d.ontologia_ia);
    if (onto) {
      const todos = [...onto.teorias_e_modelos, ...onto.ferramentas_e_artefatos, ...onto.metodos_e_tecnicas];
      for (const a of todos) {
        const s = String(a).trim();
        if (!s) continue;
        // Equivalente a str.capitalize() do Python
        memes.add(s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
      }
    }
  }

  return [...memes];
}

export function calcularMetricasMemeticas(
  docs: readonly Documento[],
  fonte: FonteMemes = 'Palavras-chave',
): MetricasMemeticas {
  const vazio: MetricasMemeticas = {
    fecundidade: [],
    longevidade: [],
    mortalidade: 0,
    sobreviventes: 0,
    memesMortos: [],
    memesVivos: [],
  };
  if (docs.length === 0) return vazio;

  // meme → títulos distintos (fecundidade é nunique de títulos, como no pandas)
  const porMeme = new Map<string, { titulos: Set<string>; anoMin: number; anoMax: number }>();

  for (const d of docs) {
    const titulo = d.titulo;
    const ano = d.ano;
    for (const meme of extrairMemesCompletos(d, fonte)) {
      let entrada = porMeme.get(meme);
      if (!entrada) {
        entrada = { titulos: new Set(), anoMin: Infinity, anoMax: -Infinity };
        porMeme.set(meme, entrada);
      }
      if (titulo) entrada.titulos.add(titulo);
      if (ano !== null && Number.isFinite(ano)) {
        if (ano < entrada.anoMin) entrada.anoMin = ano;
        if (ano > entrada.anoMax) entrada.anoMax = ano;
      }
    }
  }

  if (porMeme.size === 0) return vazio;

  const fecundidade: FecundidadeRow[] = [];
  const longevidade: LongevidadeRow[] = [];
  const memesMortos: string[] = [];
  const memesVivos: FecundidadeRow[] = [];

  for (const [meme, info] of porMeme) {
    const total = info.titulos.size;
    fecundidade.push({ meme, fecundidade: total });

    if (total === 1) memesMortos.push(meme);
    else memesVivos.push({ meme, fecundidade: total });

    // Longevidade só é válida para memes que se replicaram (>1 aparição)
    if (total > 1 && Number.isFinite(info.anoMin) && Number.isFinite(info.anoMax)) {
      longevidade.push({
        meme,
        ano_nascimento: info.anoMin,
        ano_extincao: info.anoMax,
        total_aparicoes: total,
        tempo_vida_anos: info.anoMax - info.anoMin,
      });
    }
  }

  /**
   * Ordenação determinística: fecundidade decrescente e, em caso de empate,
   * nome crescente por code point. O pandas chega ao mesmo resultado porque o
   * `groupby` já entrega as chaves ordenadas e o `sort_values` é estável —
   * sem este desempate, dois memes com a mesma contagem podem trocar de lugar
   * no corte do Top-N entre execuções.
   */
  const porFecundidade = (a: FecundidadeRow, b: FecundidadeRow) =>
    b.fecundidade - a.fecundidade || (a.meme < b.meme ? -1 : a.meme > b.meme ? 1 : 0);

  fecundidade.sort(porFecundidade);
  memesVivos.sort(porFecundidade);
  memesMortos.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  longevidade.sort(
    (a, b) =>
      b.total_aparicoes - a.total_aparicoes || (a.meme < b.meme ? -1 : a.meme > b.meme ? 1 : 0),
  );

  return {
    fecundidade,
    longevidade,
    mortalidade: memesMortos.length,
    sobreviventes: memesVivos.length,
    memesMortos,
    memesVivos,
  };
}

/**
 * Tempo de meia-vida: mediana do tempo de vida dos memes que se replicaram.
 * Usado no painel de Longevidade.
 */
export function tempoDeMeiaVida(longevidade: readonly LongevidadeRow[]): number {
  if (longevidade.length === 0) return 0;
  const vidas = longevidade.map((l) => l.tempo_vida_anos).sort((a, b) => a - b);
  const meio = Math.floor(vidas.length / 2);
  return vidas.length % 2 === 0 ? (vidas[meio - 1] + vidas[meio]) / 2 : vidas[meio];
}
