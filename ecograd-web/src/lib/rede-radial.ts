/**
 * Dados do diagrama radial (layout circular com arestas curvas) usado nos
 * Destaques do Ecossistema.
 *
 * Duas leituras do mesmo recorte:
 *
 * - `supervisao`: quem orientou junto com quem. Uma aresta liga o orientador
 *   ao coorientador do mesmo registro; o peso é o número de registros em que
 *   a dupla aparece junta. Não é coautoria de artigo — é corresponsabilidade
 *   de orientação como a base registra.
 * - `palavras`: coocorrência de palavras-chave. Uma aresta liga dois termos
 *   declarados no mesmo registro; o peso é o número de registros em comum.
 * - `macrotemas`: cada registro tem um único macrotema, então dois deles nunca
 *   ocorrem no mesmo registro. A ligação aqui é feita pelas PESSOAS que
 *   transitam entre áreas: uma aresta liga dois macrotemas quando a mesma
 *   pessoa tem trabalhos nos dois, e o peso é o número de pessoas em comum.
 *
 * O desenho circular só fica legível com poucas dezenas de nós, então o grafo
 * é cortado pelos nós de maior grau ponderado. O corte é informado de volta
 * para que a interface possa declará-lo.
 */
import type { EChartsOption } from 'echarts';
import { TEMA_GRAFICO } from './tema-grafico';
import type { Documento } from '@/types';

export type ModoRadial = 'supervisao' | 'palavras' | 'macrotemas';

export interface NoRadial {
  /** Nome da entidade; é a chave usada pelas arestas do ECharts. */
  id: string;
  /** Arco em que o nó é desenhado (papel na supervisão, ou macrotema). */
  grupo: string;
  /** Registros em que a entidade aparece no recorte. */
  ocorrencias: number;
  /** Soma dos pesos das arestas que sobraram após o corte. */
  grauPonderado: number;
}

export interface ArestaRadial {
  origem: string;
  destino: string;
  /** Registros em que o par aparece junto. */
  peso: number;
}

export interface RedeRadial {
  nos: NoRadial[];
  arestas: ArestaRadial[];
  grupos: string[];
  /** Nós no grafo completo, antes do corte por grau. */
  totalNos: number;
  /** Pares distintos no grafo completo, antes do corte. */
  totalArestas: number;
  /** Registros que contribuíram com pelo menos um par. */
  registrosComPar: number;
}

const SEM_MACROTEMA = 'Sem macrotema';
const PAPEL_ORIENTADOR = 'Orientador';
export const PAPEL_COORIENTADOR = 'Coorientador';
const PAPEL_AMBOS = 'Orientador e coorientador';
export const GRUPO_MACROTEMA = 'Macrotema';

/**
 * Separador da chave de par: precisa ser um caractere impossível em nome de
 * pessoa ou palavra-chave. Com espaço, o par ("Ana Maria", "Silva") e o par
 * ("Ana", "Maria Silva") gerariam a mesma chave, e o `split` de volta
 * devolveria os nomes partidos no lugar errado.
 */
const SEP = '\u0000';

/** Chave estável e simétrica de um par não-ordenado. */
function chavePar(a: string, b: string): string {
  return a < b ? `${a}${SEP}${b}` : `${b}${SEP}${a}`;
}

function incrementar<K>(mapa: Map<K, number>, chave: K, passo = 1): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + passo);
}

/**
 * Pares de supervisão conjunta: orientador × cada coorientador do registro, e
 * também coorientador × coorientador quando há mais de um. Autolaços (a mesma
 * pessoa nos dois papéis do mesmo registro) são descartados.
 */
function paresSupervisao(d: Documento): Array<[string, string]> {
  const orientador = d.orientador?.trim();
  const coorientadores = [...new Set(d.co_orientadores.map((c) => c?.trim()).filter((c): c is string => !!c))];
  const pares: Array<[string, string]> = [];

  if (orientador) {
    for (const co of coorientadores) {
      if (co !== orientador) pares.push([orientador, co]);
    }
  }
  for (let i = 0; i < coorientadores.length; i += 1) {
    for (let j = i + 1; j < coorientadores.length; j += 1) {
      pares.push([coorientadores[i], coorientadores[j]]);
    }
  }
  return pares;
}

/** Pares de palavras-chave declaradas no mesmo registro. */
function paresPalavras(d: Documento): Array<[string, string]> {
  const termos = [...new Set(d.palavras_chave.map((p) => p?.trim()).filter((p): p is string => !!p))];
  const pares: Array<[string, string]> = [];
  for (let i = 0; i < termos.length; i += 1) {
    for (let j = i + 1; j < termos.length; j += 1) {
      pares.push([termos[i], termos[j]]);
    }
  }
  return pares;
}

/**
 * Papel de cada pessoa no recorte inteiro. Quem aparece nos dois papéis em
 * registros diferentes recebe um arco próprio, em vez de ser forçado a um só.
 */
function papeisSupervisao(docs: readonly Documento[]): Map<string, string> {
  const orientou = new Set<string>();
  const coorientou = new Set<string>();
  for (const d of docs) {
    const o = d.orientador?.trim();
    if (o) orientou.add(o);
    for (const c of d.co_orientadores) {
      const nome = c?.trim();
      if (nome) coorientou.add(nome);
    }
  }
  const papeis = new Map<string, string>();
  for (const nome of new Set([...orientou, ...coorientou])) {
    const o = orientou.has(nome);
    const c = coorientou.has(nome);
    papeis.set(nome, o && c ? PAPEL_AMBOS : o ? PAPEL_ORIENTADOR : PAPEL_COORIENTADOR);
  }
  return papeis;
}

/**
 * Macrotema dominante de cada palavra-chave: o macrotema que mais vezes
 * acompanha o termo no recorte. Empate resolve pelo nome, para o desenho não
 * mudar entre execuções.
 */
function macrotemaDominante(docs: readonly Documento[]): Map<string, string> {
  const porTermo = new Map<string, Map<string, number>>();
  for (const d of docs) {
    const macro = d.macrotema?.trim() || SEM_MACROTEMA;
    for (const p of d.palavras_chave) {
      const termo = p?.trim();
      if (!termo) continue;
      let contagem = porTermo.get(termo);
      if (!contagem) {
        contagem = new Map();
        porTermo.set(termo, contagem);
      }
      incrementar(contagem, macro);
    }
  }
  const dominante = new Map<string, string>();
  for (const [termo, contagem] of porTermo) {
    let melhor = SEM_MACROTEMA;
    let valor = -1;
    for (const [macro, n] of [...contagem.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))) {
      if (n > valor) {
        valor = n;
        melhor = macro;
      }
    }
    dominante.set(termo, melhor);
  }
  return dominante;
}

/**
 * Monta a rede radial já cortada em `limiteNos` nós e `pesoMinimo` de aresta.
 *
 * O corte é feito em duas passagens: primeiro escolhe os nós pelo grau
 * ponderado no grafo completo, depois mantém só as arestas cujos dois extremos
 * sobreviveram. Assim o corte não inventa vizinhança — ele apenas esconde
 * parte dela, e `totalNos`/`totalArestas` preservam a escala real.
 */
/** Autoria, orientação e coorientação do registro, sem repetir a mesma pessoa. */
function pessoasDoRegistro(d: Documento): string[] {
  const nomes = [d.orientador, ...d.co_orientadores, ...d.autores].map((n) => n?.trim());
  return [...new Set(nomes.filter((n): n is string => !!n))];
}

/**
 * Rede de macrotemas ligada por pessoas. O peso conta quantas pessoas têm
 * trabalhos nos dois temas — é a medida de quem atravessa as fronteiras
 * temáticas do recorte, e não de vocabulário compartilhado.
 */
function redeMacrotemas(docs: readonly Documento[]) {
  const temasPorPessoa = new Map<string, Set<string>>();
  const ocorrencias = new Map<string, number>();
  for (const d of docs) {
    const tema = d.macrotema?.trim();
    if (!tema) continue;
    incrementar(ocorrencias, tema);
    for (const pessoa of pessoasDoRegistro(d)) {
      let temas = temasPorPessoa.get(pessoa);
      if (!temas) {
        temas = new Set();
        temasPorPessoa.set(pessoa, temas);
      }
      temas.add(tema);
    }
  }
  const pesos = new Map<string, number>();
  const comPar = new Set<string>();
  for (const temas of temasPorPessoa.values()) {
    const lista = [...temas];
    for (let i = 0; i < lista.length; i += 1) {
      for (let j = i + 1; j < lista.length; j += 1) {
        incrementar(pesos, chavePar(lista[i], lista[j]));
        comPar.add(lista[i]);
        comPar.add(lista[j]);
      }
    }
  }
  let registrosComPar = 0;
  for (const d of docs) {
    const tema = d.macrotema?.trim();
    if (tema && comPar.has(tema)) registrosComPar += 1;
  }
  return { pesos, ocorrencias, registrosComPar };
}

export function construirRedeRadial(
  docs: readonly Documento[],
  modo: ModoRadial,
  { limiteNos = 60, pesoMinimo = 1 }: { limiteNos?: number; pesoMinimo?: number } = {},
): RedeRadial {
  const pesos = new Map<string, number>();
  const ocorrencias = new Map<string, number>();
  let registrosComPar = 0;

  if (modo === 'macrotemas') {
    // Agregado por pessoa, e não por registro: o par não existe dentro de um
    // documento, só na trajetória de quem publica em mais de um tema.
    const rede = redeMacrotemas(docs);
    rede.pesos.forEach((v, k) => pesos.set(k, v));
    rede.ocorrencias.forEach((v, k) => ocorrencias.set(k, v));
    registrosComPar = rede.registrosComPar;
  } else {
    const extrair = modo === 'supervisao' ? paresSupervisao : paresPalavras;
    for (const d of docs) {
      // Ocorrências contam presença no registro, mesmo sem par — é o tamanho da
      // entidade no recorte, não o seu grau na rede.
      const entidades = modo === 'supervisao'
        ? [d.orientador?.trim(), ...d.co_orientadores.map((c) => c?.trim())]
        : d.palavras_chave.map((p) => p?.trim());
      for (const e of new Set(entidades.filter((e): e is string => !!e))) incrementar(ocorrencias, e);

      const pares = extrair(d);
      if (pares.length > 0) registrosComPar += 1;
      for (const [a, b] of pares) incrementar(pesos, chavePar(a, b));
    }
  }

  const totalArestas = [...pesos.values()].filter((p) => p >= pesoMinimo).length;

  // Grau ponderado no grafo completo (respeitando `pesoMinimo`), para escolher
  // quem fica. Nós sem nenhuma aresta não entram: num diagrama de relações,
  // um ponto solto não comunica nada.
  const grauCompleto = new Map<string, number>();
  for (const [chave, peso] of pesos) {
    if (peso < pesoMinimo) continue;
    const [a, b] = chave.split(SEP);
    incrementar(grauCompleto, a, peso);
    incrementar(grauCompleto, b, peso);
  }
  const totalNos = grauCompleto.size;

  const mantidos = new Set(
    [...grauCompleto.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, limiteNos)
      .map(([nome]) => nome),
  );

  const arestas: ArestaRadial[] = [];
  const grauVisivel = new Map<string, number>();
  for (const [chave, peso] of pesos) {
    if (peso < pesoMinimo) continue;
    const [a, b] = chave.split(SEP);
    if (!mantidos.has(a) || !mantidos.has(b)) continue;
    arestas.push({ origem: a, destino: b, peso });
    incrementar(grauVisivel, a, peso);
    incrementar(grauVisivel, b, peso);
  }

  // No modo de macrotemas o próprio nó já é o tema: não há categoria acima dele
  // para formar arcos, então todos ficam num anel único.
  const grupoDe = modo === 'supervisao' ? papeisSupervisao(docs) : modo === 'palavras' ? macrotemaDominante(docs) : new Map<string, string>();
  const grupoPadrao = modo === 'supervisao' ? PAPEL_ORIENTADOR : modo === 'palavras' ? SEM_MACROTEMA : GRUPO_MACROTEMA;

  const nos: NoRadial[] = [...mantidos].map((id) => ({
    id,
    grupo: grupoDe.get(id) ?? grupoPadrao,
    ocorrencias: ocorrencias.get(id) ?? 0,
    grauPonderado: grauVisivel.get(id) ?? 0,
  }));

  // Ordem dos grupos: no modo supervisão a ordem dos papéis é semântica; no de
  // palavras, os macrotemas maiores primeiro. Em ambos, os nós saem ordenados
  // por grupo para que o layout circular desenhe arcos contíguos.
  const tamanhoGrupo = new Map<string, number>();
  for (const no of nos) incrementar(tamanhoGrupo, no.grupo);
  const grupos = modo === 'supervisao'
    ? [PAPEL_ORIENTADOR, PAPEL_AMBOS, PAPEL_COORIENTADOR].filter((g) => tamanhoGrupo.has(g))
    : [...tamanhoGrupo.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
        .map(([g]) => g);

  const ordemGrupo = new Map(grupos.map((g, i) => [g, i]));
  nos.sort((a, b) =>
    (ordemGrupo.get(a.grupo) ?? 0) - (ordemGrupo.get(b.grupo) ?? 0)
    || b.grauPonderado - a.grauPonderado
    || a.id.localeCompare(b.id, 'pt-BR'));

  return { nos, arestas, grupos, totalNos, totalArestas, registrosComPar };
}

/**
 * Existe algum par a desenhar em algum dos três modos?
 *
 * A aba do diagrama precisa decidir se aparece antes de o usuário escolher o
 * modo, e montar as três redes só para descobrir que todas estão vazias custa
 * três varreduras da base a cada render. Este atalho responde na primeira
 * ligação que encontrar, usando exatamente os mesmos critérios de par de
 * `construirRedeRadial` — supervisão conjunta, coocorrência de palavras-chave
 * e macrotemas ligados por uma pessoa em comum.
 */
export function temLigacaoRadial(docs: readonly Documento[]): boolean {
  const temasPorPessoa = new Map<string, Set<string>>();
  for (const d of docs) {
    if (paresSupervisao(d).length > 0 || paresPalavras(d).length > 0) return true;
    const tema = d.macrotema?.trim();
    if (!tema) continue;
    for (const pessoa of pessoasDoRegistro(d)) {
      let temas = temasPorPessoa.get(pessoa);
      if (!temas) {
        temas = new Set<string>();
        temasPorPessoa.set(pessoa, temas);
      }
      temas.add(tema);
      if (temas.size > 1) return true;
    }
  }
  return false;
}

/**
 * Opção do ECharts para o diagrama radial.
 *
 * Pura de propósito: a tela a usa com o destaque que o usuário fixou, e a
 * montagem do relatório em PDF a usa com `focais` vazio, desenhando o mesmo
 * diagrama fora da tela. Sem isso, o PDF precisaria de uma segunda cópia de
 * noventa linhas de configuração, que envelheceria separada desta.
 */
export interface OpcoesDesenhoRadial {
  /**
   * Desenho para papel: nome inteiro, margem larga e nenhum rótulo escondido.
   *
   * Na tela o nome é cortado em 28 caracteres e a sobreposição some, porque o
   * usuário tem hover, zoom e arrasto para recuperar o que falta. Um PDF não
   * tem nada disso: o que não foi desenhado está perdido. Exige uma tela de
   * desenho grande e quadrada — a margem só reserva o espaço, quem cabe os
   * nomes é o tamanho.
   */
  paraExportacao?: boolean;
}

export function opcaoRedeRadial(
  rede: RedeRadial,
  focais: ReadonlySet<string> = new Set(),
  { paraExportacao = false }: OpcoesDesenhoRadial = {},
): EChartsOption {
  const maiorGrau = Math.max(1, ...rede.nos.map((n) => n.grauPonderado));
  const maiorPeso = Math.max(1, ...rede.arestas.map((a) => a.peso));
  const indiceGrupo = new Map(rede.grupos.map((g, i) => [g, i]));

  const destacando = focais.size > 0;
  const vizinhos = new Set<string>();
  for (const a of rede.arestas) {
    if (focais.has(a.origem)) vizinhos.add(a.destino);
    if (focais.has(a.destino)) vizinhos.add(a.origem);
  }

  return {
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { dataType?: string; data?: Record<string, unknown> };
        if (p.dataType === 'edge') {
          const d = p.data as { source: string; target: string; value: number };
          return `${d.source}\n${d.target}\n${d.value} ${d.value === 1 ? 'registro em comum' : 'registros em comum'}`;
        }
        const d = p.data as { name: string; grupo: string; ocorrencias: number; value: number };
        return `${d.name}\n${d.grupo}\n${d.ocorrencias} ${d.ocorrencias === 1 ? 'registro' : 'registros'}\nGrau ponderado no desenho: ${d.value}`;
      },
    },
    // Legenda desligada explicitamente, e não apenas omitida: o `Grafico`
    // sempre injeta um componente `legend` para forçar `selectedMode: false`,
    // e um `legend` sem `data` faz o ECharts preencher a lista sozinho a
    // partir de `series.categories` e desenhá-la no topo, por cima dos
    // rótulos do círculo. A legenda real é HTML, passada em `rodape` —
    // fora do canvas ela não é sobreposta quando o usuário arrasta o
    // diagrama, e os nomes dos macrotemas não saem cortados.
    legend: { show: false },
    series: [{
      type: 'graph',
      layout: 'circular',
      // O círculo é desenhado dentro desta caixa. As margens dão espaço aos
      // rótulos, que saem para fora do círculo e são longos (nomes
      // completos). A legenda não entra nessa conta: ela é HTML, fora daqui.
      left: paraExportacao ? '27%' : '13%',
      right: paraExportacao ? '27%' : '13%',
      top: paraExportacao ? 56 : 28,
      bottom: paraExportacao ? 56 : 28,
      // Sem rotação os rótulos se empilham; com ela o diagrama fica igual ao
      // desenho radial clássico, com os nomes saindo do círculo.
      circular: { rotateLabel: true },
      categories: rede.grupos.map((g, i) => ({
        name: g,
        itemStyle: { color: TEMA_GRAFICO.paleta[i % TEMA_GRAFICO.paleta.length] },
      })),
      data: rede.nos.map((n) => ({
        id: n.id,
        name: n.id,
        value: n.grauPonderado,
        grupo: n.grupo,
        ocorrencias: n.ocorrencias,
        category: indiceGrupo.get(n.grupo) ?? 0,
        symbolSize: 6 + 18 * Math.sqrt(n.grauPonderado / maiorGrau),
        ...(!destacando ? {} : focais.has(n.id) ? {
          itemStyle: { borderColor: TEMA_GRAFICO.texto, borderWidth: 2 },
          label: { fontSize: 13, fontWeight: 'bold' as const },
        } : vizinhos.has(n.id) ? {} : {
          itemStyle: { opacity: 0.15 },
          label: { color: 'rgba(148, 163, 184, 0.3)' },
        }),
      })),
      links: rede.arestas.map((a) => ({
        source: a.origem,
        target: a.destino,
        value: a.peso,
        lineStyle: {
          width: 0.6 + 3 * (a.peso / maiorPeso),
          ...(!destacando ? {} : focais.has(a.origem) || focais.has(a.destino)
            ? { opacity: 0.85, width: 1.5 + 3 * (a.peso / maiorPeso) }
            : { opacity: 0.04 }),
        },
      })),
      roam: true,
      label: {
        show: true,
        position: 'right',
        color: TEMA_GRAFICO.texto,
        fontSize: paraExportacao ? 11 : 10,
        formatter: (p: unknown) => {
          const nome = (p as { name: string }).name;
          if (paraExportacao) return nome;
          return nome.length > 28 ? `${nome.slice(0, 28)}…` : nome;
        },
      },
      // Rótulo de nó destacado nunca é escondido pela sobreposição.
      labelLayout: (p: { dataIndex?: number }) => ({
        hideOverlap: paraExportacao ? false : !focais.has(rede.nos[p.dataIndex ?? -1]?.id ?? ''),
      }),
      lineStyle: { color: 'source', curveness: 0.3, opacity: 0.22 },
      emphasis: {
        // Com um destaque fixo, o hover não isola outra vizinhança por cima dele.
        focus: destacando ? 'none' : 'adjacency',
        label: { show: true, fontSize: 12 },
        lineStyle: { width: 3, opacity: 0.85 },
      },
    }],
  };
}
