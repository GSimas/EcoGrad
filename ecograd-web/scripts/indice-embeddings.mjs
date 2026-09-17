/**
 * Vetores das obras para a busca por significado (ADR 004, fase B).
 *
 *   npm run indice:embeddings              gera o que falta e carrega no banco
 *   npm run indice:embeddings -- --so-gerar
 *
 * Uma obra, um vetor: `gemini-embedding-2` com 768 dimensões, já normalizado,
 * sobre "title: <título> | text: <resumo>" — o formato de documento que a
 * documentação do modelo pede para busca assimétrica. A chave é a do projeto
 * (`GEMINI_API_KEY`), decisão E3 do ADR 004.
 *
 * **Retomável e barato de refazer.** Cada vetor fica em
 * `indice-out/embeddings.jsonl` com o sha256 do texto que o gerou. Rodar de novo
 * só chama o modelo para obra nova ou resumo alterado: a carga semanal custa
 * centavos, e uma interrupção no meio não joga fora o que já foi pago.
 *
 * Custo medido na primeira carga: cerca de 38 milhões de tokens, US$ 8 à tabela
 * de 16/09/2026 (US$ 0,20 por milhão).
 */
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { appendFileSync, createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { identidadeObra } from './afericao-padroes.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');
const cache = join(raizApp, 'indice-out', 'embeddings.jsonl');

const MODELO = 'gemini-embedding-2';
const DIMENSOES = 768;
/** O resumo raro muito longo não precisa entrar inteiro: o sentido está no começo. */
const MAX_RESUMO = 6000;
const POR_REQUISICAO = 100;
const SIMULTANEAS = 4;

const env = existsSync(join(raizApp, '.env')) ? readFileSync(join(raizApp, '.env'), 'utf8') : '';
const de = (k) => process.env[k] ?? env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
const chave = de('GEMINI_API_KEY');
if (!chave) throw new Error('GEMINI_API_KEY ausente no ambiente e no .env.');
const limpo = (t) => String(t).replaceAll(chave, '<chave>');

function ler(nome) {
  const caminho = [join(raizRepo, nome), join(raizApp, 'public', 'data', nome)].find(existsSync);
  if (!caminho) throw new Error(`Base ausente: ${nome}`);
  return JSON.parse(gunzipSync(readFileSync(caminho)).toString('utf8'));
}

// A mesma obra de `indice-derivar`: identidade do título, resumo mais longo.
const obras = new Map();
for (const d of [...ler('base_consolidada_ufsc.json.gz'), ...ler('base_tcc_ufsc.json.gz')]) {
  const id = identidadeObra(d.titulo);
  if (!id) continue;
  const resumo = String(d.resumo ?? '').trim();
  const atual = obras.get(id);
  if (!atual) obras.set(id, { id, titulo: String(d.titulo ?? '').trim(), resumo });
  else if (resumo.length > atual.resumo.length) { atual.resumo = resumo; atual.titulo = String(d.titulo ?? '').trim(); }
}
const textoDa = (o) => `title: ${o.titulo || 'none'} | text: ${o.resumo ? o.resumo.slice(0, MAX_RESUMO) : o.titulo}`;
const sha = (t) => createHash('sha256').update(`${MODELO}:${DIMENSOES}:${t}`).digest('hex');

// O que já foi pago: sha → linha do cache.
const prontos = new Map();
if (existsSync(cache)) {
  for await (const linha of createInterface({ input: createReadStream(cache, 'utf8'), crlfDelay: Infinity })) {
    if (!linha) continue;
    const e = JSON.parse(linha);
    prontos.set(e.sha, e.v);
  }
}

/** `INDICE_EMBEDDINGS_LIMITE` gera só as N primeiras pendentes: ensaio de vazão e custo antes da carga inteira. */
const limite = Number(process.env.INDICE_EMBEDDINGS_LIMITE ?? Infinity);
const pendentes = [...obras.values()].map((o) => ({ ...o, texto: textoDa(o) })).map((o) => ({ ...o, sha: sha(o.texto) })).filter((o) => !prontos.has(o.sha)).slice(0, limite);
console.log(`${obras.size} obras · ${prontos.size} vetores em cache · ${pendentes.length} a gerar agora`);

async function embeddar(lote) {
  for (let tentativa = 1; ; tentativa++) {
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:batchEmbedContents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({ requests: lote.map((o) => ({ model: `models/${MODELO}`, content: { parts: [{ text: o.texto }] }, output_dimensionality: DIMENSOES })) }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (e) {
      if (tentativa < 6) { await new Promise((s) => setTimeout(s, 2000 * tentativa)); continue; }
      throw new Error(`conexão falhou: ${limpo(e.message)}`);
    }
    if (r.ok) return (await r.json()).embeddings.map((e) => e.values);
    const corpo = limpo((await r.text()).slice(0, 300));
    // Cota por minuto e instabilidade passam com espera; erro de pedido não.
    if ((r.status === 429 || r.status >= 500) && tentativa < 8) {
      await new Promise((s) => setTimeout(s, Math.min(60000, 3000 * 2 ** (tentativa - 1))));
      continue;
    }
    throw new Error(`HTTP ${r.status}: ${corpo}`);
  }
}

const inicio = Date.now();
let feitos = 0;
let cursor = 0;
async function trabalhador() {
  while (cursor < pendentes.length) {
    const lote = pendentes.slice(cursor, cursor + POR_REQUISICAO);
    cursor += POR_REQUISICAO;
    const vetores = await embeddar(lote);
    // float32 em base64: um terço do tamanho do JSON de números.
    const linhas = lote.map((o, i) => JSON.stringify({ id: o.id, sha: o.sha, v: Buffer.from(new Float32Array(vetores[i]).buffer).toString('base64') }));
    appendFileSync(cache, linhas.join('\n') + '\n');
    lote.forEach((o, i) => prontos.set(o.sha, JSON.parse(linhas[i]).v));
    feitos += lote.length;
    if (feitos % 5000 < POR_REQUISICAO) {
      const s = (Date.now() - inicio) / 1000;
      console.log(`  ${feitos} de ${pendentes.length} · ${Math.round(s)} s · faltam ~${Math.round((s / feitos) * (pendentes.length - feitos) / 60)} min`);
    }
  }
}
await Promise.all(Array.from({ length: SIMULTANEAS }, trabalhador));
if (pendentes.length) console.log(`gerados ${feitos} vetores em ${Math.round((Date.now() - inicio) / 1000)} s`);

if (process.argv.includes('--so-gerar')) process.exit(0);

// ------------------------------------------------------------------- carga
const url = de('SUPABASE_DB_URL');
if (!url) { console.error('SUPABASE_DB_URL ausente: vetores gerados, carga não feita.'); process.exit(1); }
const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await cliente.connect();
try {
  const t = Date.now();
  await cliente.query('set statement_timeout = 0');
  await cliente.query("set maintenance_work_mem = '256MB'");
  await cliente.query('begin');
  await cliente.query('truncate documento_embedding');
  await cliente.query('drop index if exists documento_embedding_hnsw_idx');
  // Formato texto do COPY: barra invertida, tabulação e quebra de linha precisam
  // de escape, senão o id muda e a obra não casa com `documento`.
  const copiavel = (t) => t.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  const linhas = function* () {
    for (const o of obras.values()) {
      const s = sha(textoDa(o));
      const v = prontos.get(s);
      if (!v) continue;
      const b = Buffer.from(v, 'base64');
      const numeros = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
      yield `${copiavel(o.id)}\t[${Array.from(numeros, (x) => x.toPrecision(6)).join(',')}]\t${MODELO}\t${s}\n`;
    }
  };
  await pipeline(Readable.from(linhas()), cliente.query(copyFrom('copy documento_embedding (documento_id, embedding, modelo, texto_sha256) from stdin')));
  console.log(`  vetores carregados em ${Math.round((Date.now() - t) / 1000)} s; construindo HNSW…`);
  await cliente.query('create index documento_embedding_hnsw_idx on documento_embedding using hnsw (embedding extensions.halfvec_cosine_ops)');
  await cliente.query('commit');
  await cliente.query('analyze documento_embedding');
  const { rows: [{ n }] } = await cliente.query('select count(*)::int as n from documento_embedding');
  console.log(`  ${n} vetores no índice, em ${Math.round((Date.now() - t) / 1000)} s`);
} catch (e) {
  await cliente.query('rollback').catch(() => {});
  console.error('Carga abortada, nada foi alterado:', String(e.message).replace(/postgresql:\/\/[^\s]+/g, 'postgresql://…'));
  process.exitCode = 1;
} finally {
  await cliente.end();
}
