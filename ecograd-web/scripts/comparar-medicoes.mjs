// Consolida execuções do `medir-desempenho` (e do `medir-bundle`) numa tabela
// antes × depois. Cada métrica é a mediana entre as execuções de cada lado, para
// que uma rodada ruidosa não decida o resultado.
//
// Uso: node scripts/comparar-medicoes.mjs --antes a1.json,a2.json --depois d1.json,d2.json
//        [--bundle-antes b.json --bundle-depois b.json] [--eslint-antes e.json --eslint-depois e.json]
//        [--memoria-antes m1.json --memoria-depois m2.json] [--cpu1-antes c1.json --cpu1-depois c2.json]
//        [--saida perf-report/comparativo.md]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opcao = (nome) => { const i = argv.indexOf(`--${nome}`); return i >= 0 ? argv[i + 1] : null; };
const lerLista = (nome) => (opcao(nome) ?? '').split(',').filter(Boolean).map((f) => JSON.parse(readFileSync(resolve(raiz, f), 'utf8')));
const lerUm = (nome) => { const f = opcao(nome); return f && existsSync(resolve(raiz, f)) ? JSON.parse(readFileSync(resolve(raiz, f), 'utf8')) : null; };

const antes = lerLista('antes');
const depois = lerLista('depois');
const mediana = (xs) => { const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); if (!v.length) return NaN; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
/** Todas as amostras de uma métrica, de todas as execuções de um lado. */
const de = (lista, f) => lista.flatMap((r) => { try { const x = f(r); return (Array.isArray(x) ? x : [x]).filter(Number.isFinite); } catch { return []; } });

// Φ pela aproximação de Abramowitz e Stegun (7.1.26) para a erf.
const normal = (z) => {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
};
/** Mann-Whitney bicaudal, aproximação normal, postos médios nos empates. */
function mannWhitney(as, ds) {
  const todos = [...as.map((v) => [v, 0]), ...ds.map((v) => [v, 1])].sort((x, y) => x[0] - y[0]);
  let r1 = 0;
  for (let i = 0; i < todos.length;) {
    let j = i;
    while (j + 1 < todos.length && todos[j + 1][0] === todos[i][0]) j++;
    for (let k = i; k <= j; k++) if (todos[k][1] === 0) r1 += (i + j) / 2 + 1;
    i = j + 1;
  }
  const [n1, n2] = [as.length, ds.length];
  const z = (r1 - (n1 * (n1 + 1)) / 2 - (n1 * n2) / 2) / Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  return 2 * (1 - normal(Math.abs(z)));
}
/**
 * A diferença cabe na variação entre execuções do mesmo build? Com 5 ou mais
 * amostras de cada lado, Mann-Whitney com p > 0,05; com menos, a distância entre
 * as medianas não passa da amplitude de um dos lados.
 */
function naVariacao(as, ds) {
  if (as.length < 2 || ds.length < 2) return false;
  if (as.length >= 5 && ds.length >= 5) return mannWhitney(as, ds) > 0.05;
  const amplitude = Math.max(Math.max(...as) - Math.min(...as), Math.max(...ds) - Math.min(...ds));
  return Math.abs(mediana(ds) - mediana(as)) <= amplitude;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const ms = (n) => `${Math.round(n).toLocaleString('pt-BR')} ms`;
const num = (n, casas = 0) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });
const delta = (a, d, menorMelhor = true, absoluto = null, ruido = false) => {
  if (!Number.isFinite(a) || !Number.isFinite(d)) return '—';
  const marca = ruido ? ' ≈' : '';
  // Onde o percentual engana (base perto de zero ou negativa), a diferença absoluta.
  if (absoluto) return absoluto(d - a) + marca;
  if (a === 0 && d === 0) return '=';
  if (a === 0) return (d > 0 ? `+${num(d, 1)}` : num(d, 1)) + marca;
  const pct = ((d - a) / a) * 100;
  const sinal = pct > 0 ? '+' : '';
  const ok = menorMelhor ? pct < 0 : pct > 0;
  return `${sinal}${num(pct, 1)}%${ruido ? marca : Math.abs(pct) >= 5 ? (ok ? ' ✅' : ' ⚠️') : ''}`;
};

const linhas = [];
/** `as` e `ds` são as amostras de cada lado (ou um número só); a tabela mostra as medianas. */
const linha = (metrica, as, ds, fmt, menorMelhor = true, absoluto = null) => {
  const [va, vd] = [[as].flat().filter(Number.isFinite), [ds].flat().filter(Number.isFinite)];
  const [a, d] = [mediana(va), mediana(vd)];
  linhas.push(`| ${metrica} | ${fmt(a)} | ${fmt(d)} | ${delta(a, d, menorMelhor, absoluto, naVariacao(va, vd))} |`);
};
const secao = (titulo) => linhas.push(`| **${titulo}** | | | |`);

const ba = lerUm('bundle-antes');
const bd = lerUm('bundle-depois');
if (ba && bd) {
  secao('Bundle de produção');
  linha('JS inicial (bruto)', ba.jsInicial.bytes, bd.jsInicial.bytes, kb);
  linha('JS inicial (gzip)', ba.jsInicial.gzip, bd.jsInicial.gzip, kb);
  linha('JS inicial (brotli)', ba.jsInicial.brotli, bd.jsInicial.brotli, kb);
  linha('Chunks sob demanda (lazy)', ba.jsAdiado.arquivos, bd.jsAdiado.arquivos, (n) => `${n}`, false);
  linha('Workers', ba.workers.arquivos, bd.workers.arquivos, (n) => `${n}`, false);
}

secao('Carga fria (4G lento + CPU 4×, mediana de todas as rodadas)');
linha('JS transferido na carga', de(antes, (r) => r.carga.rodadas.map((x) => x.jsTransferido)), de(depois, (r) => r.carga.rodadas.map((x) => x.jsTransferido)), kb);
linha('FCP', de(antes, (r) => r.carga.rodadas.map((x) => x.fcp)), de(depois, (r) => r.carga.rodadas.map((x) => x.fcp)), ms);
linha('LCP', de(antes, (r) => r.carga.rodadas.map((x) => x.lcp)), de(depois, (r) => r.carga.rodadas.map((x) => x.lcp)), ms);
linha('TBT (desde a navegação)', de(antes, (r) => r.carga.rodadas.map((x) => x.tbtDesdeInicio)), de(depois, (r) => r.carga.rodadas.map((x) => x.tbtDesdeInicio)), ms);
linha('CLS', de(antes, (r) => r.carga.rodadas.map((x) => x.cls)), de(depois, (r) => r.carga.rodadas.map((x) => x.cls)), (n) => num(n, 4), true,
  (dif) => `${dif > 0 ? '+' : ''}${num(dif, 4)} (limite "bom": 0,1)`);
linha('Main thread ocupada com a tela parada', de(antes, (r) => r.carga.rodadas.map((x) => x.cpuOciosoPct)), de(depois, (r) => r.carga.rodadas.map((x) => x.cpuOciosoPct)), (n) => `${num(n, 1)}%`);

const f = (r) => r.fluxo;
secao('Busca na apresentação (CPU 4×)');
linha('Preparo do índice: até a busca responder', de(antes, (r) => f(r).preparoBusca.duracao), de(depois, (r) => f(r).preparoBusca.duracao), ms);
linha('Preparo do índice: TBT', de(antes, (r) => f(r).preparoBusca.tbt), de(depois, (r) => f(r).preparoBusca.tbt), ms);
linha('Preparo do índice: maior tarefa', de(antes, (r) => f(r).preparoBusca.maiorTarefa), de(depois, (r) => f(r).preparoBusca.maiorTarefa), ms);
linha('Digitação: INP', de(antes, (r) => f(r).digitacaoBusca.inp), de(depois, (r) => f(r).digitacaoBusca.inp), ms);
linha('Digitação: TBT', de(antes, (r) => f(r).digitacaoBusca.tbt), de(depois, (r) => f(r).digitacaoBusca.tbt), ms);

// O fim do SNA cai numa janela ou na outra conforme a main thread o deixa
// terminar — no build novo, antes de o Dashboard ficar ocioso. Só a união das
// duas, do clique até a rede calculada, é comparável entre builds.
const uniao = (r) => {
  const c = f(r).carregamento;
  const s = f(r).sna;
  return { ate: s.ateConcluir, tbt: c.tbt + s.tbt, maiorTarefa: Math.max(c.maiorTarefa, s.maiorTarefa),
    fps: (c.fps * c.duracao + s.fps * s.duracao) / (c.duracao + s.duracao), quadrosLentos: c.quadrosLentos + s.quadrosLentos,
    maiorIntervaloQuadros: Math.max(c.maiorIntervaloQuadros, s.maiorIntervaloQuadros) };
};
const linhasDaColecao = (la, ld) => {
  linha('Clique em Carregar → Dashboard', de(la, (r) => f(r).carregamento.ateDashboard), de(ld, (r) => f(r).carregamento.ateDashboard), ms);
  linha('Clique em Carregar → rede calculada e página ociosa', de(la, (r) => uniao(r).ate), de(ld, (r) => uniao(r).ate), ms);
  linha('Nesse intervalo: TBT', de(la, (r) => uniao(r).tbt), de(ld, (r) => uniao(r).tbt), ms);
  linha('Nesse intervalo: maior tarefa', de(la, (r) => uniao(r).maiorTarefa), de(ld, (r) => uniao(r).maiorTarefa), ms);
  linha('Nesse intervalo: FPS', de(la, (r) => uniao(r).fps), de(ld, (r) => uniao(r).fps), (n) => num(n, 1), false);
  linha('Nesse intervalo: quadros > 50 ms', de(la, (r) => uniao(r).quadrosLentos), de(ld, (r) => uniao(r).quadrosLentos), (n) => num(n));
  linha('Nesse intervalo: maior intervalo entre quadros', de(la, (r) => uniao(r).maiorIntervaloQuadros), de(ld, (r) => uniao(r).maiorIntervaloQuadros), ms);
};
secao('Coleção grande (4.384 documentos, CPU 4×)');
linhasDaColecao(antes, depois);

// Execuções sem desaceleração (`--cpu 1 --cenarios colecao`): o mesmo trecho num desktop.
const cpu1Antes = lerLista('cpu1-antes');
const cpu1Depois = lerLista('cpu1-depois');
if (cpu1Antes.length && cpu1Depois.length) {
  secao('Coleção grande sem desaceleração (CPU 1×)');
  linhasDaColecao(cpu1Antes, cpu1Depois);
}

secao('Interações (INP, CPU 4×)');
const inpDe = (r, rotulo) => f(r).abas.find((a) => a.rotulo === rotulo).inp;
for (const rotulo of ['Sidebar → Motor de Busca', 'Sidebar → Análise Avançada', 'Aba → Tempo e tendências', 'Aba → Estrutura da rede', 'Aba → Especialização e dados', 'Aba → Temas e conceitos', 'Sidebar → Dashboard']) {
  linha(rotulo, de(antes, (r) => inpDe(r, rotulo)), de(depois, (r) => inpDe(r, rotulo)), ms);
}
linha('Pior INP da navegação', de(antes, (r) => Math.max(...f(r).abas.map((a) => a.inp))), de(depois, (r) => Math.max(...f(r).abas.map((a) => a.inp))), ms);
linha('Digitação no Motor de Busca: INP', de(antes, (r) => f(r).digitacaoMotor.inp), de(depois, (r) => f(r).digitacaoMotor.inp), ms);
linha('Digitação no Motor de Busca: TBT', de(antes, (r) => f(r).digitacaoMotor.tbt), de(depois, (r) => f(r).digitacaoMotor.tbt), ms);
linha('Abrir dossiê de pessoa: INP', de(antes, (r) => f(r).abrirDossie.inp), de(depois, (r) => f(r).abrirDossie.inp), ms);

// Execuções só de memória (`--cenarios colecao,memoria --ciclos N`) têm precedência:
// medem o heap dos workers depois de uma coleta de lixo em cada um.
const memAntes = lerLista('memoria-antes');
const memDepois = lerLista('memoria-depois');
const [ma, md] = memAntes.length && memDepois.length ? [memAntes, memDepois] : [antes, depois];
const ciclos = ma[0]?.fluxo?.memoria?.destaques?.heapPorCiclo?.length || 5;
secao(`Memória (${ciclos} ciclos abrir/fechar janela com gráficos, heap pós-coleta)`);
const mb = (dif) => `${dif > 0 ? '+' : ''}${num(dif, 1)} MB`;
linha('Heap da página após a jornada', de(ma, (r) => f(r).memoria.destaques.heapAntesMB), de(md, (r) => f(r).memoria.destaques.heapAntesMB), (n) => `${num(n, 1)} MB`, true, mb);
linha('Heap dos workers no mesmo ponto', de(ma, (r) => f(r).memoria.destaques.heapWorkersMB), de(md, (r) => f(r).memoria.destaques.heapWorkersMB), (n) => `${num(n, 1)} MB`, true, mb);
linha('Heap total (página + workers)', de(ma, (r) => f(r).memoria.destaques.totalAntesMB), de(md, (r) => f(r).memoria.destaques.totalAntesMB), (n) => `${num(n, 1)} MB`, true, mb);
linha('Destaques: crescimento do heap da página', de(ma, (r) => f(r).memoria.destaques.crescimentoMB), de(md, (r) => f(r).memoria.destaques.crescimentoMB), (n) => `${num(n, 2)} MB`, true, mb);
linha('Espaço 3D (WebGL): crescimento do heap da página', de(ma, (r) => f(r).memoria.espaco3d.crescimentoMB), de(md, (r) => f(r).memoria.espaco3d.crescimentoMB), (n) => `${num(n, 2)} MB`, true, mb);
linha('Canvases órfãos após fechar', de(ma, (r) => f(r).memoria.destaques.canvasesOrfaos + f(r).memoria.espaco3d.canvasesOrfaos), de(md, (r) => f(r).memoria.destaques.canvasesOrfaos + f(r).memoria.espaco3d.canvasesOrfaos), (n) => num(n));

secao('Acessibilidade');
const axeNos = (r) => r.a11y.reduce((s, a) => s + a.wcag.reduce((t, v) => t + v.nos, 0), 0);
const axeRegras = (r) => new Set(r.a11y.flatMap((a) => a.wcag.map((v) => v.id))).size;
const axeBp = (r) => r.a11y.reduce((s, a) => s + a.boasPraticas.reduce((t, v) => t + v.nos, 0), 0);
linha('axe WCAG 2.1 A/AA: regras violadas', de(antes, axeRegras), de(depois, axeRegras), (n) => num(n));
linha('axe WCAG 2.1 A/AA: nós afetados (7 estados)', de(antes, axeNos), de(depois, axeNos), (n) => num(n));
linha('axe boas práticas: nós afetados', de(antes, axeBp), de(depois, axeBp), (n) => num(n));
const contarEslint = (nome) => { const r = lerUm(nome); return r ? r.reduce((s, x) => s + x.messages.length, 0) : NaN; };
linha('ESLint jsx-a11y (strict)', contarEslint('eslint-antes'), contarEslint('eslint-depois'), (n) => num(n));

const cabecalho = ['| Métrica | Antes | Depois | Ganho / Delta |', '| :--- | ---: | ---: | :--- |'];
const legenda = '\n≈ diferença dentro da variação entre execuções do mesmo build (Mann-Whitney, p > 0,05, com 5 ou mais amostras de cada lado; com menos, distância entre medianas menor que a amplitude de um dos lados).';
const texto = [...cabecalho, ...linhas].join('\n') + '\n' + legenda;
console.log(`Execuções: ${antes.length} antes × ${depois.length} depois${memAntes.length ? `; só de memória: ${memAntes.length} × ${memDepois.length}` : ''} (medianas).\n`);
console.log(texto);
const saida = opcao('saida');
if (saida) writeFileSync(resolve(raiz, saida), texto + '\n');
