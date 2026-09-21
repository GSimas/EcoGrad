/**
 * Enriquecimento do índice, fase A0 do ADR 004: unificação conservadora de
 * pessoas e métricas de rede, no acervo inteiro e por coleção.
 *
 *   npm run indice:enriquecer      (antes de indice:derivar)
 *
 * Roda em Node o **mesmo código do app** — `unificacao.ts` e `sna-engine.ts`,
 * empacotados pelo esbuild —, para que o número do banco seja o número da tela
 * com as mesmas coleções carregadas. Reescrever as métricas em SQL faria os dois
 * divergirem em silêncio.
 *
 * Grava em `indice-out/`:
 * - `unificacao.json`: grafia → canônico, que `indice-derivar.mjs` lê para
 *   atribuir o id de pessoa. Sem ele, cada grafia continua sendo uma pessoa.
 * - `pessoa_fusao.csv`: cada fusão com o método, para a curadoria humana.
 * - `rede_metrica.csv`: uma linha por nó que não é documento, por escopo.
 *
 * Diferença declarada em relação ao app: aqui a unificação é a canônica do
 * acervo; no navegador, a análise usa a unificação local de quem está usando.
 */
import { gunzipSync } from 'node:zlib';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { normalizarDocumentos } from '../src/lib/data-loader';
import { aplicarUnificacao, unificacaoConservadora } from '../src/lib/unificacao';
import { calcularSnaGlobal } from '../src/lib/sna-engine';
import type { Documento } from '../src/types';
import { aplicarColetas, lotesDoRepositorio } from './collection-batches.mjs';

const raizApp = resolve(process.cwd());
const raizRepo = resolve(raizApp, '..');
const destino = join(raizApp, 'indice-out');
mkdirSync(destino, { recursive: true });

function ler(nome: string): unknown[] {
  const caminho = [join(raizRepo, nome), join(raizApp, 'public', 'data', nome)].find(existsSync);
  if (!caminho) throw new Error(`Base ausente: ${nome}`);
  return JSON.parse(gunzipSync(readFileSync(caminho)).toString('utf8'));
}

const campo = (v: unknown) => (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v)) ? '\\N' : `"${String(v).replace(/"/g, '""')}"`);
function escritor(nome: string) {
  const fluxo = createWriteStream(join(destino, nome), { encoding: 'utf8' });
  let total = 0;
  return {
    async escrever(...vs: unknown[]) {
      total += 1;
      if (!fluxo.write(vs.map(campo).join(',') + '\n')) await new Promise((r) => fluxo.once('drain', r));
    },
    get total() { return total; },
    fim: () => new Promise((r) => fluxo.end(r)),
  };
}

const inicio = Date.now();
const segundos = () => `${((Date.now() - inicio) / 1000).toFixed(0)} s`;
// O mesmo acervo de `indice-derivar`: bases mais lotes da coleta semanal.
const acervo = aplicarColetas({ ppg: ler('base_consolidada_ufsc.json.gz'), tcc: ler('base_tcc_ufsc.json.gz') }, lotesDoRepositorio(raizRepo));
const brutos: Documento[] = normalizarDocumentos([...acervo.ppg, ...acervo.tcc]);

// ---------------------------------------------------------------- unificação
const ocorrencias = function* () {
  for (const d of brutos) {
    const colecao = d.programa_origem || 'Coleção não informada';
    for (const nome of [...d.autores, d.orientador, ...d.co_orientadores]) if (nome) yield { nome, colecao };
  }
};
const fusoes = unificacaoConservadora(ocorrencias());
writeFileSync(join(destino, 'unificacao.json'), JSON.stringify(Object.fromEntries(fusoes.map((f) => [f.grafia, f.canonico]))) + '\n');
const fFusao = escritor('pessoa_fusao.csv');
for (const f of fusoes) await fFusao.escrever(f.grafia, f.canonico, f.metodo);
await fFusao.fim();
const porMetodo = fusoes.reduce<Record<string, number>>((m, f) => ({ ...m, [f.metodo]: (m[f.metodo] ?? 0) + 1 }), {});
console.log(`unificação: ${fusoes.length} grafias fundidas (${Object.entries(porMetodo).map(([k, v]) => `${v} por ${k}`).join(', ')}) · ${segundos()}`);

const docs = aplicarUnificacao(brutos, new Map(fusoes.map((f) => [f.grafia, f.canonico])));

// ---------------------------------------------------------------------- rede
const fRede = escritor('rede_metrica.csv');
async function gravarRede(escopo: 'acervo' | 'colecao', colecao: string | null, recorte: readonly Documento[]) {
  const sna = calcularSnaGlobal(recorte);
  const nos = Object.keys(sna).length;
  for (const [rotulo, m] of Object.entries(sna)) {
    if (m.Tipo === 'Documento') continue;
    await fRede.escrever(escopo, colecao, m.Tipo, rotulo, m['Grau Absoluto'], m['Degree Centrality'], m.Betweenness, m.Closeness, m.Clustering,
      m.Comunidade === 'N/A' ? null : m.Comunidade, m['Ranking Global'] === 'N/A' ? null : m['Ranking Global'], nos);
  }
  return nos;
}

const porColecao = new Map<string, Documento[]>();
for (const d of docs) {
  const c = d.programa_origem || 'Coleção não informada';
  (porColecao.get(c) ?? porColecao.set(c, []).get(c)!).push(d);
}
let feitas = 0;
for (const [colecao, recorte] of [...porColecao].sort((a, b) => a[0].localeCompare(b[0]))) {
  await gravarRede('colecao', colecao, recorte);
  feitas += 1;
  if (feitas % 25 === 0) console.log(`rede por coleção: ${feitas} de ${porColecao.size} · ${segundos()}`);
}
console.log(`rede por coleção: ${porColecao.size} coleções · ${segundos()}`);
const nosAcervo = await gravarRede('acervo', null, docs);
console.log(`rede do acervo: ${nosAcervo} nós · ${segundos()}`);
await fRede.fim();
console.log(`rede_metrica.csv: ${fRede.total} linhas · pessoa_fusao.csv: ${fFusao.total} linhas · CSV em ${destino}`);
