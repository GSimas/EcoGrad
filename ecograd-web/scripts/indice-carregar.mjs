/**
 * Carrega no Postgres os CSV que `indice-derivar.mjs` escreveu (Etapa 2, ADR 001).
 *
 *   export SUPABASE_DB_URL='postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres'
 *   npm run indice:carregar
 *
 * Ou com a variável em `ecograd-web/.env`, que o git ignora: `npm run` passa
 * `--env-file-if-exists=.env`.
 *
 * A senha **nunca** entra no repositório nem em argumento de linha de comando:
 * vem da variável de ambiente, e este programa não a imprime em lugar nenhum,
 * nem em mensagem de erro.
 *
 * O carregamento é destrutivo por desenho. `TRUNCATE` antes de cada carga é o
 * que faz D1 valer na prática: o banco é índice, e reconstruí-lo do zero
 * precisa ser barato e previsível. Não há migração incremental aqui, e não
 * deveria haver — divergência silenciosa entre a base e o índice é o modo de
 * falha que o ADR quer evitar.
 *
 * Os índices GIN caem antes e voltam depois: construí-los durante o COPY custa
 * várias vezes mais do que construí-los de uma vez sobre a tabela pronta.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';

const aqui = dirname(fileURLToPath(import.meta.url));
const origem = join(resolve(aqui, '..'), 'indice-out');

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Defina SUPABASE_DB_URL antes de rodar. A senha vem do ambiente e não do repositório.');
  console.error("  export SUPABASE_DB_URL='postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres'");
  process.exit(1);
}

/** Ordem de carga: quem é referenciado entra antes de quem referencia. */
const TABELAS = [
  ['documento', 'documento.csv', '(id, titulo, resumo, resumo_sha256, resumo_utilizavel, id_obra)'],
  ['pessoa', 'pessoa.csv', '(id, nome_canonico)'],
  ['pessoa_grafia', 'pessoa_grafia.csv', '(grafia, pessoa_id)'],
  ['registro', 'registro.csv', '(id, documento_id, colecao, catalogo, ano, nivel_academico, macrotema, url, resumo_utilizavel)'],
  ['registro_pessoa', 'registro_pessoa.csv', '(registro_id, pessoa_id, papel)'],
  ['registro_palavra_chave', 'registro_palavra_chave.csv', '(registro_id, termo)'],
  // ADR 004: saem de `npm run indice:enriquecer`, que roda antes da derivação.
  ['pessoa_fusao', 'pessoa_fusao.csv', '(grafia, canonico, metodo)'],
  ['rede_metrica', 'rede_metrica.csv', '(escopo, colecao, tipo, rotulo, grau_absoluto, grau, intermediacao, proximidade, agrupamento, comunidade, ranking, nos_na_rede)'],
  ['indice_meta', 'indice_meta.csv', '(id, base_version, sha256_pos, sha256_tcc, sha256_lotes, gerado_em, registros, documentos)'],
];

/** Derivados das tabelas carregadas; entram na mesma transação, antes do commit. */
const AGREGADOS = ['truncate pessoa_perfil, pessoa_termo, pessoa_macrotema, pessoa_colecao, orientacao, colecao_perfil, colecao_ano, termo_perfil'];

/** Caem antes do COPY e voltam depois, sobre a tabela já pronta. */
const INDICES = [
  ['documento_tsv_idx', 'create index documento_tsv_idx on documento using gin (tsv)'],
  ['documento_titulo_trgm_idx', 'create index documento_titulo_trgm_idx on documento using gin (titulo gin_trgm_ops)'],
  ['documento_resumo_trgm_idx', 'create index documento_resumo_trgm_idx on documento using gin (resumo gin_trgm_ops)'],
  ['registro_palavra_chave_termo_idx', 'create index registro_palavra_chave_termo_idx on registro_palavra_chave (termo)'],
];

for (const [, arquivo] of TABELAS) {
  if (!existsSync(join(origem, arquivo))) {
    console.error(`Falta ${arquivo} em indice-out. Rode antes: npm run indice:derivar`);
    process.exit(1);
  }
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const segundos = (t) => `${((Date.now() - t) / 1000).toFixed(1)}s`;

const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await cliente.connect();

try {
  const inicio = Date.now();

  // 210 MB de COPY mais a reconstrução dos GIN passam de longe do teto padrão.
  // Sem isto, o Postgres derruba a transação no meio e o rollback desfaz o
  // trabalho inteiro sem dizer com clareza por quê.
  await cliente.query('set statement_timeout = 0');
  await cliente.query('set idle_in_transaction_session_timeout = 0');
  await cliente.query('set lock_timeout = 0');

  // Uma transação só: ou o índice inteiro troca, ou nada muda. Um banco com
  // metade das tabelas da versão nova responderia contagem errada com cara de
  // resposta certa, que é o pior defeito possível neste projeto.
  await cliente.query('begin');

  // Os vetores sobrevivem à recarga.
  //
  // `documento_embedding` referencia `documento` com `on delete cascade`, e o
  // `truncate ... cascade` abaixo levaria os 85 mil vetores junto. Na máquina de
  // quem carrega isso quase não se nota: `indice:embeddings` reencontra tudo no
  // cache local e recarrega de graça. Numa rotina de CI, onde o cache começa
  // vazio, significaria pagar US$ 8 em embeddings **toda semana** — sozinho,
  // acima do teto de US$ 35/mês da R5 do ADR 003.
  //
  // A cópia é temporária e vive dentro desta transação: se a carga abortar, ela
  // some junto e o `documento_embedding` original continua intacto pelo rollback.
  // O vetor só volta para obra cujo id sobreviveu à recarga; o resto é descartado,
  // e `indice:embeddings` recalcula o que faltar.
  await cliente.query('create temp table embedding_preservado on commit drop as table documento_embedding');
  const { rows: [{ n: preservados }] } = await cliente.query('select count(*)::int as n from embedding_preservado');

  await cliente.query(`truncate ${TABELAS.map(([t]) => t).join(', ')} restart identity cascade`);
  for (const [nome] of INDICES) await cliente.query(`drop index if exists ${nome}`);
  // Reinserir 85 mil vetores com o HNSW montado custa minutos; sem ele, segundos.
  await cliente.query('drop index if exists documento_embedding_hnsw_idx');

  for (const [tabela, arquivo, colunas] of TABELAS) {
    const t = Date.now();
    const caminho = join(origem, arquivo);
    const fluxo = cliente.query(copyFrom(
      `copy ${tabela} ${colunas} from stdin with (format csv, null '\\N', quote '"')`,
    ));
    await pipeline(createReadStream(caminho), fluxo);
    console.log(`  ${tabela.padEnd(24)} ${mb(statSync(caminho).size).padStart(9)}  ${segundos(t)}`);
  }

  // De volta, só o que ainda tem obra correspondente.
  if (preservados) {
    const t = Date.now();
    const { rowCount } = await cliente.query(`
      insert into documento_embedding (documento_id, embedding, modelo, texto_sha256)
      select p.documento_id, p.embedding, p.modelo, p.texto_sha256
      from embedding_preservado p join documento d on d.id = p.documento_id
    `);
    await cliente.query('create index documento_embedding_hnsw_idx on documento_embedding using hnsw (embedding extensions.halfvec_cosine_ops)');
    console.log(`  ${'documento_embedding'.padEnd(24)} ${String(rowCount).padStart(9)}  ${segundos(t)} (de ${preservados} preservados)`);
  }

  // As sequências continuam de onde os ids da derivação pararam.
  await cliente.query("select setval(pg_get_serial_sequence('registro', 'id'), coalesce((select max(id) from registro), 1))");
  await cliente.query("select setval(pg_get_serial_sequence('pessoa', 'id'), coalesce((select max(id) from pessoa), 1))");

  console.log('\n  reconstruindo índices GIN...');
  for (const [, sql] of INDICES) {
    const t = Date.now();
    await cliente.query(sql);
    console.log(`  ${sql.split(' ')[2].padEnd(24)} ${segundos(t).padStart(20)}`);
  }

  // Frequência de lexema e perfis envelhecem junto com as tabelas: um índice
  // novo com agregados antigos responde número errado sem sinal nenhum.
  for (const sql of AGREGADOS) await cliente.query(sql);
  let t = Date.now();
  const { rows: [{ atualizar_lexema_frequencia: lexemas }] } = await cliente.query('select atualizar_lexema_frequencia()');
  console.log(`\n  lexema_frequencia        ${lexemas} linhas  ${segundos(t)}`);
  t = Date.now();
  const { rows: perfis } = await cliente.query('select * from atualizar_perfis()');
  for (const p of perfis) console.log(`  ${p.tabela.padEnd(24)} ${p.linhas} linhas`);
  console.log(`  perfis em ${segundos(t)}`);

  await cliente.query('commit');
  await cliente.query('analyze');

  const { rows: [conta] } = await cliente.query(`
    select
      (select count(*) from registro) as registros,
      (select count(*) from documento) as documentos,
      (select count(*) from registro where resumo_utilizavel) as registros_com_resumo,
      (select count(*) from pessoa) as pessoas,
      (select count(*) from pessoa_grafia) as grafias,
      (select count(*) from registro_pessoa) as vinculos,
      (select count(*) from registro_palavra_chave) as palavras_chave,
      (select base_version from indice_meta) as base_version
  `);
  console.log(`\n  base_version ${conta.base_version}, em ${segundos(inicio)}`);
  for (const [k, v] of Object.entries(conta)) if (k !== 'base_version') console.log(`  ${k.padEnd(22)} ${v}`);
} catch (erro) {
  await cliente.query('rollback').catch(() => {});
  // A mensagem do driver pode trazer a string de conexão: corta antes de exibir.
  const limpo = (v) => String(v ?? '').replace(/postgresql:\/\/[^\s]+/g, 'postgresql://…');
  console.error('\nCarga abortada, nada foi alterado:', limpo(erro?.message ?? erro));
  // `code`, `detail` e `where` dizem a tabela e a linha; a mensagem sozinha
  // costuma não bastar para achar o defeito.
  for (const campo of ['code', 'detail', 'where', 'table', 'column', 'constraint']) {
    if (erro?.[campo]) console.error(`  ${campo}: ${limpo(erro[campo])}`);
  }
  process.exitCode = 1;
} finally {
  await cliente.end();
}
