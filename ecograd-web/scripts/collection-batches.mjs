import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

export const BATCH_SCHEMA = 1;
/** Semanal: `coletas/2026-09-14T060000Z.json.gz`; a ordem do nome é a ordem de aplicação. */
export const BATCH_FILE = /^\d{4}-\d{2}-\d{2}T\d{6}Z\.json\.gz$/;

const handle = (record) => String(record?.url ?? '').match(/handle\/(\d+\/\d+)/)?.[1];

/**
 * Aplica os lotes da coleta semanal (coleta/coletar_ufsc.py, mesma regra em `aplicar_coletas`):
 * um handle presente no lote, incluído, atualizado ou removido, substitui todos os registros anteriores com ele.
 * Registros sem handle na URL nunca são tocados.
 */
export function aplicarColetas(bases, lotes) {
  let { ppg, tcc } = bases;
  for (const lote of lotes) {
    if (lote?.schema !== BATCH_SCHEMA || ![lote.ppg, lote.tcc, lote.removidos].every(Array.isArray)) {
      throw new Error('Lote de coleta inválido. Build interrompido.');
    }
    const trocados = new Set([...lote.removidos, ...[...lote.ppg, ...lote.tcc].map(handle).filter(Boolean)]);
    const manter = (record) => !trocados.has(handle(record));
    ppg = [...ppg.filter(manter), ...lote.ppg];
    tcc = [...tcc.filter(manter), ...lote.tcc];
  }
  return { ppg, tcc };
}

/** Os lotes de `<raizRepo>/coletas`, na ordem de aplicação, prontos para `aplicarColetas`. */
export function lotesDoRepositorio(raizRepo) {
  const pasta = join(raizRepo, 'coletas');
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).filter((n) => BATCH_FILE.test(n)).sort()
    .map((n) => JSON.parse(gunzipSync(readFileSync(join(pasta, n))).toString('utf8')));
}
