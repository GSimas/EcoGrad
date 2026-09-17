/**
 * Carrega o índice da Etapa 2 pela API REST, em HTTPS (ADR 001).
 *
 *   $env:SUPABASE_URL = 'https://<ref>.supabase.co'
 *   $env:SUPABASE_SERVICE_ROLE_KEY = '<chave service_role>'
 *   npm run indice:carregar:https
 *
 * Existe porque `COPY` não é alcançável de toda rede: onde a porta 5432 está
 * fechada — o caso de qualquer firewall corporativo comum —, `indice-carregar.mjs`
 * nem chega a conectar. Aqui tudo passa pela 443, que nenhuma rede bloqueia.
 *
 * O preço é honesto e precisa ser dito: **não há transação**. O COPY trocava o
 * índice inteiro ou nada; aqui os lotes entram um a um, e uma falha no meio
 * deixa o banco parcial. Por isso o programa confere as contagens no fim e
 * grava `indice_meta` por último: sem `indice_meta`, a aplicação trata o índice
 * como indisponível em vez de responder sobre meia base.
 *
 * A chave service_role vem do ambiente, nunca do repositório, e não é impressa
 * em lugar nenhum — nem em mensagem de erro.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const origem = join(raizApp, 'indice-out');

/**
 * Rede que inspeciona TLS reassina o certificado com uma CA própria, e o Node
 * — que tem o próprio conjunto de CAs, diferente do Windows — rejeita com
 * `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Numa carga de milhares de requisições a
 * inspeção aparece de forma intermitente, então não há tamanho de lote que
 * evite: o jeito é confiar na CA corporativa sempre.
 *
 * `NODE_EXTRA_CA_CERTS` só é lido na partida do processo, por isso o programa
 * se reexecuta uma vez com a variável posta. Sem isso, a correção dependeria de
 * alguém lembrar de exportá-la em toda recarga do índice.
 */
const caLocal = process.env.INDICE_CA_BUNDLE ?? join(raizApp, 'ca-windows.pem');
if (!process.env.NODE_EXTRA_CA_CERTS && existsSync(caLocal)) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_EXTRA_CA_CERTS: caLocal },
  });
  process.exit(r.status ?? 1);
}

/**
 * `INDICE_SIMULAR=1` percorre os CSV inteiros, converte cada linha e não envia
 * nada. Valida tipo e forma sem gastar rede nem credencial — e é o que teria
 * encontrado, em segundos, a coluna tipada errada que derrubou a primeira carga.
 */
const simular = process.env.INDICE_SIMULAR === '1';

const base = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!simular && (!base || !chave)) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.');
  console.error("  $env:SUPABASE_URL = 'https://<ref>.supabase.co'");
  console.error("  $env:SUPABASE_SERVICE_ROLE_KEY = '<chave service_role, em Settings > API>'");
  process.exit(1);
}

/**
 * Tabela, arquivo, colunas na ordem em que a derivação as escreveu, e o tipo
 * das que não são texto.
 *
 * O tipo é **por tabela**, e não por nome de coluna, porque `id` é inteiro em
 * `pessoa` e `registro` e texto em `documento` — ali ele é a identidade
 * normalizada do título. Tipar por nome fazia `Number('boletim informativo do
 * pga')` virar NaN, que o JSON serializa como null, e o banco recusava a linha
 * por coluna obrigatória nula. A tabela `documento` inteira falhava assim.
 */
const TABELAS = [
  ['documento', 'documento.csv', ['id', 'titulo', 'resumo', 'resumo_sha256', 'resumo_utilizavel', 'id_obra'], { resumo_utilizavel: 'bool' }],
  ['pessoa', 'pessoa.csv', ['id', 'nome_canonico'], { id: 'int' }],
  ['pessoa_grafia', 'pessoa_grafia.csv', ['grafia', 'pessoa_id'], { pessoa_id: 'int' }],
  ['registro', 'registro.csv', ['id', 'documento_id', 'colecao', 'catalogo', 'ano', 'nivel_academico', 'macrotema', 'url', 'resumo_utilizavel'], { id: 'int', ano: 'int', resumo_utilizavel: 'bool' }],
  ['registro_pessoa', 'registro_pessoa.csv', ['registro_id', 'pessoa_id', 'papel'], { registro_id: 'int', pessoa_id: 'int' }],
  ['registro_palavra_chave', 'registro_palavra_chave.csv', ['registro_id', 'termo'], { registro_id: 'int' }],
  // ADR 004: saem de `npm run indice:enriquecer`, que roda antes da derivação.
  ['pessoa_fusao', 'pessoa_fusao.csv', ['grafia', 'canonico', 'metodo'], {}],
  ['rede_metrica', 'rede_metrica.csv', ['escopo', 'colecao', 'tipo', 'rotulo', 'grau_absoluto', 'grau', 'intermediacao', 'proximidade', 'agrupamento', 'comunidade', 'ranking', 'nos_na_rede'],
    { grau_absoluto: 'int', grau: 'num', intermediacao: 'num', proximidade: 'num', agrupamento: 'num', comunidade: 'int', ranking: 'int', nos_na_rede: 'int' }],
  // Por último, de propósito: é o carimbo de que a carga terminou inteira.
  ['indice_meta', 'indice_meta.csv', ['id', 'base_version', 'sha256_pos', 'sha256_tcc', 'gerado_em', 'registros', 'documentos'], { id: 'bool', registros: 'int', documentos: 'int' }],
];


/**
 * Teto por requisição. Começou em 3 MB e a primeira requisição já era recusada
 * no nível da conexão — o gateway do Supabase corta corpo grande antes de virar
 * resposta HTTP, então não chega nem a dar 413. Meio megabyte passa com folga,
 * e o custo de fazer mais requisições é irrelevante perto de uma carga que não
 * completa. Dá para ajustar pelo ambiente sem editar o programa.
 */
const BYTES_POR_LOTE = Number(process.env.INDICE_BYTES_LOTE ?? 512 * 1024);
const LINHAS_POR_LOTE = Number(process.env.INDICE_LINHAS_LOTE ?? 200);

/**
 * Lê o CSV do Postgres linha a linha. Campo entre aspas pode conter vírgula,
 * aspas dobradas e quebra de linha — resumo acadêmico tem os três.
 */
async function* registros(caminho, colunas, tipos) {
  const leitor = createInterface({ input: createReadStream(caminho, { encoding: 'utf8' }), crlfDelay: Infinity });
  let pendente = '';
  for await (const pedaco of leitor) {
    pendente = pendente ? `${pendente}\n${pedaco}` : pedaco;
    const campos = tentarLinha(pendente);
    if (!campos) continue;                   // aspas abertas: a linha continua
    pendente = '';
    const linha = {};
    colunas.forEach((c, i) => { linha[c] = converter(tipos[c], campos[i]); });
    yield linha;
  }
  if (pendente.trim()) throw new Error(`CSV termina com aspas abertas em ${caminho}`);
}

/** Devolve os campos, ou null se a linha ficou com aspas abertas. */
function tentarLinha(texto) {
  const campos = [];
  let campo = '', dentro = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentro) {
      if (c !== '"') { campo += c; continue; }
      if (texto[i + 1] === '"') { campo += '"'; i++; continue; }
      dentro = false;
    } else if (c === '"') dentro = true;
    else if (c === ',') { campos.push(campo); campo = ''; }
    else campo += c;
  }
  if (dentro) return null;
  campos.push(campo);
  return campos;
}

function converter(tipo, valor) {
  if (valor === undefined || valor === '\N' || valor === '') return null;
  if (tipo === 'bool') return valor === 't';
  if (tipo === 'int' || tipo === 'num') {
    const n = Number(valor);
    // Falhar aqui é melhor do que mandar NaN: o JSON o serializa como null, e o
    // banco recusa a linha com um erro que não aponta para a causa.
    if (!Number.isFinite(n)) throw new Error(`coluna inteira recebeu ${JSON.stringify(valor).slice(0, 60)}`);
    return n;
  }
  return valor;
}

/** A causa real de um `fetch failed` mora em `cause`, e sem ela não dá diagnóstico. */
function porQue(erro) {
  const partes = [String(erro?.message ?? erro)];
  for (let c = erro?.cause, n = 0; c && n < 4; c = c.cause, n++) {
    partes.push(`${c.code ?? c.name ?? 'causa'}: ${c.message ?? c}`);
  }
  return partes.join(' | ');
}

async function enviar(tabela, lote) {
  for (let tentativa = 1; ; tentativa++) {
    let r;
    try {
      r = await fetch(`${base}/rest/v1/${tabela}`, {
        method: 'POST',
        headers: {
          apikey: chave,
          authorization: `Bearer ${chave}`,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify(lote),
      });
    } catch (erro) {
      // `fetch` que lança é falha de conexão, não resposta: numa carga de
      // centenas de requisições isso acontece, e antes escapava sem repetição
      // nenhuma porque só o `status` era considerado.
      if (tentativa < 5) { await new Promise((s) => setTimeout(s, 1000 * tentativa)); continue; }
      throw new Error(`${tabela}: conexão falhou após ${tentativa} tentativas — ${porQue(erro)}`);
    }
    if (r.ok) return;
    const corpo = (await r.text()).slice(0, 400);
    // 5xx e 429 costumam ser passageiros; erro de dados não melhora com espera.
    if (tentativa < 5 && (r.status >= 500 || r.status === 429)) {
      await new Promise((s) => setTimeout(s, 1000 * tentativa));
      continue;
    }
    throw new Error(`${tabela}: HTTP ${r.status} — ${corpo}`);
  }
}

const segundos = (t) => `${((Date.now() - t) / 1000).toFixed(1)}s`;
const inicio = Date.now();

for (const [tabela, arquivo, colunas, tipos] of TABELAS) {
  const caminho = join(origem, arquivo);
  if (!existsSync(caminho)) {
    console.error(`Falta ${arquivo} em indice-out. Rode antes: npm run indice:derivar`);
    process.exit(1);
  }
  const t = Date.now();
  let lote = [], bytes = 0, total = 0;
  const despachar = async () => {
    if (!lote.length) return;
    if (!simular) await enviar(tabela, lote);
    total += lote.length;
    process.stdout.write(`\r  ${tabela.padEnd(24)} ${String(total).padStart(7)} linhas`);
    lote = []; bytes = 0;
  };
  try {
    for await (const linha of registros(caminho, colunas, tipos)) {
      const texto = JSON.stringify(linha);
      if (lote.length >= LINHAS_POR_LOTE || bytes + texto.length > BYTES_POR_LOTE) await despachar();
      lote.push(linha);
      bytes += texto.length;
    }
    await despachar();
  } catch (erro) {
    console.error(`\n\nCarga interrompida em ${tabela}. O banco ficou parcial: rode de novo do zero.`);
    console.error(porQue(erro).replaceAll(chave, '<chave>'));
    process.exit(1);
  }
  console.log(`\r  ${tabela.padEnd(24)} ${String(total).padStart(7)} linhas  ${segundos(t)}`);
}


// A frequência de lexema é derivada de `documento` e envelhece junto com ela.
// Recalcular faz parte da carga, não é manutenção à parte: um índice novo com
// a frequência antiga produz lift errado e expansão errada, sem nenhum sinal
// de que algo está errado.
if (!simular) {
  const t = Date.now();
  const r = await fetch(`${base}/rest/v1/rpc/atualizar_lexema_frequencia`, {
    method: 'POST',
    headers: { apikey: chave, authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) {
    console.error(`  frequência de lexemas NÃO atualizada: HTTP ${r.status}`);
    console.error('  o tesauro vai usar a frequência anterior; rode de novo antes de confiar na expansão.');
    process.exitCode = 1;
  } else {
    console.log(`  lexemas distintos        ${await r.json()}  ${segundos(t)}`);
  }
}

// Perfis e agregados do ADR 004, refeitos das tabelas que acabaram de entrar.
if (!simular) {
  const t = Date.now();
  const r = await fetch(`${base}/rest/v1/rpc/atualizar_perfis`, {
    method: 'POST',
    headers: { apikey: chave, authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) {
    console.error(`  perfis NÃO atualizados: HTTP ${r.status}. Rode "select * from atualizar_perfis()" no SQL Editor do Supabase.`);
    process.exitCode = 1;
  } else {
    for (const p of await r.json()) console.log(`  ${p.tabela.padEnd(24)} ${p.linhas} linhas`);
    console.log(`  perfis em ${segundos(t)}`);
  }
}

console.log(simular
  ? `\nSimulação concluída em ${segundos(inicio)}: nada foi enviado.`
  : `\nCarga concluída em ${segundos(inicio)}.`);
