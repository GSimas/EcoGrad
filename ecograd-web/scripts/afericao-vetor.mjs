/**
 * A porta da busca por significado (ADR 003, R1 e R2; ADR 004, fase B).
 *
 *   npm run afericao:vetor
 *
 * Mede, contra a triagem assinada de empreendedorismo feminino, com k = 25 — a
 * profundidade da decisão D8:
 *
 * - **texto**: `buscar_texto`, a recuperação corrente (FTS com tesauro, R3);
 * - **vetor**: os 25 vizinhos mais próximos da pergunta;
 * - **híbrido**: fusão RRF das duas listas.
 *
 * R2 manda descartar o vetor se ele não superar 79% de revocação e 76% de
 * precisão; R1 manda olhar Q11, onde o tesauro falha, e a invariância entre as
 * duas paráfrases. Precisão segue a régua de `afericao-executar`: acertos sobre
 * obras recuperadas que foram triadas; as não triadas são contadas à parte,
 * porque podem ser falso positivo ou obra que a triagem nunca viu.
 *
 * Lê o banco com `SUPABASE_DB_URL` (só SELECT) e calcula o vetor da pergunta com
 * `GEMINI_API_KEY`, no mesmo formato da função `embedding-consulta`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { idObra } from './afericao-padroes.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const env = existsSync(join(raizApp, '.env')) ? readFileSync(join(raizApp, '.env'), 'utf8') : '';
const de = (k) => process.env[k] ?? env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
const T = JSON.parse(readFileSync(join(raizApp, '..', 'docs', 'evidencias', 'afericao', 'triagem-decisoes.json'), 'utf8')).Q10;

const K = 25;
const RRF = 60;
const curadas = new Set(Object.entries(T.obras).filter(([, o]) => o.decisao === 'pertence').map(([k]) => k));
const recusadas = new Set(Object.entries(T.obras).filter(([, o]) => o.decisao === 'nao_pertence').map(([k]) => k));

async function vetorDa(pergunta) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': de('GEMINI_API_KEY') },
    body: JSON.stringify({ content: { parts: [{ text: `task: search result | query: ${pergunta}` }] }, output_dimensionality: 768 }),
  });
  if (!r.ok) throw new Error(`embedding: HTTP ${r.status}`);
  return `[${(await r.json()).embedding.values.join(',')}]`;
}

const cliente = new pg.Client({ connectionString: de('SUPABASE_DB_URL'), ssl: { rejectUnauthorized: false } });
await cliente.connect();
await cliente.query('set hnsw.ef_search = 200');

const porTexto = async (consulta, n) =>
  (await cliente.query('select titulo from buscar_texto($1, $2)', [consulta, n])).rows.map((r) => idObra(r.titulo));
const porVetor = async (vetor, n) =>
  (await cliente.query(`select d.titulo, 1 - (e.embedding <=> $1::extensions.halfvec) as sim
     from documento_embedding e join documento d on d.id = e.documento_id
     order by e.embedding <=> $1::extensions.halfvec limit $2`, [vetor, n])).rows;

function fundir(...listas) {
  const pontos = new Map();
  for (const lista of listas) lista.forEach((id, i) => pontos.set(id, (pontos.get(id) ?? 0) + 1 / (RRF + i + 1)));
  return [...pontos].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

function medir(ids) {
  const topo = [...new Set(ids)].slice(0, K);
  const acertos = topo.filter((k) => curadas.has(k)).length;
  const julgadas = topo.filter((k) => curadas.has(k) || recusadas.has(k)).length;
  return { topo, revocacao: acertos / curadas.size, precisao: julgadas ? acertos / julgadas : 0, acertos, julgadas, naoTriadas: topo.length - julgadas };
}
const pct = (x) => `${Math.round(x * 100)}%`;

const resultados = {};
for (const [id, pergunta] of [['Q10', 'empreendedorismo feminino'], ['Q11', 'mulheres empreendedoras']]) {
  const vetor = await vetorDa(pergunta);
  const texto = await porTexto(pergunta, 100);
  const vizinhos = await porVetor(vetor, 100);
  const vetorIds = vizinhos.map((r) => idObra(r.titulo));
  resultados[id] = { texto: medir(texto), vetor: medir(vetorIds), hibrido: medir(fundir(texto, vetorIds)) };

  // Onde cortar: a similaridade das obras que pertencem contra a das que não.
  const sims = vizinhos.map((r) => ({ id: idObra(r.titulo), sim: Number(r.sim) }));
  const faixa = (f) => { const s = sims.filter(f).map((x) => x.sim); return s.length ? `${s.length} obras, ${Math.min(...s).toFixed(3)} a ${Math.max(...s).toFixed(3)}` : 'nenhuma'; };
  console.log(`\n${id} "${pergunta}" — similaridade nos 100 vizinhos: pertencem ${faixa((x) => curadas.has(x.id))}; não pertencem ${faixa((x) => recusadas.has(x.id))}`);
  console.log('| Método | Revocação | Precisão (triadas) | Não triadas no top 25 |');
  console.log('| --- | --- | --- | --- |');
  for (const [nome, m] of Object.entries(resultados[id])) {
    console.log(`| ${nome} | ${pct(m.revocacao)} (${m.acertos} de ${curadas.size}) | ${pct(m.precisao)} (${m.acertos} de ${m.julgadas}) | ${m.naoTriadas} |`);
  }
}

console.log('\nSobreposição Q10 × Q11 no top 25 (invariância à paráfrase):');
for (const m of ['texto', 'vetor', 'hibrido']) {
  const a = new Set(resultados.Q10[m].topo);
  const b = resultados.Q11[m].topo;
  console.log(`- ${m}: ${pct(b.filter((x) => a.has(x)).length / K)}`);
}
console.log('\nRégua R2: revocação 79% e precisão 76% (texto, Q10).');
await cliente.end();
