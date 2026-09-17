/**
 * Deriva o índice da Etapa 2 (ADR 001) a partir das bases canônicas.
 *
 *   npm run indice:derivar
 *
 * D1 em uma linha: **este programa é a razão de o Postgres ser índice e não
 * fonte.** Ele lê `base_consolidada_ufsc.json.gz` e `base_tcc_ufsc.json.gz`,
 * que continuam canônicos, aplica por cima os lotes da coleta semanal em
 * `coletas/`, e escreve os CSV que `indice-carregar.mjs` copia para o banco. Se
 * o banco cair, pausar ou divergir, basta rodar os dois de novo — nada aqui
 * depende do estado anterior do Postgres.
 *
 * Os lotes entram pela **mesma função** que `sync-data.mjs` usa para o site
 * (`aplicarColetas`). Duas implementações da mesma regra fariam o índice e o site
 * responderem sobre acervos diferentes depois de cada coleta — em silêncio, que
 * é o modo de falha que a D1 existe para evitar.
 *
 * As regras de identidade e de cobertura são as **mesmas das ferramentas do
 * chat**, importadas de `afericao-padroes.mjs` e repetidas de `chat-ferramentas`:
 * duplicar a regra faria o índice e o app divergirem em silêncio, que é
 * exatamente o modo de falha que a decisão D3 quer evitar.
 *
 * Nada é enviado a lugar nenhum: a saída são arquivos em `indice-out/`.
 */
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identidadeObra, idObra } from './afericao-padroes.mjs';
import { BATCH_FILE, aplicarColetas } from './collection-batches.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');
const destino = join(raizApp, 'indice-out');

/** O mesmo teto de `chat-ferramentas.RESUMO_MINIMO`: abaixo disso não há o que ler. */
const RESUMO_MINIMO = 200;
const utilizavel = (resumo) => String(resumo ?? '').trim().length >= RESUMO_MINIMO;
const sha256 = (s) => createHash('sha256').update(String(s ?? ''), 'utf8').digest('hex');

function ler(nome) {
  const caminho = [join(raizRepo, nome), join(raizApp, 'public', 'data', nome)].find(existsSync);
  if (!caminho) throw new Error(`Base ausente: ${nome}`);
  const bruto = readFileSync(caminho);
  return { docs: JSON.parse(gunzipSync(bruto).toString('utf8')), sha256: createHash('sha256').update(bruto).digest('hex') };
}

/** CSV do Postgres: aspas dobradas, tudo entre aspas, vazio vira \N (NULL). */
const campo = (v) => (v === null || v === undefined || v === '' ? '\\N' : `"${String(v).replace(/"/g, '""')}"`);
const linha = (...vs) => vs.map(campo).join(',') + '\n';

function escritor(nome) {
  const fluxo = createWriteStream(join(destino, nome), { encoding: 'utf8' });
  let n = 0;
  return {
    escrever(...vs) { n += 1; if (!fluxo.write(linha(...vs))) return new Promise((r) => fluxo.once('drain', r)); },
    get total() { return n; },
    fim: () => new Promise((r) => fluxo.end(r)),
  };
}

const pos = ler('base_consolidada_ufsc.json.gz');
const tcc = ler('base_tcc_ufsc.json.gz');

// Os lotes da coleta semanal, na ordem do nome, que é a ordem de aplicação.
const pastaColetas = join(raizRepo, 'coletas');
const nomesLotes = existsSync(pastaColetas) ? readdirSync(pastaColetas).filter((n) => BATCH_FILE.test(n)).sort() : [];
const lotes = nomesLotes.map((n) => ({
  nome: n,
  ...ler(join('coletas', n)),
}));
const bases = aplicarColetas({ ppg: pos.docs, tcc: tcc.docs }, lotes.map((l) => l.docs));
if (nomesLotes.length) console.log(`${nomesLotes.length} lote(s) da coleta semanal aplicados.`);

const todos = [
  ...bases.ppg.map((d) => ({ d, catalogo: 'ppg' })),
  ...bases.tcc.map((d) => ({ d, catalogo: 'tcc' })),
];

mkdirSync(destino, { recursive: true });

// ---------------------------------------------------------------- documentos
//
// D3: a obra deduplicada é a unidade. Entre registros da mesma obra fica o
// resumo mais longo — o mesmo critério de `agruparObras` na triagem —, porque
// catalogação parcial é comum e o resumo truncado não deve apagar o completo.
const documentos = new Map();
for (const { d } of todos) {
  const id = identidadeObra(d.titulo);
  if (!id) continue;
  const resumo = String(d.resumo ?? '').trim();
  const atual = documentos.get(id);
  if (!atual) documentos.set(id, { id, titulo: String(d.titulo ?? '').trim(), resumo });
  else if (resumo.length > atual.resumo.length) { atual.resumo = resumo; atual.titulo = String(d.titulo ?? '').trim(); }
}

const fDoc = escritor('documento.csv');
for (const o of documentos.values()) {
  await fDoc.escrever(o.id, o.titulo, o.resumo || null, o.resumo ? sha256(o.resumo) : null, utilizavel(o.resumo) ? 't' : 'f', idObra(o.titulo));
}
await fDoc.fim();

// ------------------------------------------------------------------- pessoas
//
// ADR 004: a pessoa é o nome canônico da unificação conservadora, que
// `indice-enriquecer.ts` grava em `unificacao.json`. Sem o arquivo, cada grafia
// continua sendo uma pessoa, como na Etapa 2 — e a carga avisa.
const caminhoUnificacao = join(destino, 'unificacao.json');
const unificacao = existsSync(caminhoUnificacao) ? JSON.parse(readFileSync(caminhoUnificacao, 'utf8')) : {};
if (!existsSync(caminhoUnificacao)) console.warn('Sem indice-out/unificacao.json: cada grafia vira uma pessoa. Rode antes npm run indice:enriquecer.');
const pessoas = new Map();   // nome canônico → id
const grafias = new Map();   // grafia → id
const idDaPessoa = (nome) => {
  const g = String(nome ?? '').trim();
  if (!g) return null;
  const canonico = unificacao[g] ?? g;
  if (!pessoas.has(canonico)) pessoas.set(canonico, pessoas.size + 1);
  grafias.set(g, pessoas.get(canonico));
  return pessoas.get(canonico);
};

const fReg = escritor('registro.csv');
const fRegPessoa = escritor('registro_pessoa.csv');
const fPalavra = escritor('registro_palavra_chave.csv');

let registroId = 0;
let registrosComResumo = 0;
for (const { d, catalogo } of todos) {
  if (utilizavel(d.resumo)) registrosComResumo += 1;
  const documentoId = identidadeObra(d.titulo);
  if (!documentoId) continue;
  registroId += 1;
  const ano = Number.parseInt(String(d.ano ?? ''), 10);
  await fReg.escrever(
    registroId, documentoId, d.programa_origem || 'Coleção não informada', catalogo,
    Number.isFinite(ano) ? ano : null, d.nivel_academico || null, d.macrotema || null, d.url || null,
    // Cobertura do próprio registro: é assim que o gabarito de Q04 conta, e é
    // diferente da cobertura da obra, que fica com o resumo mais longo.
    utilizavel(d.resumo) ? 't' : 'f',
  );

  const papeis = [
    ['Autor', Array.isArray(d.autores) ? d.autores : [d.autores]],
    ['Orientador', [d.orientador]],
    ['Co-orientador', Array.isArray(d.co_orientadores) ? d.co_orientadores : [d.co_orientadores]],
  ];
  const jaVisto = new Set();
  for (const [papel, nomes] of papeis) {
    for (const nome of nomes) {
      const pessoaId = idDaPessoa(nome);
      if (!pessoaId) continue;
      const k = `${pessoaId}:${papel}`;
      if (jaVisto.has(k)) continue;   // a mesma grafia repetida no papel é uma linha só
      jaVisto.add(k);
      await fRegPessoa.escrever(registroId, pessoaId, papel);
    }
  }

  const termos = new Set((d.palavras_chave || []).map((p) => String(p ?? '').trim()).filter(Boolean));
  for (const termo of termos) await fPalavra.escrever(registroId, termo);
}
await Promise.all([fReg.fim(), fRegPessoa.fim(), fPalavra.fim()]);

const fPessoa = escritor('pessoa.csv');
const fGrafia = escritor('pessoa_grafia.csv');
for (const [canonico, id] of pessoas) await fPessoa.escrever(id, canonico);
for (const [grafia, id] of grafias) await fGrafia.escrever(grafia, id);
await Promise.all([fPessoa.fim(), fGrafia.fim()]);

// --------------------------------------------------------------------- meta
//
// `sha256_lotes` é a checagem de idade que faltava. As duas bases não mudam quando
// um lote entra — elas nunca são reescritas —, então comparar só os hashes delas
// dizia "em dia" sobre um índice que não tinha os documentos da última coleta. O
// mesmo valor é recalculado do manifesto publicado, em `estadoDoIndice`.
const shaLotes = sha256(lotes.map((l) => `${l.nome}:${l.sha256}`).join('\n'));
const baseVersion = sha256(pos.sha256 + tcc.sha256 + shaLotes).slice(0, 16);
const fMeta = escritor('indice_meta.csv');
await fMeta.escrever('t', baseVersion, pos.sha256, tcc.sha256, shaLotes, new Date().toISOString(), registroId, documentos.size);
await fMeta.fim();

console.log(`base_version ${baseVersion}`);
console.log(`lotes aplicados      ${nomesLotes.length}`);
console.log(`registros            ${registroId}`);
console.log(`documentos           ${documentos.size}`);
console.log(`obras com resumo utilizável   ${[...documentos.values()].filter((o) => utilizavel(o.resumo)).length}`);
console.log(`registros com resumo utilizável ${registrosComResumo}`);
console.log(`pessoas              ${pessoas.size} (de ${grafias.size} grafias)`);
console.log(`vínculos pessoa      ${fRegPessoa.total}`);
console.log(`palavras-chave       ${fPalavra.total}`);
console.log(`\nCSV em ${destino}`);
