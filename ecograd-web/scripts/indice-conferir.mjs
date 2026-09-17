/**
 * Confere o índice depois da carga — o passo que transforma "o job rodou" em
 * "o índice responde".
 *
 *   SUPABASE_DB_URL=... node scripts/indice-conferir.mjs
 *
 * Existe porque as duas cargas falham de jeitos diferentes. A por `COPY` é
 * transacional: ou troca tudo, ou não troca nada. A por HTTPS não é — os lotes
 * entram um a um, e uma queda no meio deixa o banco parcial. Em qualquer dos
 * casos, `indice:enriquecer` e `indice:embeddings` rodam depois do carimbo e
 * podem falhar sozinhos, deixando um índice que existe e responde errado.
 *
 * Aqui nada é reparado: o programa só olha e sai com código 1 quando o que
 * encontra não serve. Numa rotina automática, falhar alto é melhor do que
 * seguir com um acervo pela metade.
 */
import { Client } from 'pg';

/**
 * `--esquema` confere só se o banco aceita o que a carga vai mandar, e sai. Roda
 * antes de derivar: descobrir no meio do COPY que falta uma coluna custa os três
 * minutos da derivação, e a mensagem do Postgres (42703) não diz o que fazer.
 */
const soEsquema = process.argv.includes('--esquema');

/** Colunas que a carga escreve e que entraram depois da primeira versão do índice. */
const COLUNAS_ESPERADAS = [
  ['indice_meta', 'sha256_lotes', "alter table indice_meta add column sha256_lotes text not null default ''"],
];

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Defina SUPABASE_DB_URL.');
  process.exit(1);
}

/** Abaixo disto o acervo está claramente truncado, não apenas menor. */
const MINIMO_REGISTROS = 50000;
/** Quanto do que tem resumo precisa ter vetor para a busca por significado valer. */
const COBERTURA_VETOR_MINIMA = 0.9;

const cliente = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
const problemas = [];
const limpo = (v) => String(v ?? '').replace(/postgresql:\/\/[^\s]+/g, 'postgresql://…');

/**
 * Onde a conexão está tentando chegar, sem a senha.
 *
 * Existe porque "password authentication failed for user X" não diz se o X veio
 * da string que se pretendia usar. O Supabase oferece duas conexões — a direta
 * (`postgres@db.<ref>.supabase.co`) e o pooler em sessão
 * (`postgres.<ref>@...pooler...`) —, e de fora do log é impossível saber qual
 * está no segredo. Adivinhar custou três execuções; isto responde na primeira.
 *
 * A senha nunca é impressa, nem o comprimento dela: só host, porta, banco e
 * usuário, que são os três campos que distinguem uma conexão da outra.
 */
function paraOndeAponta(u) {
  try {
    const { hostname, port, username, pathname } = new URL(u);
    return `host=${hostname} porta=${port || '5432'} banco=${pathname.slice(1) || '?'} usuário=${decodeURIComponent(username) || '(vazio)'}`;
  } catch {
    return 'a string de conexão não é uma URL válida (senha com caractere especial precisa de codificação: @ vira %40)';
  }
}

try {
  await cliente.connect();

  const faltando = [];
  for (const [tabela, coluna, remedio] of COLUNAS_ESPERADAS) {
    const { rows } = await cliente.query(
      'select 1 from information_schema.columns where table_name = $1 and column_name = $2',
      [tabela, coluna],
    );
    if (!rows.length) faltando.push(`${tabela}.${coluna} não existe. Aplique:  ${remedio}`);
  }
  if (faltando.length) {
    console.error('O esquema do banco está atrás do que a carga escreve:');
    for (const f of faltando) console.error(`  - ${f}`);
    process.exit(1);
  }
  if (soEsquema) {
    console.log('Esquema compatível com a carga.');
    await cliente.end();
    process.exit(0);
  }

  const { rows: [meta] } = await cliente.query(
    'select base_version, sha256_lotes, gerado_em, registros, documentos from indice_meta',
  );
  // Carga interrompida deixa as tabelas parciais e `indice_meta` vazia, de
  // propósito: sem o carimbo, a aplicação trata o índice como indisponível.
  if (!meta) {
    console.error('indice_meta vazia: a carga não chegou ao fim.');
    process.exit(1);
  }

  const { rows: [c] } = await cliente.query(`
    select
      (select count(*) from registro) as registros,
      (select count(*) from documento) as documentos,
      (select count(*) from documento where resumo_utilizavel) as com_resumo,
      (select count(*) from documento_embedding) as vetores,
      (select count(*) from pessoa) as pessoas,
      (select count(*) from termo_perfil) as termos,
      (select count(*) from rede_metrica) as rede
  `);

  console.log(`base_version ${meta.base_version}  ·  gerado em ${new Date(meta.gerado_em).toISOString()}`);
  for (const [k, v] of Object.entries(c)) console.log(`  ${k.padEnd(12)} ${Number(v).toLocaleString('pt-BR')}`);

  // O carimbo tem que descrever o que está nas tabelas.
  if (Number(c.registros) !== Number(meta.registros)) problemas.push(`indice_meta diz ${meta.registros} registros, e há ${c.registros}`);
  if (Number(c.documentos) !== Number(meta.documentos)) problemas.push(`indice_meta diz ${meta.documentos} documentos, e há ${c.documentos}`);
  if (Number(c.registros) < MINIMO_REGISTROS) problemas.push(`só ${c.registros} registros: acervo truncado`);

  // O enriquecimento roda depois do carimbo e pode falhar sozinho.
  if (Number(c.pessoas) === 0) problemas.push('nenhuma pessoa: a carga de pessoas não entrou');
  if (Number(c.termos) === 0) problemas.push('termo_perfil vazio: `indice:enriquecer` não rodou ou falhou');
  if (Number(c.rede) === 0) problemas.push('rede_metrica vazia: `indice:enriquecer` não rodou ou falhou');

  const cobertura = Number(c.com_resumo) ? Number(c.vetores) / Number(c.com_resumo) : 0;
  console.log(`  cobertura de vetor   ${(cobertura * 100).toFixed(1)}%`);
  if (cobertura < COBERTURA_VETOR_MINIMA) {
    problemas.push(`só ${(cobertura * 100).toFixed(1)}% das obras com resumo têm vetor: a busca por significado fica cega no resto`);
  }

  // Contar não basta: as funções que a tela chama precisam responder.
  const t = Date.now();
  const { rows: [{ panorama }] } = await cliente.query(
    `select panorama_tematico('[["empreendedorismo"],["feminino","mulheres"]]'::jsonb, 5) as panorama`,
  );
  const obras = Number(panorama?.obras ?? 0);
  console.log(`  panorama_tematico    ${obras} obras em ${Date.now() - t} ms`);
  if (!obras) problemas.push('panorama_tematico não achou nada num tema que existe no acervo');

  const { rows: [{ lista }] } = await cliente.query(
    `select obras_do_tema('[["empreendedorismo"],["feminino","mulheres"]]'::jsonb) as lista`,
  );
  if (Number(lista?.obras ?? 0) !== obras) {
    problemas.push(`obras_do_tema conta ${lista?.obras}, panorama_tematico conta ${obras}: as duas precisam ver o mesmo recorte`);
  }
} catch (erro) {
  console.error('Falha ao conferir:', limpo(erro?.message ?? erro));
  // Erro de autenticação ou de rede quase nunca é do banco: é da string. Dizer
  // para onde ela aponta transforma três tentativas às cegas numa correção.
  console.error(`  conexão tentada: ${paraOndeAponta(url)}`);
  if (String(erro?.message ?? '').includes('password authentication failed')) {
    console.error('  Se o usuário acima for "postgres", o segredo tem a conexão DIRETA.');
    console.error('  A rotina precisa do Session pooler: usuário "postgres.<ref>", host "...pooler.supabase.com".');
    console.error('  Se já for "postgres.<ref>", então a string está certa e a senha é que não confere.');
  }
  process.exit(1);
} finally {
  await cliente.end().catch(() => {});
}

if (problemas.length) {
  console.error(`\n${problemas.length} problema(s) no índice:`);
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nÍndice conferido: carimbo, contagens, enriquecimento e funções de consulta em ordem.');
