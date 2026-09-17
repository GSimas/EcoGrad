/**
 * Confere a camada de consulta do NL2SQL (ADR 004, fase A0) contra os gabaritos
 * da Etapa 0, pelo mesmo caminho que o modelo vai usar: `consultar()` com a
 * chave pública do app, como `consulta_leitor`, só sobre as views.
 *
 *   npm run afericao:consultar
 *
 * Cada conferência é um par pergunta → SQL de referência. Além de provar que as
 * views reproduzem os números, os pares são os exemplos que o modelo vai ver
 * antes de escrever SQL — e por isso estão escritos como ele deveria escrever.
 *
 * Os gabaritos contam pessoa por grafia; o índice conta pessoa unificada. Onde a
 * unificação muda o número de propósito, a conferência diz qual fusão explica a
 * diferença, em vez de trocar o gabarito em silêncio.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const G = JSON.parse(readFileSync(join(raizApp, '..', 'docs', 'evidencias', 'afericao', 'gabaritos.json'), 'utf8'));
/** O SQL de referência é o mesmo que o UFSCão mostra ao modelo como exemplo: conferir um é conferir o outro. */
const SQL = Object.fromEntries(JSON.parse(readFileSync(join(raizApp, 'src', 'lib', 'consultas-exemplo.json'), 'utf8')).map((e) => [e.id, e.sql]));

const env = existsSync(join(raizApp, '.env')) ? readFileSync(join(raizApp, '.env'), 'utf8') : '';
const de = (k) => process.env[k] ?? env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
const url = String(de('VITE_INDICE_URL') ?? '').replace(/\/+$/, '');
const chave = de('VITE_INDICE_CHAVE');
if (!url || !chave) throw new Error('VITE_INDICE_URL e VITE_INDICE_CHAVE ausentes.');

async function consultar(sql, limite = 50) {
  const r = await fetch(`${url}/rest/v1/rpc/consultar`, {
    method: 'POST',
    headers: { apikey: chave, authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
    body: JSON.stringify({ consulta_sql: sql, limite }),
    signal: AbortSignal.timeout(15000),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo.message ?? `HTTP ${r.status}`);
  return corpo.linhas;
}

export const CONFERENCIAS = [
  {
    id: 'Q01', pergunta: 'Quantos trabalhos tem o programa de Engenharia e Gestão do Conhecimento, e de que níveis?',
    sql: SQL.Q01,
    esperado: G.Q01_colecaoEgc,
    obtido: (l) => ({ registros: l.reduce((s, x) => s + x.registros, 0), niveis: l.map((x) => [x.nivel_academico, x.registros]),
      anoMin: Math.min(...l.map((x) => x.ano_min)), anoMax: Math.max(...l.map((x) => x.ano_max)), semResumoUtilizavel: l.reduce((s, x) => s + x.registros_sem_resumo, 0) }),
  },
  {
    id: 'Q02', pergunta: 'Como a produção do EGC evoluiu ano a ano?',
    sql: SQL.Q02,
    esperado: G.Q02_egcPorAno.serie,
    obtido: (l) => l.map((x) => [String(x.ano), Number(x.registros)]),
  },
  {
    id: 'Q03', pergunta: 'Quem mais orientou na pós-graduação?',
    sql: SQL.Q03,
    esperado: G.Q03_orientaMais.ranking,
    obtido: (l) => l.map((x) => [x.nome, x.registros_orientados]),
  },
  {
    id: 'Q04', pergunta: 'Qual o tamanho do acervo?',
    sql: SQL.Q04,
    esperado: G.Q04_tamanhoAcervo,
    obtido: ([x]) => ({ registros: x.registros, comResumoUtilizavel: x.registros_com_resumo, semResumoUtilizavel: x.registros_sem_resumo, niveis: x.niveis }),
  },
  {
    id: 'Q05', pergunta: 'Quantos trabalhos a Patricia de Sá Freire tem, e em quais papéis?',
    sql: SQL.Q05,
    // O gabarito conta a grafia "Freire, Patricia De Sa". A unificação funde nela
    // "Freire, Patricia Sa" (uma orientação de TCC em Administração, 2018): a
    // diferença esperada é exatamente +1 orientação e +1 grafia.
    esperado: { autor: G.Q05_pessoaTresPapeis.autor, orientador: G.Q05_pessoaTresPapeis.orientador + 1, coorientador: G.Q05_pessoaTresPapeis.coorientador, grafias: 2 },
    obtido: ([x]) => ({ autor: x.obras_como_autor, orientador: x.obras_orientadas, coorientador: x.obras_coorientadas, grafias: x.grafias }),
  },
  {
    id: 'Q08', pergunta: 'Educação infantil aparece mais como palavra-chave ou como macrotema?',
    sql: SQL.Q08,
    esperado: G.Q08_educacaoInfantil,
    obtido: ([x]) => ({ comoPalavraChave: x.registros_palavra_chave, comoMacrotema: x.registros_macrotema }),
  },
  {
    id: 'Q09', pergunta: 'Quais os macrotemas mais frequentes?',
    sql: SQL.Q09,
    esperado: G.Q09_topMacrotemas.ranking,
    obtido: (l) => l.map((x) => [x.macrotema, x.registros]),
  },
  {
    id: 'Q23', pergunta: 'Quantos trabalhos houve nos últimos anos?',
    sql: SQL.Q23,
    esperado: G.Q23_anoParcial.serieRecente,
    obtido: (l) => l.map((x) => [String(x.ano), Number(x.registros)]),
  },
  {
    id: 'Q25', pergunta: 'Este título aparece em quantos registros?',
    sql: `select colecao from registros where titulo = '${G.Q25_tituloRepetido.titulo.replace(/'/g, "''")}' order by colecao`,
    esperado: [...G.Q25_tituloRepetido.colecoes].sort(),
    obtido: (l) => l.map((x) => x.colecao).sort(),
  },
];

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let falhas = 0;
for (const c of CONFERENCIAS) {
  const t = Date.now();
  try {
    const obtido = c.obtido(await consultar(c.sql));
    const ok = igual(obtido, c.esperado);
    if (!ok) falhas += 1;
    console.log(`${ok ? '✔' : '✖'} ${c.id} ${c.pergunta} (${Date.now() - t} ms)`);
    if (!ok) console.log(`   esperado ${JSON.stringify(c.esperado)}\n   obtido   ${JSON.stringify(obtido)}`);
  } catch (erro) {
    falhas += 1;
    console.log(`✖ ${c.id} ${c.pergunta}: ${erro.message}`);
  }
}
console.log(`\n${CONFERENCIAS.length - falhas} de ${CONFERENCIAS.length} conferências passaram.`);
process.exitCode = falhas ? 1 : 0;
