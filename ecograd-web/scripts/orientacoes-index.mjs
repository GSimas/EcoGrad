import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

export const ORIENTACOES_SCHEMA = 1;

const nome = (v) => (v === null || v === undefined ? '' : String(v).trim());
const lista = (v) => (Array.isArray(v) ? v : []);

/**
 * Quem orientou ou coorientou quem, em todas as coleções da base — inclusive as
 * que o usuário não carregou. Serve ao perfil de pessoa no Motor de Busca.
 *
 * `pessoas[orientador] = [[orientando, índice em colecoes, ano | null, papel, índice em niveis]]`,
 * com papel 0 = orientador e 1 = coorientador. Nomes vazios e autolaços (a mesma
 * pessoa como autora e orientadora do registro) ficam de fora.
 */
export function indiceOrientacoes(records) {
  const colecoes = [];
  const indiceColecao = new Map();
  const niveis = [];
  const indiceNivel = new Map();
  // Sem protótipo: nomes de pessoa viram chaves, e "__proto__" não pode escapar.
  const pessoas = Object.create(null);
  for (const r of lista(records)) {
    if (!r || typeof r !== 'object') continue;
    const colecao = nome(r.programa_origem);
    if (!indiceColecao.has(colecao)) {
      indiceColecao.set(colecao, colecoes.length);
      colecoes.push(colecao);
    }
    const nivel = nome(r.nivel_academico) || 'Não informado';
    if (!indiceNivel.has(nivel)) {
      indiceNivel.set(nivel, niveis.length);
      niveis.push(nivel);
    }
    const ano = Number.parseInt(nome(r.ano), 10);
    const autores = [...new Set(lista(r.autores).map(nome).filter(Boolean))];
    const orientador = nome(r.orientador);
    const coorientadores = [...new Set(lista(r.co_orientadores).map(nome))].filter((c) => c !== orientador);
    for (const [quem, papel] of [[orientador, 0], ...coorientadores.map((c) => [c, 1])]) {
      if (!quem) continue;
      for (const autor of autores) {
        if (autor !== quem) (pessoas[quem] ??= []).push([autor, indiceColecao.get(colecao), Number.isFinite(ano) ? ano : null, papel, indiceNivel.get(nivel)]);
      }
    }
  }
  return { schema: ORIENTACOES_SCHEMA, colecoes, niveis, pessoas };
}

/** Arquivo endereçado pelo conteúdo, como os shards de coleção: pode ser cacheado para sempre. */
export function orientacoesShard(records) {
  const raw = Buffer.from(JSON.stringify(indiceOrientacoes(records)));
  const sha256 = createHash('sha256').update(raw).digest('hex');
  const compressed = gzipSync(raw);
  return { descriptor: { path: `/data/orientacoes-${sha256}.json.gz`, sha256, bytes: compressed.length }, compressed };
}
