/**
 * Prepara a triagem humana dos conjuntos temáticos da aferição — Q10 a Q13 de
 * docs/AFERICAO-ETAPA-0.md —, que é o que falta para fechar a Etapa 0.
 *
 *   npm run afericao:triagem
 *
 * Recalcula os candidatos com os mesmos `PADROES` do gabarito, agrupa registros
 * da mesma obra e acrescenta candidatos de `EXPANSAO` — vocabulário vizinho que
 * a varredura não alcança e que a busca semântica deveria resgatar. Grava:
 *
 * - `triagem-decisoes.json`: onde a triagem acontece. Para cada obra, `decisao`
 *   ("pertence", "nao_pertence" ou "duvida") e `justificativa`, preenchidas por
 *   uma pessoa, que assina em `responsavel` e `assinadoEm`. `sugestao` vem de
 *   modelo de linguagem e nunca conta como decisão. Rodar de novo não apaga
 *   nada: só acrescenta obras novas e marca as que saíram da varredura.
 * - `triagem-<tema>.md`: a planilha legível, com o resumo completo, gerada do JSON.
 *
 * Q11 usa o conjunto de Q10 (mesma intenção, outro vocabulário). Q13 é um
 * subconjunto de Q12, marcado no campo `q13` de cada obra.
 */
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPANSAO, PADROES, casaTema, casaTemaPorRotulo, idObra, textoDoDoc } from './afericao-padroes.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');
const destino = join(raizRepo, 'docs', 'evidencias', 'afericao');
const caminhoDecisoes = join(destino, 'triagem-decisoes.json');

/** Obras de expansão que entram na planilha; as demais ficam só contadas. */
const MAX_EXPANSAO = 60;
const DECISOES = ['pertence', 'nao_pertence', 'duvida'];
const ROTULO_DECISAO = { pertence: 'pertence', nao_pertence: 'não pertence', duvida: 'dúvida' };

const TEMAS = [
  {
    id: 'Q10', slug: 'empreendedorismo-feminino', titulo: 'Empreendedorismo feminino', perguntas: 'Q10, e Q11 com o mesmo conjunto',
    padroes: PADROES.empreendedorismoFeminino, expansao: EXPANSAO.empreendedorismoFeminino,
  },
  {
    id: 'Q12', slug: 'psicologia-positiva', titulo: 'Psicologia positiva', perguntas: 'Q12, e Q13 como subconjunto',
    padroes: PADROES.psicologiaPositiva, expansao: EXPANSAO.psicologiaPositiva,
    subconjunto: { campo: 'q13', rotulo: 'bem-estar subjetivo no trabalho (Q13)' },
  },
];

function ler(nome) {
  const caminho = [join(raizRepo, nome), join(raizApp, 'public', 'data', nome)].find(existsSync);
  if (!caminho) throw new Error(`Base ausente: ${nome}. Rode npm run sync:data ou verifique a raiz do repositório.`);
  const bruto = readFileSync(caminho);
  return { docs: JSON.parse(gunzipSync(bruto).toString('utf8')), sha256: createHash('sha256').update(bruto).digest('hex') };
}

/** Uma linha por obra: registros da mesma obra (mesma identidade das ferramentas) ficam juntos. */
function agruparObras(docs, { termos = () => [], porRotulo = () => false } = {}) {
  const porId = new Map();
  for (const d of docs) {
    const id = idObra(d.titulo);
    const o = porId.get(id) ?? {
      id, titulo: String(d.titulo ?? '').trim() || 'Trabalho sem título', registros: [], resumo: '',
      palavrasChave: new Set(), macrotemas: new Set(), termos: new Set(), porRotulo: false,
    };
    o.registros.push({ colecao: d.programa_origem || 'Coleção não informada', ano: d.ano ?? null, nivel: d.nivel_academico || 'Não informado', url: d.url || '' });
    const resumo = String(d.resumo ?? '').trim();
    if (resumo.length > o.resumo.length) o.resumo = resumo;
    (d.palavras_chave || []).forEach((p) => p && o.palavrasChave.add(String(p)));
    if (d.macrotema) o.macrotemas.add(d.macrotema);
    termos(d).forEach((t) => o.termos.add(t));
    if (porRotulo(d)) o.porRotulo = true;
    porId.set(id, o);
  }
  const ultimoAno = (o) => Math.max(0, ...o.registros.map((r) => Number(r.ano) || 0));
  return [...porId.values()].sort((a, b) => ultimoAno(b) - ultimoAno(a) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** Uma linha só e sem HTML: o resumo vai dentro de <details>. */
const limpo = (s) => String(s ?? '').replace(/\r?\n+/g, ' ').replace(/</g, '&lt;').trim();

function linhaObra(n, o, e, tema) {
  const registros = o.registros.map((r) => `${r.colecao} (${r.ano ?? 'sem ano'}, ${r.nivel})${r.url ? ` — [fonte](${r.url})` : ''}`);
  const decisao = e.decisao ? `**${ROTULO_DECISAO[e.decisao] ?? limpo(e.decisao)}** — ${limpo(e.justificativa) || '_sem justificativa_'}` : '**pendente**';
  const campo = tema.subconjunto?.campo;
  const marca = (v) => (v === true ? 'sim' : v === false ? 'não' : 'pendente');
  const sugestao = e.sugestao
    ? `\n- Sugestão de ${limpo(e.sugestao.autor || 'modelo de linguagem')} (não é decisão): ${ROTULO_DECISAO[e.sugestao.decisao] ?? limpo(e.sugestao.decisao)} — ${limpo(e.sugestao.justificativa)}${campo && typeof e.sugestao[campo] === 'boolean' ? ` · ${tema.subconjunto.rotulo}: ${marca(e.sugestao[campo])}` : ''}`
    : '';
  const onde = o.termos.size ? `vocabulário vizinho (${[...o.termos].map((t) => `"${t}"`).join(', ')})` : o.porRotulo ? 'rótulo (título, palavra-chave ou macrotema)' : 'só no resumo';
  return [
    `### ${n}. ${limpo(o.titulo)}`,
    '',
    `\`${o.id}\` · ${o.registros.length === 1 ? '1 registro' : `${o.registros.length} registros`} · casou por ${onde}`,
    '',
    `- Decisão: ${decisao}${campo ? `\n- ${tema.subconjunto.rotulo}: ${marca(e[campo])}` : ''}${sugestao}`,
    `- Registros: ${registros.join('; ')}`,
    `- Palavras-chave: ${[...o.palavrasChave].map(limpo).join('; ') || 'não informadas'} · Macrotema (classificação automática da base): ${[...o.macrotemas].map(limpo).join('; ') || 'não informado'}`,
    '',
    '<details><summary>Resumo</summary>',
    '',
    limpo(o.resumo) || '_Sem resumo._',
    '',
    '</details>',
    '',
  ].join('\n');
}

function planilha(tema, bloco, candidatos, registrosCandidatos, expansao, totalExpansao, bases) {
  const listadas = [...candidatos, ...expansao].map((o) => bloco.obras[o.id]);
  const conta = (d) => listadas.filter((e) => e.decisao === d).length;
  const decididas = listadas.filter((e) => e.decisao).length;
  const fora = Object.values(bloco.obras).filter((e) => e.foraDaVarreduraAtual);
  const parcialExpansao = totalExpansao > expansao.length ? ` de ${totalExpansao}` : '';
  return [
    `# Triagem — ${tema.titulo}`,
    '',
    `Perguntas: ${tema.perguntas}. Gerado por \`npm run afericao:triagem\` em ${new Date().toISOString().slice(0, 10)}, bases \`${bases.pos.slice(0, 8)}…\` e \`${bases.tcc.slice(0, 8)}…\`. **Não edite este arquivo**: ele é regenerado a partir de [\`triagem-decisoes.json\`](triagem-decisoes.json).`,
    '',
    `**Responsável:** ${bloco.responsavel ? `${limpo(bloco.responsavel)}, em ${limpo(bloco.assinadoEm) || 'data não informada'}` : '_triagem não assinada_'} · **Situação:** ${decididas} de ${listadas.length} obras decididas — ${conta('pertence')} pertencem, ${conta('nao_pertence')} não pertencem, ${conta('duvida')} em dúvida.`,
    '',
    `**Como triar.** Em \`triagem-decisoes.json\`, preencha para cada obra a \`decisao\` ("pertence", "nao_pertence" ou "duvida") e a \`justificativa\`${tema.subconjunto ? `, e \`${tema.subconjunto.campo}\` (true ou false) para ${tema.subconjunto.rotulo}` : ''}. Obra que falte nas listas pode entrar em \`obras\` com o id de \`idObra(titulo)\`, de \`scripts/afericao-padroes.mjs\`. Ao terminar, assine em \`responsavel\` e \`assinadoEm\` e rode \`npm run afericao\`. A **sugestão** vem de um modelo de linguagem que leu os resumos: ajuda a começar, mas não conta como decisão.`,
    '',
    '| Lista | Obras | Registros |',
    '| --- | --- | --- |',
    `| Candidatos da varredura (\`PADROES\`) | ${candidatos.length} | ${registrosCandidatos} |`,
    `| Expansão por vocabulário vizinho (\`EXPANSAO\`) | ${expansao.length}${parcialExpansao} | ${expansao.reduce((t, o) => t + o.registros.length, 0)} listados |`,
    '',
    `## Candidatos da varredura (${candidatos.length})`,
    '',
    ...candidatos.map((o, i) => linhaObra(i + 1, o, bloco.obras[o.id], tema)),
    `## Expansão por vocabulário vizinho (${expansao.length}${parcialExpansao ? `${parcialExpansao}, as com mais termos distintos` : ''})`,
    '',
    'Obras fora da varredura principal que usam vocabulário próximo. A maioria não deve pertencer; as que pertencerem são exatamente o que a busca literal perde.',
    '',
    ...expansao.map((o, i) => linhaObra(i + 1, o, bloco.obras[o.id], tema)),
    ...(fora.length
      ? [`## Fora da varredura atual (${fora.length})`, '', 'Obras com entrada registrada que não aparecem mais nas listas acima; a decisão continua valendo.', '',
        ...fora.map((e) => `- ${limpo(e.titulo)}: ${e.decisao ? ROTULO_DECISAO[e.decisao] ?? limpo(e.decisao) : 'pendente'}`), '']
      : []),
  ].join('\n');
}

const pos = ler('base_consolidada_ufsc.json.gz');
const tcc = ler('base_tcc_ufsc.json.gz');
const todos = [...pos.docs, ...tcc.docs];

const decisoes = existsSync(caminhoDecisoes) ? JSON.parse(readFileSync(caminhoDecisoes, 'utf8')) : {};
decisoes.instrucoes = 'Preencha decisao ("pertence", "nao_pertence" ou "duvida") e justificativa de cada obra; ao terminar, assine em responsavel e assinadoEm. "sugestao" vem de modelo de linguagem e não conta como decisão. Depois rode npm run afericao:triagem e npm run afericao.';
decisoes.bases = { base_consolidada_ufsc: pos.sha256, base_tcc_ufsc: tcc.sha256 };

const problemas = [];
const resumo = [];
mkdirSync(destino, { recursive: true });

for (const tema of TEMAS) {
  const candidatosDocs = todos.filter((d) => casaTema(d, tema.padroes));
  const candidatos = agruparObras(candidatosDocs, { porRotulo: (d) => casaTemaPorRotulo(d, tema.padroes) });
  const idsCandidatos = new Set(candidatos.map((o) => o.id));

  const termosDe = (d) => { const t = textoDoDoc(d); return tema.expansao.map((p) => t.match(p)?.[0]).filter(Boolean); };
  const expansaoTodas = agruparObras(todos.filter((d) => !idsCandidatos.has(idObra(d.titulo)) && termosDe(d).length > 0), { termos: termosDe })
    .sort((a, b) => b.termos.size - a.termos.size || b.registros.length - a.registros.length);
  const expansao = expansaoTodas.slice(0, MAX_EXPANSAO);

  const bloco = decisoes[tema.id] ??= { responsavel: null, assinadoEm: null, obras: {} };
  const listadas = new Set();
  for (const [origem, lista] of [['candidato', candidatos], ['expansao', expansao]]) {
    for (const o of lista) {
      listadas.add(o.id);
      const e = bloco.obras[o.id] ??= {
        titulo: o.titulo, origem, decisao: null, justificativa: '',
        ...(tema.subconjunto ? { [tema.subconjunto.campo]: null } : {}),
        sugestao: null,
      };
      Object.assign(e, { titulo: o.titulo, origem });
      delete e.foraDaVarreduraAtual;
    }
  }
  for (const [id, e] of Object.entries(bloco.obras)) {
    if (!listadas.has(id)) e.foraDaVarreduraAtual = true;
    if (e.decisao !== null && !DECISOES.includes(e.decisao)) problemas.push(`${tema.id} ${id}: decisão "${e.decisao}" inválida`);
    if (e.decisao && !String(e.justificativa || '').trim()) problemas.push(`${tema.id} ${id}: decisão sem justificativa`);
  }

  writeFileSync(join(destino, `triagem-${tema.slug}.md`), planilha(tema, bloco, candidatos, candidatosDocs.length, expansao, expansaoTodas.length, { pos: pos.sha256, tcc: tcc.sha256 }), 'utf8');
  const decididas = [...listadas].filter((id) => bloco.obras[id].decisao).length;
  resumo.push(`${tema.id}: ${candidatos.length} obras candidatas (${candidatosDocs.length} registros) + ${expansao.length}${expansaoTodas.length > expansao.length ? ` de ${expansaoTodas.length}` : ''} de expansão · ${decididas} de ${listadas.size} decididas · ${bloco.responsavel ? `assinada por ${bloco.responsavel}` : 'sem responsável'}`);
}

writeFileSync(caminhoDecisoes, JSON.stringify(decisoes, null, 2) + '\n', 'utf8');
console.log(resumo.join('\n'));
console.log('Gravado em docs/evidencias/afericao/triagem-decisoes.json e triagem-*.md');
if (problemas.length) {
  console.error(`\n${problemas.length} problema(s) nas decisões:\n- ${problemas.join('\n- ')}`);
  process.exitCode = 1;
}
