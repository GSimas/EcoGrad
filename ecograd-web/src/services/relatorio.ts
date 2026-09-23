/**
 * Montagem do relatório: lê a análise carregada e devolve blocos.
 *
 * Nada aqui desenha PDF e nada aqui calcula de novo — cada seção chama a mesma
 * função pura que a tela usa, para o papel não divergir do que o usuário viu.
 *
 * Gráfico de aba fechada não existe no DOM (as abas montam sob demanda), então
 * o que é ECharts é redesenhado fora da tela só para virar imagem. A Órbita é
 * exceção declarada: é simulação de forças, e uma captura antes do layout
 * assentar sairia um emaranhado — dela vai a tabela, e a imagem só quando já
 * está na tela.
 */
import type { EChartsOption } from 'echarts';
import {
  blocosDaCapa, carimboDeData, FUNDO_DO_RELATORIO, lerChaveDossie, nomeDoArquivo,
  type Bloco, type ContextoCapa, type LinksDaTabela, type Relatorio, type SelecaoRelatorio,
} from '@/lib/relatorio';
import { relevanciaDossie } from '@/lib/relevancia';
import { canvasParaDataUrl } from '@/lib/exportar-imagem';
import { adaptarGrafico } from '@/lib/aparencia-graficos';
import { barrasHorizontais, TEMA_GRAFICO } from '@/components/ui/Chart';
import { conjuntosGlobais, construirIndicesInvertidos, docsDoTermo, normalizarNivel } from '@/lib/entities';
import { calcularGenealogia, calcularTopologia, topologiaSemSinal } from '@/lib/destaques';
import { contar } from '@/lib/foresight-math';
import { evolucaoAnual, obterFrequenciasTexto, topN, FONTES_NUVEM } from '@/lib/lexicon';
import { gerarTabelaQLCruzado } from '@/lib/ql';
import { calcularSimilaresRede, construirPerfisSimilaridade } from '@/lib/similarity';
import { calcularCoberturaTemporal, opcaoCoberturaTemporal } from '@/lib/cobertura-temporal';
import { construirRedeRadial, opcaoRedeRadial } from '@/lib/rede-radial';
import { compararColecoes, filtrarTrabalhos, fonteSegura, periodoTexto, relacionados, resolverDocumento, resumoRegistros, type FiltroTrabalhos } from '@/lib/resultados';
import { formatarDecimal } from '@/lib/utils';
import { valorExibido } from '@/lib/visualizacao';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { Documento, TipoBusca } from '@/types';

export interface ProgressoRelatorio { feitos: number; total: number; etapa: string }

/**
 * O relatório montado, com o contexto que a capa consumiu.
 *
 * O PDF só precisa dos blocos — a capa já está pronta neles. O JSON precisa dos
 * valores por trás, para publicá-los como campos em vez de frases.
 */
export interface RelatorioMontado { relatorio: Relatorio; contexto: ContextoCapa }

/** Cancelamento cooperativo: cada passo confere antes de gastar tempo. */
function conferirCancelamento(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Geração interrompida.', 'AbortError');
}

/**
 * Devolve o quadro ao navegador.
 *
 * O grosso da montagem é síncrono — varrer documentos, contar, montar tabelas —
 * e uma função `async` só cede o controle no primeiro `await`. Sem estas
 * pausas a barra de progresso nunca chega a ser pintada e o botão de
 * interromper não recebe clique: a promessa de acompanhar e cancelar seria
 * falsa justamente enquanto há o que acompanhar.
 */
const respirar = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

/**
 * Desenha um gráfico ECharts fora da tela e devolve o PNG.
 *
 * A instância vive num nó destacado, com animação desligada para que o
 * primeiro quadro já seja o final, e é destruída em seguida. Devolve `null`
 * quando o desenho falha: um gráfico ausente não pode derrubar o relatório.
 */
async function imagemDoGrafico(
  option: EChartsOption,
  { altura = 420, largura = 960, claro, recortar = false }: { altura?: number; largura?: number; claro: boolean; recortar?: boolean },
): Promise<{ dataUrl: string; proporcao: number } | null> {
  const no = document.createElement('div');
  no.style.cssText = `position:fixed;left:-20000px;top:0;width:${largura}px;height:${altura}px;pointer-events:none`;
  document.body.appendChild(no);
  try {
    const echarts = await import('echarts');
    // A nuvem de palavras é extensão: sem registrar, a série sai vazia.
    await import('echarts-wordcloud');
    const inst = echarts.init(no, undefined, { renderer: 'canvas', width: largura, height: altura });
    try {
      inst.setOption(adaptarGrafico({
        ...option,
        backgroundColor: claro ? FUNDO_DO_RELATORIO.claro : FUNDO_DO_RELATORIO.escuro,
        animation: false,
        textStyle: { fontFamily: '"Manrope Variable", Manrope, system-ui, sans-serif' },
      }, claro, true) as EChartsOption);
      // JPEG, e não PNG: o PNG de um gráfico de 1920 px entra no PDF sem
      // compressão e um relatório de quatro gráficos passava de 16 MB. É o
      // mesmo motivo pelo qual a exportação de imagem do app oferece "JPG com
      // fundo" para colar em documento.
      // O fundo do gráfico é o da página do PDF: papel no claro, tinta no escuro.
      const fundo = claro ? FUNDO_DO_RELATORIO.claro : FUNDO_DO_RELATORIO.escuro;
      const dataUrl = inst.getDataURL({ type: 'jpeg', pixelRatio: 2, backgroundColor: fundo });
      return recortar ? await recortarMargens(dataUrl, fundo) : { dataUrl, proporcao: altura / largura };
    } finally {
      inst.dispose();
    }
  } catch {
    return null;
  } finally {
    no.remove();
  }
}

/**
 * Recorta a moldura vazia em volta do desenho.
 *
 * O diagrama radial precisa de margem larga para os nomes inteiros caberem —
 * e quanto mais longo o nome, mais margem. Apertar a margem até o desenho
 * encostar nas bordas voltaria a cortar assim que aparecesse um nome maior.
 * A saída é o contrário: desenhar com folga de sobra e tirar a sobra depois,
 * medindo onde a tinta realmente começa. Assim nada é cortado em recorte
 * nenhum, e o PDF não gasta meia página com branco.
 */
function recortarMargens(dataUrl: string, fundo: string): Promise<{ dataUrl: string; proporcao: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tela = document.createElement('canvas');
      tela.width = img.width;
      tela.height = img.height;
      const ctx = tela.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve({ dataUrl, proporcao: img.height / img.width }); return; }
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, img.width, img.height);
      // Vazio é o que está perto da cor do fundo. Tolerância: o JPEG suaviza a
      // cor lisa nas bordas do traço.
      const [fr, fg, fb] = [1, 3, 5].map((i) => parseInt(fundo.slice(i, i + 2), 16));
      const vazio = (i: number) => Math.abs(data[i] - fr) + Math.abs(data[i + 1] - fg) + Math.abs(data[i + 2] - fb) < 36;
      let minX = img.width, maxX = -1, minY = img.height, maxY = -1;
      for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
          if (vazio((y * img.width + x) * 4)) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) { resolve({ dataUrl, proporcao: img.height / img.width }); return; }
      const respiro = 12;
      const x0 = Math.max(0, minX - respiro);
      const y0 = Math.max(0, minY - respiro);
      const largura = Math.min(img.width, maxX + respiro) - x0;
      const altura = Math.min(img.height, maxY + respiro) - y0;
      const corte = document.createElement('canvas');
      corte.width = largura;
      corte.height = altura;
      const ctx2 = corte.getContext('2d');
      if (!ctx2) { resolve({ dataUrl, proporcao: img.height / img.width }); return; }
      ctx2.fillStyle = fundo;
      ctx2.fillRect(0, 0, largura, altura);
      ctx2.drawImage(tela, x0, y0, largura, altura, 0, 0, largura, altura);
      resolve({ dataUrl: corte.toDataURL('image/jpeg', 0.92), proporcao: altura / largura });
    };
    img.onerror = () => resolve({ dataUrl, proporcao: 1 });
    img.src = dataUrl;
  });
}

/** Imagem da Órbita só quando ela já está desenhada na tela (decisão declarada). */
function imagemDaOrbitaNaTela(): string | null {
  const canvas = document.querySelector<HTMLCanvasElement>('section[aria-label="Órbita de relacionamentos"] canvas');
  if (!canvas || canvas.width === 0) return null;
  try {
    // Sempre JPG: o `canvasParaDataUrl` pinta atrás dele o fundo do tema vivo,
    // que é o mesmo sob o qual os nós foram desenhados na tela.
    return canvasParaDataUrl(canvas, 'jpg');
  } catch {
    return null;
  }
}

const tabela = (titulo: string, colunas: readonly string[], linhas: ReadonlyArray<readonly string[]>, nota?: string, links?: LinksDaTabela): Bloco =>
  ({ tipo: 'tabela', titulo, colunas, linhas, nota, ...(links ? { links } : {}) });

/** Links da coluna de títulos: cada trabalho aponta para a própria fonte, quando ela é segura. */
const linksDosTitulos = (coluna: number, docs: readonly Documento[]): LinksDaTabela =>
  ({ coluna, urls: docs.map((d) => fonteSegura(d.url)) });

const texto = (v: unknown) => valorExibido(v);

/** Quantos passos a barra de progresso vai percorrer, contados antes de começar. */
export function passosDoRelatorio(selecao: SelecaoRelatorio): number {
  return selecao.dashboard.length + selecao.dossies.length;
}

export async function montarRelatorio(
  selecao: SelecaoRelatorio,
  onProgresso: (p: ProgressoRelatorio) => void,
  signal: AbortSignal,
): Promise<RelatorioMontado> {
  const s = useEcoGradStore.getState();
  const docs = s.docs;
  const claro = selecao.tema === 'claro';
  /**
   * No JSON não há gráfico a desenhar: só as tabelas que o sustentam viajam.
   * Pular o redesenho fora da tela é o que faz a exportação em JSON sair em um
   * instante, enquanto a do PDF leva segundos.
   */
  const desenhar: typeof imagemDoGrafico = selecao.formato === 'json'
    ? async () => null
    : imagemDoGrafico;
  const total = passosDoRelatorio(selecao);
  let feitos = 0;
  const avancar = async (etapa: string) => { feitos += 1; onProgresso({ feitos, total, etapa }); await respirar(); };

  // Antes de qualquer varredura: o estado "Reunindo a análise" precisa aparecer.
  await respirar();
  const cobertura = resumoRegistros(docs);
  const indices = construirIndicesInvertidos(docs);
  const conjuntos = conjuntosGlobais(docs);
  const contagens = {
    orientadores: contar(docs.map((d) => d.orientador).filter(Boolean)),
    coorientadores: contar(docs.flatMap((d) => d.co_orientadores).filter(Boolean)),
    keywords: contar(docs.flatMap((d) => d.palavras_chave).filter(Boolean)),
    macrotemas: contar(docs.map((d) => d.macrotema).filter(Boolean)),
  };
  const niveis = (() => {
    const titulosTeses: string[] = [];
    const titulosDissertacoes: string[] = [];
    for (const d of docs) {
      const n = normalizarNivel(d.nivel_academico);
      if (n === 'Teses') titulosTeses.push(d.titulo);
      else if (n === 'Dissertações') titulosDissertacoes.push(d.titulo);
    }
    return { titulosTeses, titulosDissertacoes };
  })();
  const nomesColecoes = [...new Set([...s.programasSelecionados, ...s.cursosTccSelecionados, ...docs.map((d) => d.programa_origem)])].filter(Boolean).sort();

  const corpo: Bloco[] = [];
  const marcado = (id: string) => selecao.dashboard.includes(id);

  if (selecao.dashboard.length > 0) {
    corpo.push({ tipo: 'titulo', texto: 'Dashboard' });
    corpo.push({ tipo: 'nota', texto: `Base: ${nomesColecoes.join('; ') || 'não identificada'}.` });
  }

  if (marcado('indicadores')) {
    conferirCancelamento(signal);
    corpo.push({ tipo: 'subtitulo', texto: 'Indicadores gerais' });
    corpo.push({ tipo: 'indicadores', itens: [
      { rotulo: 'Registros carregados', valor: cobertura.total.toLocaleString('pt-BR') },
      { rotulo: 'Trabalhos únicos', valor: cobertura.trabalhosUnicos.toLocaleString('pt-BR') },
      { rotulo: 'Coleções', valor: String(nomesColecoes.length) },
      { rotulo: 'Período observado', valor: periodoTexto(cobertura) },
      { rotulo: 'Autores', valor: conjuntos.autores.size.toLocaleString('pt-BR') },
      { rotulo: 'Orientadores', valor: conjuntos.orientadores.size.toLocaleString('pt-BR') },
      { rotulo: 'Coorientadores', valor: conjuntos.coorientadores.size.toLocaleString('pt-BR') },
      { rotulo: 'Palavras-chave', valor: conjuntos.keywords.size.toLocaleString('pt-BR') },
    ] });
    corpo.push({ tipo: 'nota', texto: `${cobertura.total} registros · período ${periodoTexto(cobertura)} · ${cobertura.anos} anos com registros · ${cobertura.semAno} sem ano.` });
    corpo.push({ tipo: 'nota', texto: `Resumo: ${cobertura.comResumo}/${cobertura.total} · palavras-chave: ${cobertura.comPalavras}/${cobertura.total} · orientador: ${cobertura.comOrientador}/${cobertura.total} · link de fonte: ${cobertura.comFonte}/${cobertura.total}.` });
    corpo.push({ tipo: 'nota', texto: `Tipos informados: ${Object.entries(cobertura.tipos).map(([t, n]) => `${t}: ${n}`).join(' · ') || 'nenhum'}.` });
    await avancar('Indicadores gerais');
  }

  if (marcado('destaques')) {
    conferirCancelamento(signal);
    corpo.push({ tipo: 'subtitulo', texto: 'Destaques do Ecossistema' });
    const rankings: Array<[string, Map<string, number>, string]> = [
      ['Top 10 Orientadores', contagens.orientadores, TEMA_GRAFICO.paleta[0]],
      ['Top 10 Palavras-chave', contagens.keywords, TEMA_GRAFICO.paleta[2]],
      ['Top 10 Coorientadores', contagens.coorientadores, TEMA_GRAFICO.paleta[1]],
      ['Top 10 Macrotemas', contagens.macrotemas, TEMA_GRAFICO.paleta[4]],
    ];
    for (const [titulo, mapa, cor] of rankings) {
      conferirCancelamento(signal);
      // Mesmo critério da tela: ranking de um nome só não é ranking.
      if (mapa.size <= 1) continue;
      const dados = topN(mapa, 10);
      const img = await desenhar(barrasHorizontais(dados, titulo, cor), { altura: 360, claro });
      if (img) corpo.push({ tipo: 'imagem', dataUrl: img.dataUrl, alt: titulo, proporcao: img.proporcao });
      corpo.push(tabela(titulo, ['Nome completo', 'Ocorrências (n)'], dados.map(([nome, n]) => [nome, String(n)]),
        'Frequência descreve o recorte carregado; não mede mérito nem disponibilidade para orientar.'));
    }

    // --- Volumes e genealogia ---
    const topOri = topN(contagens.orientadores, 1)[0];
    const topCoori = topN(contagens.coorientadores, 1)[0];
    const genealogia = calcularGenealogia(docs, conjuntos);
    if (topOri || topCoori || genealogia.formadores.length || genealogia.mestreDoutor.length) {
      corpo.push({ tipo: 'subtitulo', texto: 'Volumes e genealogia' });
      if (topOri) corpo.push({ tipo: 'paragrafo', texto: `Orientador com maior número de orientações: ${topOri[0]} (${topOri[1]} orientações).` });
      if (topCoori) corpo.push({ tipo: 'paragrafo', texto: `Coorientador com maior número de coorientações: ${topCoori[0]} (${topCoori[1]} coorientações).` });
      corpo.push(genealogia.formadores.length
        ? tabela(`Formadores de professores (${genealogia.formadores.length})`, ['Nome'], genealogia.formadores.map((f) => [f]),
          'Nomes que aparecem na autoria e na orientação de registros do recorte. Isso não confirma identidade, sequência temporal nem atuação atual.')
        : { tipo: 'nota', texto: 'Formadores de professores: nenhum ciclo genealógico detectado nesta amostra.' });
      corpo.push(genealogia.mestreDoutor.length
        ? tabela(`Autores com dissertação e tese na mesma coleção (${genealogia.mestreDoutor.length})`, ['Autor', 'Coleções'],
          genealogia.mestreDoutor.map(([autor, progs]) => [autor, progs.join('; ')]))
        : { tipo: 'nota', texto: 'Autores com dissertação e tese na mesma coleção: nenhum encontrado.' });
    }

    // --- Intermediação e proximidade (depende do SNA, que roda em worker) ---
    corpo.push({ tipo: 'subtitulo', texto: 'Intermediação e proximidade' });
    const topSna = calcularTopologia(s.snaGlobal, conjuntos, niveis);
    if (s.statusSNA !== 'pronto' || !s.snaGlobal) {
      corpo.push({ tipo: 'nota', texto: `As métricas da rede não estavam calculadas quando o relatório foi gerado (estado: ${s.statusSNA}). Abra o Dashboard, aguarde o cálculo terminar e exporte de novo para incluí-las.` });
    } else if (topologiaSemSinal(topSna)) {
      corpo.push({ tipo: 'nota', texto: 'A rede deste recorte não tem caminhos: toda intermediação e proximidade é zero, então não há liderança topológica a relatar.' });
    } else {
      const rotulos: Array<[string, keyof typeof topSna]> = [
        ['Orientador · maior intermediação', 'oriBet'], ['Coorientador · maior intermediação', 'cooriBet'],
        ['Tese · maior intermediação', 'teseBet'], ['Dissertação · maior intermediação', 'dissBet'],
        ['Orientador mais central', 'oriClose'], ['Coorientador mais central', 'cooriClose'],
        ['Tese mais central', 'teseClose'], ['Dissertação mais central', 'dissClose'],
      ];
      corpo.push(tabela('Liderança topológica', ['Medida', 'Entidade', 'Valor'],
        rotulos.filter(([, c]) => topSna[c][0] !== 'Nenhum').map(([r, c]) => [r, topSna[c][0], formatarDecimal(topSna[c][1])]),
        'Betweenness mede quantas vezes a entidade está no caminho mais curto entre outras; closeness, a distância média às demais. Descrevem posição na rede do recorte — não controle real de informação nem mérito.'));
    }

    // --- Diagrama radial: é ECharts, então o desenho sai fora da tela ---
    const rede = construirRedeRadial(docs, 'supervisao', { limiteNos: 60 });
    if (rede.arestas.length > 0) {
      corpo.push({ tipo: 'subtitulo', texto: 'Diagrama radial · orientação conjunta' });
      // Quadrado e grande: o círculo precisa de espaço igual nos quatro lados
      // para os nomes inteiros caberem sem encostar na borda.
      const img = await desenhar(opcaoRedeRadial(rede, undefined, { paraExportacao: true }),
        { altura: 1400, largura: 1400, claro, recortar: true });
      if (img) corpo.push({ tipo: 'imagem', dataUrl: img.dataUrl, alt: 'Diagrama radial de orientação conjunta', proporcao: img.proporcao });
      corpo.push(tabela('Pares de orientação conjunta',
        ['Pessoa', 'Pessoa ligada', 'Registros em comum'],
        [...rede.arestas].sort((a, b) => b.peso - a.peso).map((a) => [a.origem, a.destino, String(a.peso)]),
        `${rede.nos.length} de ${rede.totalNos} nós e ${rede.arestas.length} de ${rede.totalArestas} pares; o corte é visual e não muda a rede completa.`));
    } else {
      corpo.push({ tipo: 'nota', texto: 'Diagrama radial: nenhum registro do recorte tem orientador e coorientador juntos, então não há par de orientação a desenhar.' });
    }
    await avancar('Destaques do Ecossistema');
  }

  if (marcado('trabalhos')) {
    conferirCancelamento(signal);
    const filtro = (s.ui['dashboard.trabalhos.filtro'] as FiltroTrabalhos | undefined) ?? { busca: '', colecao: '', comResumo: false };
    const lista = filtrarTrabalhos(docs, filtro);
    const ativos = [filtro.busca && `busca "${filtro.busca}"`, filtro.colecao && `coleção "${filtro.colecao}"`, filtro.comResumo && 'somente com resumo'].filter(Boolean);
    corpo.push({ tipo: 'subtitulo', texto: 'Trabalhos' });
    corpo.push(tabela('Trabalhos', ['Ano', 'Tipo registrado', 'Título', 'Autoria', 'Coleção'],
      lista.map((d) => [d.ano === null ? 'Sem ano' : String(d.ano), d.nivel_academico || 'Não informado', d.titulo || 'Sem título', d.autores.join('; ') || 'Não informada', d.programa_origem || 'Não informada']),
      `${lista.length} de ${docs.length} registros${ativos.length ? ` · filtro da tela: ${ativos.join(' · ')}` : ' · sem filtro na tela'}. Anos mais recentes primeiro; sem ano ao final. Clique no título para abrir o trabalho no repositório.`,
      linksDosTitulos(2, lista)));
    await avancar('Trabalhos');
  }

  if (marcado('relacoes')) {
    conferirCancelamento(signal);
    corpo.push({ tipo: 'subtitulo', texto: 'Relações em destaque' });
    for (const [titulo, tipo] of [['Temas para começar a exploração', 'Palavra-chave'], ['Orientadores presentes no recorte', 'Orientador']] as Array<[string, TipoBusca]>) {
      const itens = relacionados(docs, tipo).slice(0, 8);
      if (itens.length) corpo.push(tabela(titulo, ['Nome', 'Registros'], itens.map(([n, q]) => [n, String(q)])));
    }
    await avancar('Relações em destaque');
  }

  if (marcado('cobertura')) {
    conferirCancelamento(signal);
    const c = calcularCoberturaTemporal(docs);
    if (c.anos.length > 1) {
      corpo.push({ tipo: 'subtitulo', texto: 'Cobertura de metadados por ano' });
      corpo.push({ tipo: 'nota', texto: 'Percentual dos registros de cada ano com o campo preenchido. Serve para separar queda real de lacuna de metadado: um tema que some num ano pode ter sumido, ou aquele ano pode ter vindo sem palavras-chave.' });
      // Altura acompanha o número de campos, como na tela; a largura do eixo
      // cresce com os anos, então um recorte longo precisa de mais espaço.
      const imgCob = await desenhar(opcaoCoberturaTemporal(c), { altura: 26 * c.campos.length + 190, claro });
      if (imgCob) corpo.push({ tipo: 'imagem', dataUrl: imgCob.dataUrl, alt: 'Mapa de cobertura de metadados por ano', proporcao: imgCob.proporcao });
      corpo.push(tabela('Cobertura por ano', ['Ano', 'Campo', 'Com o campo (n)', 'Registros no ano (n)', 'Cobertura'],
        c.celulas.map((cel) => [String(cel.ano), cel.campo, String(cel.preenchidos), String(cel.total), cel.total === 0 ? '—' : `${Math.round(cel.percentual)}%`])));
    }
    await avancar('Cobertura de metadados por ano');
  }

  if (marcado('colecoes')) {
    conferirCancelamento(signal);
    if (nomesColecoes.length > 1) {
      const linhas = compararColecoes(docs, nomesColecoes, null);
      corpo.push({ tipo: 'subtitulo', texto: 'Comparar coleções' });
      corpo.push(tabela('Comparação de coleções',
        ['Coleção', 'Registros (n)', 'Primeiro ano', 'Último ano', 'Anos com registros', 'Com resumo', 'Com palavras-chave', 'Com orientador'],
        linhas.map((c) => [c.nome || 'Origem não informada', String(c.total), texto(c.inicio), texto(c.fim), String(c.anos), String(c.comResumo), String(c.comPalavras), String(c.comOrientador)]),
        'Coleções podem se sobrepor: somar as linhas não fornece o total de trabalhos únicos. O tamanho do acervo não é medida de qualidade.'));
    }
    await avancar('Comparar coleções');
  }

  if (marcado('sintese-ia')) {
    conferirCancelamento(signal);
    const sintese = s.ui['ficha.sintese'] as { texto?: string } | undefined;
    if (sintese?.texto) {
      corpo.push({ tipo: 'subtitulo', texto: 'Síntese por IA (Ficha Técnica)' });
      corpo.push({ tipo: 'ia', texto: sintese.texto });
    }
    await avancar('Síntese por IA');
  }

  // --- Dossiês do Motor de Busca ---
  const perfis = selecao.dossies.length > 0 ? construirPerfisSimilaridade(docs) : null;
  for (const chave of selecao.dossies) {
    conferirCancelamento(signal);
    const alvo = lerChaveDossie(chave);
    if (!alvo) continue;
    const { tipo, termo } = alvo;
    const docsAlvo: readonly Documento[] = tipo === 'Documento'
      ? (resolverDocumento(docs, termo, undefined) ? [resolverDocumento(docs, termo, undefined)!] : [])
      : docsDoTermo(indices, tipo, termo);
    if (docsAlvo.length === 0) continue;

    corpo.push({ tipo: 'pagina' });
    const urlDoTitulo = tipo === 'Documento' ? fonteSegura(docsAlvo[0].url) : null;
    corpo.push({ tipo: 'titulo', texto: `${tipo}: ${termo || 'Sem título'}`, ...(urlDoTitulo ? { url: urlDoTitulo } : {}) });

    const serie = evolucaoAnual(docsAlvo, false);
    const tabelaQL = tipo === 'Orientador' || tipo === 'Co-orientador'
      ? gerarTabelaQLCruzado(docsAlvo, docs, ['Macrotema', 'Palavra-chave'])
      : tipo === 'Palavra-chave' ? gerarTabelaQLCruzado(docsAlvo, docs, ['Orientador', 'Co-orientador', 'Macrotema'])
      : tipo === 'Macrotema' ? gerarTabelaQLCruzado(docsAlvo, docs, ['Orientador', 'Co-orientador', 'Palavra-chave'])
      : [];
    // A mesma política da tela decide o que entra: análise degenerada não vira
    // gráfico aqui nem lá, e o motivo vai escrito, como na interface.
    const { mostrar, ocultas } = relevanciaDossie({ tipo, docsAlvo, anosNaSerie: serie.length, linhasQL: tabelaQL.length });

    const resumo = resumoRegistros(docsAlvo);
    corpo.push({ tipo: 'indicadores', itens: [
      { rotulo: 'Registros associados', valor: String(docsAlvo.length) },
      { rotulo: 'Período', valor: periodoTexto(resumo) },
      { rotulo: 'Coleções', valor: String(new Set(docsAlvo.map((d) => d.programa_origem).filter(Boolean)).size) },
      { rotulo: 'Com resumo', valor: `${resumo.comResumo}/${resumo.total}` },
    ] });

    if (mostrar.has('evolucao')) {
      const img = await desenhar({
        grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
        xAxis: { type: 'category', data: serie.map((p) => String(p.ano)), axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } } },
        yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } }, axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } } },
        series: [{ type: 'bar', data: serie.map((p) => p.total), itemStyle: { color: TEMA_GRAFICO.paleta[0] } }],
      }, { altura: 320, claro });
      corpo.push({ tipo: 'subtitulo', texto: 'Evolução histórica' });
      if (img) corpo.push({ tipo: 'imagem', dataUrl: img.dataUrl, alt: 'Evolução anual da entidade', proporcao: img.proporcao });
      corpo.push(tabela('Evolução anual', ['Ano', 'Registros no ano (n)'], serie.map((p) => [String(p.ano), String(p.total)]),
        'A ausência de registros num ano não comprova ausência de produção.'));
    }

    if (mostrar.has('lexicometria')) {
      const nuvem = obterFrequenciasTexto(docsAlvo, [FONTES_NUVEM[0]], 40);
      if (nuvem.length) {
        const img = await desenhar({
          series: [{ type: 'wordCloud', shape: 'circle', gridSize: 6, sizeRange: [12, 54], rotationRange: [-45, 45], width: '100%', height: '100%', drawOutOfBound: false,
            textStyle: { fontFamily: '"Manrope Variable", Manrope, sans-serif', fontWeight: 600, color: TEMA_GRAFICO.paleta[0] }, data: nuvem }],
        }, { altura: 400, claro });
        corpo.push({ tipo: 'subtitulo', texto: 'Lexicometria · palavras-chave' });
        if (img) corpo.push({ tipo: 'imagem', dataUrl: img.dataUrl, alt: 'Nuvem de palavras', proporcao: img.proporcao });
        corpo.push(tabela('Frequência dos termos', ['Termo completo', 'Ocorrências (n)'], nuvem.map((p) => [p.name, String(p.value)])));
      }
    }

    if (mostrar.has('orbita')) {
      corpo.push({ tipo: 'subtitulo', texto: 'Órbita de relacionamentos' });
      const ehAtual = selecao.formato !== 'json' && s.buscaTipo === tipo && s.buscaTermo === termo;
      const img = ehAtual ? imagemDaOrbitaNaTela() : null;
      if (img) corpo.push({ tipo: 'imagem', dataUrl: img, alt: 'Órbita de relacionamentos', proporcao: 0.5 });
      else corpo.push({ tipo: 'nota', texto: 'A órbita é uma simulação de forças, e o desenho só existe enquanto está na tela. Aqui vão as ligações em tabela; para incluir a imagem, abra a aba da órbita deste dossiê antes de exportar.' });
      const vizinhos = new Map<string, number>();
      for (const d of docsAlvo) {
        for (const nome of [...d.autores, d.orientador, ...d.co_orientadores, ...d.palavras_chave, d.macrotema]) {
          if (nome && nome !== termo) vizinhos.set(nome, (vizinhos.get(nome) ?? 0) + 1);
        }
      }
      corpo.push(tabela('Vizinhança no recorte', ['Item ligado', 'Registros em comum'],
        [...vizinhos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 60).map(([n, q]) => [n, String(q)])));
    }

    if (mostrar.has('perfil') && tabelaQL.length) {
      corpo.push({ tipo: 'subtitulo', texto: 'Frequências e relações (QL)' });
      corpo.push(tabela('Frequência e especialização relativa',
        ['Entidade', 'Tipo', 'Teses', 'Dissertações', 'Outros', 'Total', 'Valor QL'],
        tabelaQL.map((l) => [l.Entidade, l.Tipo, String(l.Teses), String(l.Dissertações), String(l.Outros), String(l.Total), l['Valor QL'].toFixed(2)]),
        'QL é razão adimensional: acima de 1, acima da referência da base. Não avalia qualidade nem disponibilidade de orientação.'));
    }

    if (mostrar.has('similares') && perfis) {
      const similares = calcularSimilaresRede(termo, tipo, perfis);
      for (const [grupo, itens] of Object.entries(similares)) {
        if (!itens.length) continue;
        corpo.push(tabela(`Itens semelhantes · ${grupo}`, ['Item', 'Similaridade Jaccard (%)', 'Traços em comum'],
          itens.map((i) => [i.Item, Number(i['Similaridade (%)']).toFixed(2), String(i['Traços em Comum'])])));
      }
    }

    corpo.push(tabela('Trabalhos associados', ['Ano', 'Tipo registrado', 'Título', 'Coleção'],
      [...docsAlvo].map((d) => [d.ano === null ? 'Sem ano' : String(d.ano), d.nivel_academico || 'Não informado', d.titulo || 'Sem título', d.programa_origem || 'Não informada']),
      'Clique no título para abrir o trabalho no repositório.', linksDosTitulos(2, docsAlvo)));

    if (ocultas.length) {
      corpo.push({ tipo: 'nota', texto: `Análises omitidas neste dossiê, por não descreverem nada: ${ocultas.map((o) => `${o.nome} (${o.motivo})`).join('; ')}.` });
    }
    await avancar(`Dossiê: ${termo || 'Sem título'}`);
  }

  const agora = new Date();
  const contexto: ContextoCapa = {
    colecoes: nomesColecoes,
    registros: docs.length,
    periodo: periodoTexto(cobertura),
    baseVersao: s.baseVersion,
    geradoEm: agora,
  };
  return {
    contexto,
    relatorio: {
      titulo: `EcoGrad · Relatório da análise · ${carimboDeData(agora)}`,
      arquivo: nomeDoArquivo(agora, selecao.formato),
      capa: blocosDaCapa(contexto),
      corpo,
    },
  };
}
