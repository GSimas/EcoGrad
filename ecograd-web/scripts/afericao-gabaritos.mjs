/**
 * Recalcula os gabaritos mensuráveis do conjunto de aferição do chat
 * (docs/AFERICAO-ETAPA-0.md) a partir das bases canônicas na raiz do repositório.
 *
 * Existe porque o acervo cresce toda semana: gabarito escrito à mão num texto
 * envelhece em dias e passa a reprovar resposta correta. Rode antes de cada
 * rodada de aferição e compare a resposta do agente com a saída daqui, nunca com
 * os números impressos no documento.
 *
 *   node scripts/afericao-gabaritos.mjs            # imprime o resumo
 *   node scripts/afericao-gabaritos.mjs --escrever # grava docs/evidencias/afericao/gabaritos.json
 *
 * Os padrões de busca temática abaixo são varredura léxica sobre título, resumo,
 * palavras-chave e macrotema. Eles definem um CONJUNTO CANDIDATO, não o gabarito
 * final: incluem falso positivo e perdem trabalho escrito com vocabulário
 * totalmente diverso. O gabarito temático só fecha com triagem humana registrada
 * em docs/evidencias/afericao/triagem-*.md.
 */
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PADROES, casaTema, casaTemaPorRotulo, chave as chaveTema, rotulosDoDoc, textoDoDoc } from './afericao-padroes.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');

/** A raiz é canônica; `public/data` é cópia feita pelo sync-data. */
function ler(nome) {
  const candidatos = [join(raizRepo, nome), join(raizApp, 'public', 'data', nome)];
  const caminho = candidatos.find(existsSync);
  if (!caminho) throw new Error(`Base ausente: ${nome}. Rode npm run sync:data ou verifique a raiz do repositório.`);
  const bruto = readFileSync(caminho);
  return { docs: JSON.parse(gunzipSync(bruto).toString('utf8')), sha256: createHash('sha256').update(bruto).digest('hex'), caminho };
}

const posBase = ler('base_consolidada_ufsc.json.gz');
const tccBase = ler('base_tcc_ufsc.json.gz');
const pos = posBase.docs;
const todos = [...pos, ...tccBase.docs];

const chave = chaveTema;
const texto = textoDoDoc;
const rotulos = rotulosDoDoc;
const utilizavel = (d) => String(d.resumo || '').trim().length >= 200;
const ano = (d) => Number(d.ano);
/**
 * Mesma regra de identidade das ferramentas do chat (`normalizar` em
 * src/lib/chat-ferramentas.ts): sem acento, sem caixa e com espaços colapsados.
 * Contar por igualdade exata de texto trataria "MESMA OBRA" e "Mesma obra" como
 * trabalhos diferentes, e os dois lados do projeto passariam a discordar sobre o
 * que e um mesmo trabalho — que e o risco da decisao D3 do ADR.
 */
const identidadeTitulo = (t) => chave(t).replace(/\s+/g, ' ').trim();
const distintos = (arr) => new Set(arr.map((d) => identidadeTitulo(d.titulo))).size;
const contar = (arr, campo) => Object.entries(arr.reduce((a, d) => { const v = campo(d); if (v) a[v] = (a[v] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
const serieAnual = (arr) => contar(arr, (d) => (Number.isFinite(ano(d)) ? String(ano(d)) : null)).sort((a, b) => Number(a[0]) - Number(b[0]));

function tema(padroes) {
  const achados = todos.filter((d) => casaTema(d, padroes));
  const porRotulo = achados.filter((d) => casaTemaPorRotulo(d, padroes));
  return {
    registros: achados.length,
    trabalhosDistintos: distintos(achados),
    semResumoUtilizavel: achados.filter((d) => !utilizavel(d)).length,
    alcancaveisPelaBuscaAtual: porRotulo.length,
    somenteNoResumo: achados.length - porRotulo.length,
    colecoes: contar(achados, (d) => d.programa_origem).slice(0, 10),
    macrotemas: contar(achados, (d) => d.macrotema).slice(0, 8),
    serieAnual: serieAnual(achados),
  };
}

const egc = todos.filter((d) => /engenharia e gest.o do conhecimento/i.test(d.programa_origem || ''));
const gestaoConhecimento = todos.filter((d) => texto(d).includes('gestao do conhecimento'));
const patricia = todos.filter((d) => [...(d.autores || []), d.orientador, ...(d.co_orientadores || [])].some((n) => chave(n).includes('patricia de sa')));
const papel = (arr, extrair) => arr.filter((d) => extrair(d).some((n) => chave(n).includes('patricia de sa'))).length;
const grafiasOrientador = new Set(todos.map((d) => String(d.orientador || '').trim()).filter(Boolean));
const colisoes = new Map();
for (const g of grafiasOrientador) { const n = chave(g).replace(/\s+/g, ' ').trim(); colisoes.set(n, (colisoes.get(n) || 0) + 1); }
const tituloRepetido = 'Doenças: construção e realidade na formção dos médicos. Objeto Fronteira como instrumento de interação entre diferentes estilos de pensamento';

const gabaritos = {
  geradoEm: new Date().toISOString(),
  bases: {
    base_consolidada_ufsc: { sha256: posBase.sha256, registros: pos.length },
    base_tcc_ufsc: { sha256: tccBase.sha256, registros: tccBase.docs.length },
  },
  Q01_colecaoEgc: { registros: egc.length, niveis: contar(egc, (d) => d.nivel_academico), anoMin: Math.min(...egc.map(ano)), anoMax: Math.max(...egc.map(ano)), semResumoUtilizavel: egc.filter((d) => !utilizavel(d)).length },
  Q02_egcPorAno: { serie: serieAnual(egc), pico: serieAnual(egc).reduce((a, b) => (b[1] > a[1] ? b : a)) },
  Q03_orientaMais: { ranking: contar(pos, (d) => String(d.orientador || '').trim()).slice(0, 5), escopo: 'pós-graduação; conta registros por grafia de orientador' },
  Q04_tamanhoAcervo: { registros: todos.length, comResumoUtilizavel: todos.filter(utilizavel).length, semResumoUtilizavel: todos.filter((d) => !utilizavel(d)).length, niveis: contar(todos, (d) => d.nivel_academico) },
  Q05_pessoaTresPapeis: { registros: patricia.length, trabalhosDistintos: distintos(patricia), colecoes: new Set(patricia.map((d) => d.programa_origem)).size, autor: papel(patricia, (d) => d.autores || []), orientador: papel(patricia, (d) => [d.orientador]), coorientador: papel(patricia, (d) => d.co_orientadores || []), grafiasNaBase: [...new Set(patricia.flatMap((d) => [...(d.autores || []), d.orientador, ...(d.co_orientadores || [])]).filter((n) => chave(n).includes('patricia de sa')))] },
  Q06_gestaoConhecimento: { registros: gestaoConhecimento.length, trabalhosDistintos: distintos(gestaoConhecimento), semResumoUtilizavel: gestaoConhecimento.filter((d) => !utilizavel(d)).length },
  Q08_educacaoInfantil: { comoPalavraChave: todos.filter((d) => (d.palavras_chave || []).some((p) => chave(p) === 'educacao infantil')).length, comoMacrotema: todos.filter((d) => chave(d.macrotema) === 'educacao infantil').length },
  Q09_topMacrotemas: { ranking: contar(todos, (d) => d.macrotema).slice(0, 8), distintos: new Set(todos.map((d) => d.macrotema).filter(Boolean)).size },
  Q10_empreendedorismoFeminino: tema(PADROES.empreendedorismoFeminino),
  Q12_psicologiaPositiva: tema(PADROES.psicologiaPositiva),
  Q14_temaInexistente: tema(PADROES.blockchainQuantico),
  Q23_anoParcial: { serieRecente: serieAnual(todos).slice(-4), sustentabilidadeEm2026: todos.filter((d) => ano(d) === 2026 && texto(d).includes('sustentabilidade')).length },
  Q24_grafiasDeOrientador: { grafiasDistintas: grafiasOrientador.size, grafiasDistintasPos: new Set(pos.map((d) => String(d.orientador || '').trim()).filter(Boolean)).size, colidemAoNormalizar: [...colisoes.values()].filter((n) => n > 1).length },
  Q25_tituloRepetido: { titulo: tituloRepetido, registros: todos.filter((d) => d.titulo === tituloRepetido).length, colecoes: todos.filter((d) => d.titulo === tituloRepetido).map((d) => d.programa_origem), titulosRepetidosNoAcervo: [...todos.reduce((a, d) => a.set(identidadeTitulo(d.titulo), (a.get(identidadeTitulo(d.titulo)) || 0) + 1), new Map()).values()].filter((n) => n > 1).length },
};

if (process.argv.includes('--escrever')) {
  const destino = join(raizRepo, 'docs', 'evidencias', 'afericao');
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, 'gabaritos.json'), JSON.stringify(gabaritos, null, 2) + '\n', 'utf8');
  console.log('Gravado em docs/evidencias/afericao/gabaritos.json');
}
console.log(JSON.stringify(gabaritos, null, 1));
