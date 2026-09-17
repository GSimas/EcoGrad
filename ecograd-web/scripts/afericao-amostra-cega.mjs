/**
 * Amostra cega de temas sorteados, só precisão — a regra R6 do ADR 003.
 *
 *   npm run afericao:amostra-cega
 *
 * Todo número do ADR 003 vale para um único tema, empreendedorismo feminino, e a
 * primeira consulta dele foi escrita por quem já sabia a resposta. Antes de
 * decidir a Etapa 4, a recuperação corrente (`buscar_texto`, FTS com tesauro)
 * precisa ser medida em temas que ninguém escolheu.
 *
 * **Cego de duas formas.**
 * - Ninguém escolhe os temas: são palavras-chave do próprio acervo, sorteadas
 *   com semente tirada do sha256 da base de pós. Base nova, sorteio novo; mesma
 *   base, mesmo sorteio, e qualquer um reproduz.
 * - Quem tria não vê ordem, aderência nem a consulta expandida: as obras de cada
 *   tema saem embaralhadas na planilha.
 *
 * **Dois estratos**, porque R1 pede a porta medida onde o tesauro falha: semente
 * pequena (3 a 5 obras alcançadas por rótulo, o regime de Q11) e semente grande
 * (20 ou mais, o regime de Q10).
 *
 * **Só precisão**, que não exige denominador completo: pertence ÷ (pertence +
 * não pertence) entre as até 25 obras devolvidas — a profundidade da D8. Tema
 * que o índice não respondeu conta como falha à parte, nunca como precisão zero.
 *
 * O sorteio e as respostas do índice são congelados na primeira execução em
 * `amostra-cega.json`; rodar de novo só regenera a planilha e recalcula a
 * precisão com as decisões preenchidas. Para sortear de novo, apague o JSON.
 */
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chave, identidadeObra } from './afericao-padroes.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');
const destino = join(raizRepo, 'docs', 'evidencias', 'afericao');
const caminhoJson = join(destino, 'amostra-cega.json');
const caminhoMd = join(destino, 'amostra-cega.md');

const POR_ESTRATO = 4;
const LIMITE = 25;
const ESTRATOS = [
  { id: 'pequena', rotulo: 'semente pequena (3 a 5 obras)', cabe: (n) => n >= 3 && n <= 5 },
  { id: 'grande', rotulo: 'semente grande (20 obras ou mais)', cabe: (n) => n >= 20 },
];
const DECISOES = ['pertence', 'nao_pertence', 'duvida'];
const ROTULO = { pertence: 'pertence', nao_pertence: 'não pertence', duvida: 'dúvida' };

function ler(nome) {
  const caminho = [join(raizRepo, nome), join(raizApp, 'public', 'data', nome)].find(existsSync);
  if (!caminho) throw new Error(`Base ausente: ${nome}. Rode npm run sync:data.`);
  const bruto = readFileSync(caminho);
  return { docs: JSON.parse(gunzipSync(bruto).toString('utf8')), sha256: createHash('sha256').update(bruto).digest('hex') };
}

/** mulberry32: pequeno, determinístico e suficiente para sortear sem viés de quem roda. */
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const embaralhar = (lista, sorte) => {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(sorte() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
};

/** O ambiente vence o `.env`: o mesmo par de variáveis que o app usa. */
function configIndice() {
  const env = existsSync(join(raizApp, '.env')) ? readFileSync(join(raizApp, '.env'), 'utf8') : '';
  const de = (k) => process.env[k] ?? env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
  const url = String(de('VITE_INDICE_URL') ?? '').replace(/\/+$/, '');
  const chaveApi = de('VITE_INDICE_CHAVE');
  if (!url || !chaveApi) throw new Error('VITE_INDICE_URL e VITE_INDICE_CHAVE ausentes no ambiente e no .env.');
  return async (funcao, corpo) => {
    const r = await fetch(`${url}/rest/v1/rpc/${funcao}`, {
      method: 'POST',
      headers: { apikey: chaveApi, authorization: `Bearer ${chaveApi}`, 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(20000),
    });
    const texto = await r.text();
    if (!r.ok) throw new Error(`${r.status}: ${JSON.parse(texto)?.message ?? texto}`);
    return JSON.parse(texto);
  };
}

const pos = ler('base_consolidada_ufsc.json.gz');
const tcc = ler('base_tcc_ufsc.json.gz');
const todos = [...pos.docs, ...tcc.docs];

/** Resumo mais longo por obra, a mesma regra de `indice-derivar`. */
const resumos = new Map();
for (const d of todos) {
  const id = identidadeObra(d.titulo);
  const r = String(d.resumo ?? '').trim();
  if (id && r.length > (resumos.get(id)?.length ?? -1)) resumos.set(id, r);
}

async function sortear() {
  // Pool: palavra-chave presente em 3 ou mais obras. A forma exibida é a grafia
  // mais comum; a comparação é sem acento e sem caixa, como a semente do tesauro.
  const obrasPorTermo = new Map();
  const grafias = new Map();
  for (const d of todos) {
    for (const p of d.palavras_chave || []) {
      const k = chave(p).replace(/\s+/g, ' ').trim();
      if (k.length < 4 || !/[a-z]/.test(k)) continue;
      (obrasPorTermo.get(k) ?? obrasPorTermo.set(k, new Set()).get(k)).add(identidadeObra(d.titulo));
      const g = grafias.get(k) ?? grafias.set(k, new Map()).get(k);
      g.set(p.trim(), (g.get(p.trim()) ?? 0) + 1);
    }
  }
  const pool = [...obrasPorTermo].filter(([, s]) => s.size >= 3).map(([k]) => k).sort();

  // Semente como `tesauro()`: título, macrotema ou palavra-chave contendo a consulta.
  const rotulos = todos.map((d) => ({ id: identidadeObra(d.titulo), titulo: chave(d.titulo), macrotema: chave(d.macrotema), pcs: (d.palavras_chave || []).map(chave) }));
  const tamanhoSemente = (k) => new Set(rotulos.filter((r) => r.titulo.includes(k) || r.macrotema.includes(k) || r.pcs.some((p) => p.includes(k))).map((r) => r.id)).size;

  const semente = parseInt(pos.sha256.slice(0, 8), 16);
  const sorte = aleatorio(semente);
  const vagas = Object.fromEntries(ESTRATOS.map((e) => [e.id, []]));
  for (const k of embaralhar(pool, sorte)) {
    if (ESTRATOS.every((e) => vagas[e.id].length >= POR_ESTRATO)) break;
    const n = tamanhoSemente(k);
    const e = ESTRATOS.find((x) => x.cabe(n) && vagas[x.id].length < POR_ESTRATO);
    if (e) vagas[e.id].push({ termo: k, semente: n });
  }

  const rpc = configIndice();
  const temas = [];
  for (const e of ESTRATOS) {
    for (const { termo, semente: n } of vagas[e.id]) {
      const consulta = [...grafias.get(termo)].sort((a, b) => b[1] - a[1])[0][0];
      const inicio = performance.now();
      let achados = [], falha = null, expandida = null;
      try {
        achados = await rpc('buscar_texto', { consulta, limite: LIMITE });
        expandida = await rpc('consulta_expandida', { consulta }).catch((err) => `não obtida (${err.message})`);
      } catch (err) { falha = err.message; }
      const ms = Math.round(performance.now() - inicio);
      temas.push({
        consulta, estrato: e.id, sementeObras: n, consultaExpandida: expandida, respostaMs: ms, falha,
        descartado: null,
        obras: embaralhar(achados, sorte).map((a) => ({ id: a.documento_id, titulo: a.titulo, decisao: null, justificativa: '' })),
      });
      console.log(`${e.id.padEnd(8)} ${consulta} · semente ${n} · ${falha ? `FALHOU (${falha})` : `${achados.length} obras`} · ${ms} ms`);
    }
  }
  return {
    instrucoes: 'Para cada obra, decisao ("pertence", "nao_pertence" ou "duvida") e justificativa: a obra trata do tema da consulta? Tema que não é tema (lugar, método, termo genérico) pode ser descartado inteiro em "descartado" com o motivo. Assine em responsavel e assinadoEm e rode npm run afericao:amostra-cega.',
    regra: 'ADR 003, R6',
    sementeSorteio: pos.sha256.slice(0, 8),
    bases: { base_consolidada_ufsc: pos.sha256, base_tcc_ufsc: tcc.sha256 },
    geradoEm: new Date().toISOString(),
    responsavel: null, assinadoEm: null,
    temas,
  };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
function medir(temas) {
  const validos = temas.filter((t) => !t.descartado);
  const respondidos = validos.filter((t) => !t.falha);
  const conta = (lista, d) => lista.reduce((s, t) => s + t.obras.filter((o) => o.decisao === d).length, 0);
  const linha = (rotulo, lista) => {
    const sim = conta(lista, 'pertence'), nao = conta(lista, 'nao_pertence');
    return `| ${rotulo} | ${lista.length} | ${pct(sim, sim + nao)} (${sim} de ${sim + nao}) | ${conta(lista, 'duvida')} |`;
  };
  return [
    `Temas válidos: ${validos.length} de ${temas.length} · o índice respondeu ${respondidos.length} (${pct(respondidos.length, validos.length)}).`,
    '',
    '| Recorte | Temas respondidos | Precisão | Dúvidas |',
    '| --- | --- | --- | --- |',
    linha('Todos', respondidos),
    ...ESTRATOS.map((e) => linha(e.rotulo, respondidos.filter((t) => t.estrato === e.id))),
    '',
    '| Tema | Estrato | Precisão | Decididas |',
    '| --- | --- | --- | --- |',
    ...temas.map((t) => {
      const sim = t.obras.filter((o) => o.decisao === 'pertence').length, nao = t.obras.filter((o) => o.decisao === 'nao_pertence').length;
      const situacao = t.descartado ? `descartado: ${t.descartado}` : t.falha ? `índice falhou: ${t.falha}` : pct(sim, sim + nao);
      return `| ${t.consulta} | ${t.estrato} | ${situacao} | ${t.obras.filter((o) => o.decisao).length} de ${t.obras.length} |`;
    }),
  ].join('\n');
}

const limpo = (s) => String(s ?? '').replace(/\r?\n+/g, ' ').replace(/</g, '&lt;').replace(/\|/g, '\\|').trim();
function planilha(a) {
  const blocos = a.temas.map((t, i) => [
    `## ${i + 1}. "${limpo(t.consulta)}"`,
    '',
    t.falha ? `**O índice não respondeu:** ${limpo(t.falha)}. Nada a triar; conta como falha.` : `${t.obras.length} obras, em ordem sorteada.`,
    '',
    ...t.obras.map((o, j) => [
      `### ${i + 1}.${j + 1}. ${limpo(o.titulo)}`,
      '',
      `- Decisão: ${o.decisao ? `**${ROTULO[o.decisao] ?? limpo(o.decisao)}** — ${limpo(o.justificativa) || '_sem justificativa_'}` : '**pendente**'}`,
      '',
      '<details><summary>Resumo</summary>',
      '',
      limpo(resumos.get(o.id)) || '_Sem resumo na base._',
      '',
      '</details>',
      '',
    ].join('\n')),
  ].join('\n'));
  return [
    '# Amostra cega — precisão em temas sorteados',
    '',
    `Regra R6 do [ADR 003](../../ADR-003-O-QUE-A-MEDICAO-MUDOU.md). Sorteio com semente \`${a.sementeSorteio}\` (sha256 da base de pós), bases \`${a.bases.base_consolidada_ufsc.slice(0, 8)}…\` e \`${a.bases.base_tcc_ufsc.slice(0, 8)}…\`, respostas do índice congeladas em ${a.geradoEm.slice(0, 10)}. **Não edite este arquivo**: ele é regenerado de [\`amostra-cega.json\`](amostra-cega.json).`,
    '',
    `**Responsável:** ${a.responsavel ? `${limpo(a.responsavel)}, em ${limpo(a.assinadoEm) || 'data não informada'}` : '_não assinada_'}`,
    '',
    '**Como triar.** Para cada obra, a pergunta é só uma: ela trata do tema da consulta? A ordem foi sorteada e a aderência está omitida de propósito. Decida em `amostra-cega.json`.',
    '',
    medir(a.temas),
    '',
    ...blocos,
  ].join('\n');
}

const amostra = existsSync(caminhoJson) ? JSON.parse(readFileSync(caminhoJson, 'utf8')) : await sortear();
const problemas = [];
for (const t of amostra.temas) for (const o of t.obras) {
  if (o.decisao !== null && !DECISOES.includes(o.decisao)) problemas.push(`"${t.consulta}" · ${o.titulo}: decisão "${o.decisao}" inválida`);
  if (o.decisao && !String(o.justificativa || '').trim()) problemas.push(`"${t.consulta}" · ${o.titulo}: decisão sem justificativa`);
}
writeFileSync(caminhoJson, JSON.stringify(amostra, null, 2) + '\n', 'utf8');
writeFileSync(caminhoMd, planilha(amostra), 'utf8');
console.log(`\n${medir(amostra.temas)}\n\nGravado em docs/evidencias/afericao/amostra-cega.json e amostra-cega.md`);
if (problemas.length) {
  console.error(`\n${problemas.length} problema(s):\n- ${problemas.join('\n- ')}`);
  process.exitCode = 1;
}
