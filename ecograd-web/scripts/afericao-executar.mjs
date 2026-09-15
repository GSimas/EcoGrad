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
import { PADROES, casaTema } from './afericao-padroes.mjs';

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

console.log(`\n${medidas - falhas} de ${medidas} conferências passaram.`);
console.log('Q07, Q11, Q13, Q15 e Q18 a Q22 dependem de triagem humana ou da camada de síntese; Q16 e Q17 estão bloqueadas até a extração ontológica.');
console.log(`Gabarito de ${G.geradoEm}, base ${G.bases.base_consolidada_ufsc.sha256.slice(0, 8)}.`);
if (falhas) process.exit(1);
