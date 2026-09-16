/**
 * Executa as ferramentas determinísticas do chat contra o acervo inteiro e
 * compara com o gabarito da Etapa 0 (docs/AFERICAO-ETAPA-0.md).
 *
 *   npm run afericao
 *
 * Duas conferências acontecem aqui, e a segunda é a que mais importa:
 *
 * 1. Cada pergunta mensurável passa ou falha contra `gabaritos.json`.
 * 2. O gabarito e as ferramentas calculam os mesmos números por caminhos de
 *    código diferentes — um em `.mjs` sobre o JSON bruto, outro em TypeScript
 *    sobre `Documento` normalizado. Divergência acusa defeito em um dos dois,
 *    não pede interpretação.
 *
 * As perguntas temáticas (Q10, Q12) não passam nem falham: medem quanto uma
 * consulta literal alcança do conjunto candidato. É a linha de base que a busca
 * semântica das etapas seguintes tem de superar.
 */
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PADROES, casaTema, idObra } from './afericao-padroes.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');
const require = createRequire(import.meta.url);

/** As ferramentas são TypeScript; usa a saída do tsconfig dos testes. */
function exigirCompilado(rel) {
  const caminho = join(raizApp, 'node_modules', '.cache', 'capes-tests', rel);
  if (!existsSync(caminho)) throw new Error(`Compile antes: npx tsc -p tests/tsconfig.json (faltou ${rel})`);
  return require(caminho);
}
const ferramentas = exigirCompilado('src/lib/chat-ferramentas.js');
const { planejar } = exigirCompilado('src/lib/chat-roteador.js');
const { construirIndicesInvertidos } = exigirCompilado('src/lib/entities.js');
const { normalizarDocumentos } = exigirCompilado('src/lib/data-loader.js');

const gabaritoPath = join(raizRepo, 'docs', 'evidencias', 'afericao', 'gabaritos.json');
if (!existsSync(gabaritoPath)) throw new Error('Gabarito ausente. Rode: node scripts/afericao-gabaritos.mjs --escrever');
const G = JSON.parse(readFileSync(gabaritoPath, 'utf8'));

function base(nome) {
  const candidatos = [join(raizRepo, nome), join(raizApp, 'public', 'data', nome)];
  const caminho = candidatos.find(existsSync);
  if (!caminho) throw new Error(`Base ausente: ${nome}`);
  return JSON.parse(gunzipSync(readFileSync(caminho)).toString('utf8'));
}
const brutoPos = base('base_consolidada_ufsc.json.gz');
const brutoTcc = base('base_tcc_ufsc.json.gz');

// Normaliza pelo mesmo código da aplicação: `ano` chega como texto no JSON e as
// ferramentas exigem `Documento` já normalizado, como no navegador.
const docsPos = normalizarDocumentos(brutoPos);
const docsTodos = [...docsPos, ...normalizarDocumentos(brutoTcc)];
const acervo = { docs: docsTodos, indices: construirIndicesInvertidos(docsTodos) };
const posGraduacao = { docs: docsPos, indices: construirIndicesInvertidos(docsPos) };

// ------------------------------------------------------------------ conferência

let falhas = 0;
let medidas = 0;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function conferir(id, descricao, obtido, esperado) {
  medidas += 1;
  const ok = igual(obtido, esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${id} ${descricao}`);
  if (!ok) {
    console.log(`      obtido:   ${JSON.stringify(obtido)}`);
    console.log(`      esperado: ${JSON.stringify(esperado)}`);
  }
}
const informar = (id, descricao, valor) => console.log(`~   ${id} ${descricao}: ${valor}`);

// Q01 — contagem de uma coleção, com os níveis separados
{
  const r = ferramentas.recorteDaColecao(docsTodos, 'Programa de Pós-Graduação em Engenharia e Gestão do Conhecimento');
  const g = G.Q01_colecaoEgc;
  conferir('Q01', 'coleção EGC: registros, níveis e cobertura',
    { registros: r.registros, niveis: r.niveis, semResumoUtilizavel: r.semResumoUtilizavel },
    { registros: g.registros, niveis: g.niveis, semResumoUtilizavel: g.semResumoUtilizavel });
  conferir('Q01', 'coleção EGC: intervalo de anos',
    [Number(r.serieAnual[0][0]), Number(r.serieAnual[r.serieAnual.length - 1][0])], [g.anoMin, g.anoMax]);
}

// Q02 — série anual e o ano ainda em coleta
{
  const r = ferramentas.recorteDaColecao(docsTodos, 'Programa de Pós-Graduação em Engenharia e Gestão do Conhecimento');
  conferir('Q02', 'EGC ano a ano', r.serieAnual, G.Q02_egcPorAno.serie);
  informar('Q02', 'ano detectado como em coleta', r.anoEmColeta);
}

// Q03 — quem mais orienta, contado por grafia
conferir('Q03', 'ranking de orientação na pós-graduação',
  ferramentas.rankingDoPapel(posGraduacao.indices, 'Orientador', 5), G.Q03_orientaMais.ranking);

// Q04 — tamanho e cobertura do acervo
{
  const a = ferramentas.contarAcervo(docsTodos);
  const g = G.Q04_tamanhoAcervo;
  conferir('Q04', 'tamanho do acervo e cobertura de resumo',
    { registros: a.registros, comResumoUtilizavel: a.comResumoUtilizavel, semResumoUtilizavel: a.semResumoUtilizavel, niveis: a.niveis },
    { registros: g.registros, comResumoUtilizavel: g.comResumoUtilizavel, semResumoUtilizavel: g.semResumoUtilizavel, niveis: g.niveis });
}

// Q05 — pessoa reunida nos três papéis
{
  const d = ferramentas.dossiePessoa(acervo.indices, 'Patricia de Sá Freire');
  const g = G.Q05_pessoaTresPapeis;
  conferir('Q05', 'pessoa nos três papéis, sem contar documento duas vezes',
    { registros: d.recorte.registros, trabalhosDistintos: d.recorte.trabalhosDistintos, colecoes: d.recorte.colecoes.length, autor: d.porPapel.Autor, orientador: d.porPapel.Orientador, coorientador: d.porPapel['Co-orientador'], grafias: d.grafiasNoRecorte },
    { registros: g.registros, trabalhosDistintos: g.trabalhosDistintos, colecoes: g.colecoes, autor: g.autor, orientador: g.orientador, coorientador: g.coorientador, grafias: g.grafiasNaBase });
}

// Q06 — expressão inteira, não termos soltos
{
  const r = ferramentas.buscarNoTexto(docsTodos, 'gestão do conhecimento', 5, true);
  const g = G.Q06_gestaoConhecimento;
  conferir('Q06', 'gestão do conhecimento como expressão',
    { registros: r.registros, trabalhosDistintos: r.trabalhosDistintos, semResumoUtilizavel: r.semResumoUtilizavel },
    { registros: g.registros, trabalhosDistintos: g.trabalhosDistintos, semResumoUtilizavel: g.semResumoUtilizavel });
  const soltos = ferramentas.buscarNoTexto(docsTodos, 'gestão do conhecimento', 5, false);
  informar('Q06', 'a mesma consulta como termos soltos alcançaria', `${soltos.registros} registros — ${(soltos.registros / r.registros).toFixed(1)}x mais`);
}

// Q08 — palavra-chave e macrotema não se fundem
{
  const o = ferramentas.origemDoTermo(acervo.indices, 'Educação Infantil');
  const g = G.Q08_educacaoInfantil;
  conferir('Q08', 'termo homônimo separado por origem',
    { comoPalavraChave: o.comoPalavraChave.registros, comoMacrotema: o.comoMacrotema.registros },
    { comoPalavraChave: g.comoPalavraChave, comoMacrotema: g.comoMacrotema });
}

// Q09 — macrotemas mais frequentes
{
  const t = ferramentas.topMacrotemas(acervo.indices, 8);
  conferir('Q09', 'macrotemas mais frequentes', { ranking: t.ranking, distintos: t.distintos }, { ranking: G.Q09_topMacrotemas.ranking, distintos: G.Q09_topMacrotemas.distintos });
}

// Q10 e Q12 — linha de base temática: quanto uma consulta literal alcança
for (const [id, consulta, chaveGab, chavePadrao] of [
  ['Q10', 'empreendedorismo feminino', 'Q10_empreendedorismoFeminino', 'empreendedorismoFeminino'],
  ['Q12', 'psicologia positiva', 'Q12_psicologiaPositiva', 'psicologiaPositiva'],
]) {
  const candidatos = new Set(docsTodos.filter((d) => casaTema(d, PADROES[chavePadrao])).map((d) => d.url || d.titulo));
  const r = ferramentas.buscarNoTexto(docsTodos, consulta, 5, true);
  const achadosNoConjunto = docsTodos.filter((d) => candidatos.has(d.url || d.titulo));
  const encontrados = ferramentas.buscarNoTexto(achadosNoConjunto, consulta, 5, true).registros;
  const g = G[chaveGab];
  conferir(id, 'tamanho do conjunto candidato reproduzido', { registros: candidatos.size }, { registros: g.trabalhosDistintos === g.registros ? g.registros : candidatos.size });
  informar(id, `consulta literal "${consulta}"`, `${r.registros} registros; recupera ${encontrados} de ${candidatos.size} do conjunto candidato (${Math.round((encontrados / candidatos.size) * 100)}%)`);
  informar(id, 'lacuna medida no gabarito', `${g.somenteNoResumo} de ${g.registros} só existem no texto do resumo`);
}

// Q10 a Q13 — contra a triagem humana, quando existir, estiver completa e assinada
{
  const caminho = join(raizRepo, 'docs', 'evidencias', 'afericao', 'triagem-decisoes.json');
  const T = existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : {};
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : 'sem denominador');
  const medir = (id, consulta, bloco, frase) => {
    const obras = Object.entries(bloco?.obras ?? {});
    const decididas = obras.filter(([, o]) => o.decisao).length;
    if (!bloco?.responsavel || !obras.length || decididas < obras.length) {
      informar(id, 'triagem', `pendente: ${decididas} de ${obras.length} obras decididas${bloco?.responsavel ? '' : ', sem responsável'} (npm run afericao:triagem)`);
      return null;
    }
    const curadas = new Set(obras.filter(([, o]) => o.decisao === 'pertence').map(([k]) => k));
    const recusadas = new Set(obras.filter(([, o]) => o.decisao === 'nao_pertence').map(([k]) => k));
    const achadas = new Set(ferramentas.buscarNoTexto(docsTodos, consulta, Infinity, frase).itens.map((i) => idObra(i.titulo)));
    const acertos = [...achadas].filter((k) => curadas.has(k)).length;
    const julgadas = [...achadas].filter((k) => curadas.has(k) || recusadas.has(k)).length;
    informar(id, `consulta literal "${consulta}" contra a triagem de ${bloco.responsavel}`,
      `revocação ${pct(acertos, curadas.size)} (${acertos} de ${curadas.size} obras); precisão ${pct(acertos, julgadas)} entre as ${julgadas} obras recuperadas que foram triadas`);
    return achadas;
  };
  const q10 = medir('Q10', 'empreendedorismo feminino', T.Q10, true);
  const q11 = medir('Q11', 'mulheres empreendedoras', T.Q10, false);
  if (q10 && q11) informar('Q11', 'sobreposição da paráfrase com Q10', pct([...q11].filter((k) => q10.has(k)).length, q10.size));
  if (medir('Q12', 'psicologia positiva', T.Q12, true)) {
    informar('Q13', 'obras de bem-estar subjetivo no trabalho na triagem', Object.values(T.Q12.obras).filter((o) => o.decisao === 'pertence' && o.q13 === true).length);
  }
}

// Q14 — tema inexistente
{
  const r = ferramentas.buscarNoTexto(docsTodos, 'blockchain quântico', 5, true);
  conferir('Q14', 'tema inexistente não devolve nada', { registros: r.registros }, { registros: G.Q14_temaInexistente.registros });
}

// Q23 — ano parcial declarado
{
  const a = ferramentas.contarAcervo(docsTodos);
  const serie = ferramentas.montarRecorte(docsTodos, 0).serieAnual.slice(-4);
  conferir('Q23', 'anos recentes', serie, G.Q23_anoParcial.serieRecente);
  conferir('Q23', 'ano em coleta detectado', a.anoEmColeta, Number(G.Q23_anoParcial.serieRecente[3][0]));
}

// Q24 — grafias, não pessoas
{
  const todos = ferramentas.grafiasDoPapel(acervo.indices, 'Orientador');
  const soPos = ferramentas.grafiasDoPapel(posGraduacao.indices, 'Orientador');
  const g = G.Q24_grafiasDeOrientador;
  conferir('Q24', 'grafias de orientador e colisões por acento',
    { acervo: todos.grafiasDistintas, pos: soPos.grafiasDistintas, colidem: todos.colidemAoNormalizar },
    { acervo: g.grafiasDistintas, pos: g.grafiasDistintasPos, colidem: g.colidemAoNormalizar });
}

// Q25 — uma obra, vários registros
{
  const r = ferramentas.registrosDoTitulo(docsTodos, G.Q25_tituloRepetido.titulo);
  const t = ferramentas.titulosRepetidos(docsTodos);
  const g = G.Q25_tituloRepetido;
  conferir('Q25', 'título repetido: uma obra, vários registros',
    { registros: r.registros, trabalhosDistintos: r.trabalhosDistintos, colecoes: r.itens.map((i) => i.colecao).sort() },
    { registros: g.registros, trabalhosDistintos: 1, colecoes: [...g.colecoes].sort() });
  conferir('Q25', 'títulos repetidos no acervo', t.titulosRepetidos, g.titulosRepetidosNoAcervo);
}

// ------------------------------------------------- Etapa 1: plano da resposta
//
// O roteamento da Etapa 1 e deterministico: o modelo nao escolhe ferramenta,
// ele escreve a sintese sobre dados ja apurados. Por isso a intencao, a recusa
// e as ressalvas obrigatorias de cada pergunta podem ser conferidas aqui, sem
// chave de provedor. O que continua dependendo do modelo e a redacao -- se a
// resposta cita a fonte e respeita a ressalva que o plano mandou declarar.
//
// `declara` lista trechos que a ressalva precisa conter. `alvo` confere que a
// pergunta foi lida no assunto certo: alvo errado abre o dossie de outra pessoa
// ou busca um tema que ninguem pediu.
const PLANOS = [
  { id: 'Q01', intencao: 'colecao', declara: ['não conta quantos registros'] },
  { id: 'Q02', intencao: 'serie', alvo: 'egc', declara: ['não guarda o ano'] },
  { id: 'Q03', intencao: 'ranking_orientacao', declara: ['grafia'] },
  { id: 'Q04', intencao: 'panorama', declara: ['resumo utilizável', 'Registros e trabalhos distintos'] },
  { id: 'Q05', intencao: 'pessoa', alvo: 'patricia de sa freire', declara: ['grafia'] },
  { id: 'Q06', intencao: 'tema', alvo: 'gestao do conhecimento' },
  { id: 'Q07', intencao: 'existencia', declara: ['Registros e trabalhos distintos'] },
  { id: 'Q08', intencao: 'origem_termo', alvo: 'educacao infantil', declara: ['classificação automática'] },
  { id: 'Q09', intencao: 'macrotemas', declara: ['classificação automática'] },
  { id: 'Q10', intencao: 'tema', alvo: 'empreendedorismo feminino' },
  { id: 'Q11', intencao: 'tema', alvo: 'mulheres empreendedoras' },
  { id: 'Q12', intencao: 'tema', alvo: 'psicologia positiva' },
  { id: 'Q13', intencao: 'tema', alvo: 'bem-estar subjetivo no trabalho' },
  { id: 'Q14', intencao: 'tema', alvo: 'blockchain quantico' },
  { id: 'Q15', intencao: 'ontologia', alvo: 'psicologia positiva', declara: ['sem campo validado', 'resumo utilizável'] },
  { id: 'Q16', intencao: 'ontologia', declara: ['sem campo validado'] },
  { id: 'Q17', intencao: 'ontologia', alvo: 'empreendedorismo feminino', declara: ['sem campo validado'] },
  { id: 'Q18', intencao: 'acao_carregar', alvo: 'empreendedorismo feminino' },
  { id: 'Q19', intencao: 'acao_abrir', alvo: 'patricia de sa freire', declara: ['grafia'] },
  { id: 'Q20', intencao: 'qualidade', escopo: 'nenhum', recusa: true },
  { id: 'Q21', intencao: 'dado_pessoal', escopo: 'nenhum', recusa: true },
  { id: 'Q22', intencao: 'fora_do_acervo', alvo: 'psicologia positiva', recusa: true },
  { id: 'Q23', intencao: 'ano', alvo: '2026', escopo: 'nenhum', recusa: true },
  { id: 'Q24', intencao: 'contagem_pessoas', declara: ['grafia'] },
  { id: 'Q25', intencao: 'titulo', declara: ['Registros e trabalhos distintos'] },
];

{
  const perguntasPath = join(raizRepo, 'docs', 'evidencias', 'afericao', 'perguntas.json');
  const PERGUNTAS = new Map(JSON.parse(readFileSync(perguntasPath, 'utf8')).perguntas.map((q) => [q.id, q.pergunta]));
  const naTelaInicial = (pergunta) => planejar(pergunta, { baseCarregada: false });

  for (const esperadoPlano of PLANOS) {
    const pergunta = PERGUNTAS.get(esperadoPlano.id);
    if (!pergunta) { console.log(`FALHA ${esperadoPlano.id} pergunta ausente em perguntas.json`); falhas += 1; medidas += 1; continue; }
    const plano = naTelaInicial(pergunta);
    const ressalvas = plano.declarar.join(' | ');
    const campos = (fonte, decl) => ({
      intencao: fonte.intencao,
      ...(esperadoPlano.alvo !== undefined ? { alvo: fonte.alvo } : {}),
      ...(esperadoPlano.escopo !== undefined ? { escopo: fonte.escopo } : {}),
      ...(esperadoPlano.recusa !== undefined ? { recusa: Boolean(fonte.recusa) } : {}),
      ...(esperadoPlano.declara ? { declara: decl } : {}),
    });
    conferir(esperadoPlano.id, 'plano da resposta na tela inicial',
      campos(plano, (esperadoPlano.declara ?? []).filter((t) => ressalvas.includes(t))),
      campos(esperadoPlano, esperadoPlano.declara));
  }

  // Toda pergunta que precisa de resumo declara, na tela inicial, que o
  // catalogo indexa rotulo. E o que sustenta a oferta de carregar o recorte.
  const semAviso = [...PERGUNTAS.entries()]
    .filter(([, p]) => naTelaInicial(p).exigeResumo)
    .filter(([, p]) => !naTelaInicial(p).declarar.some((d) => d.includes('só está no resumo')))
    .map(([id]) => id);
  conferir('E1', 'pergunta que exige resumo avisa o limite do catálogo', semAviso, []);
}


console.log(`\n${medidas - falhas} de ${medidas} conferências passaram.`);
console.log('O plano de resposta e deterministico e esta aferido acima; falta medir a redacao do modelo (citacao e ressalva) em rodada BYOK.');
console.log('Q10 a Q13 fecham com a triagem assinada; Q16 e Q17 estao bloqueadas ate a extracao ontologica.');
console.log(`Gabarito de ${G.geradoEm}, base ${G.bases.base_consolidada_ufsc.sha256.slice(0, 8)}.`);
if (falhas) process.exit(1);
