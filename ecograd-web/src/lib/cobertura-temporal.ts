/**
 * Cobertura de metadados por ano.
 *
 * O `CoberturaAnalise` informa quanto do recorte tem resumo, palavras-chave,
 * orientador e link — mas só no agregado. A pergunta que decide se uma série
 * temporal pode ser lida é outra: *em quais anos a base está rala?* Um tema que
 * "desaparece" em 2008 pode ter desaparecido, ou 2008 pode ser o ano em que
 * 70% dos registros vieram sem palavras-chave.
 *
 * Este módulo cruza ano × campo para que essa distinção fique visível antes de
 * qualquer leitura de tendência.
 *
 * Duas decisões deliberadas:
 *
 * - **Registros sem ano entram como coluna própria**, em vez de sumirem da
 *   conta. Eles existem no recorte e afetam todos os totais; escondê-los seria
 *   criar exatamente a lacuna silenciosa que o gráfico deveria denunciar.
 * - **Coorientação não é medida.** Ausência de coorientador é o caso normal de
 *   um trabalho, não falha de metadado — contá-la como "não preenchido"
 *   transformaria uma característica em defeito.
 */
import type { Documento } from '@/types';
import { chaveFonte } from './resultados';

/**
 * Teto de colunas do eixo de anos. Acima disso o intervalo contínuo é
 * abandonado: um ano corrompido nos metadados ("202", "20") esticaria a escala
 * para centenas de colunas e destruiria a legibilidade do mapa.
 */
const MAX_COLUNAS_ANO = 80;

/** Rótulo da coluna que reúne os registros sem ano declarado. */
export const SEM_ANO = 'Sem ano';

export interface CampoCobertura {
  chave: string;
  rotulo: string;
  /** O que exatamente conta como preenchido, para a descrição e a tabela. */
  criterio: string;
  presente: (d: Documento) => boolean;
}

export interface CelulaCobertura {
  ano: string;
  campo: string;
  preenchidos: number;
  total: number;
  /** 0–100, arredondado para inteiro apenas na exibição. */
  percentual: number;
}

export interface CoberturaTemporal {
  /** Categorias do eixo X, em ordem cronológica, com `SEM_ANO` por último. */
  anos: string[];
  campos: CampoCobertura[];
  celulas: CelulaCobertura[];
  /** Registros por ano — o volume que dá peso (ou não) a cada percentual. */
  totaisPorAno: Array<{ ano: string; total: number }>;
  totalRegistros: number;
  semAno: number;
  /** Célula de menor cobertura, para a interface poder nomear o pior ponto. */
  pior: CelulaCobertura | null;
  /**
   * `true` quando o eixo cobre o intervalo inteiro, incluindo anos sem nenhum
   * registro. `false` quando o intervalo era largo demais e o eixo lista apenas
   * os anos observados — caso em que a série não deve ser lida como contínua.
   */
  intervaloContinuo: boolean;
  /** Anos dentro do intervalo que não têm nenhum registro. */
  anosVazios: string[];
}

/**
 * Campos avaliados. A ordem é a de leitura no eixo Y, de baixo para cima no
 * ECharts — por isso a interface inverte a lista ao desenhar.
 */
export const CAMPOS_COBERTURA: readonly CampoCobertura[] = [
  {
    chave: 'resumo',
    rotulo: 'Resumo',
    criterio: 'Campo de resumo com algum texto.',
    presente: (d) => !!d.resumo?.trim(),
  },
  {
    chave: 'palavras_chave',
    rotulo: 'Palavras-chave',
    criterio: 'Pelo menos um termo declarado.',
    presente: (d) => d.palavras_chave.some((p) => p?.trim()),
  },
  {
    chave: 'orientador',
    rotulo: 'Orientador',
    criterio: 'Nome de orientador informado.',
    presente: (d) => !!d.orientador?.trim(),
  },
  {
    chave: 'macrotema',
    rotulo: 'Macrotema',
    criterio: 'Classe atribuída pelo pipeline (não declarada pelo autor).',
    presente: (d) => !!d.macrotema?.trim(),
  },
  {
    chave: 'fonte',
    rotulo: 'Link da fonte',
    criterio: 'URL válida para o repositório.',
    presente: (d) => !!chaveFonte(d.url),
  },
];

/** Ano do registro como rótulo de coluna, ou `SEM_ANO` quando não há ano válido. */
function colunaDoRegistro(d: Documento): string {
  return d.ano !== null && Number.isFinite(d.ano) ? String(d.ano) : SEM_ANO;
}

export function calcularCoberturaTemporal(
  docs: readonly Documento[],
  campos: readonly CampoCobertura[] = CAMPOS_COBERTURA,
): CoberturaTemporal {
  const porColuna = new Map<string, Documento[]>();
  for (const d of docs) {
    const coluna = colunaDoRegistro(d);
    const grupo = porColuna.get(coluna);
    if (grupo) grupo.push(d);
    else porColuna.set(coluna, [d]);
  }

  const observados = [...porColuna.keys()]
    .filter((c) => c !== SEM_ANO)
    .map(Number)
    .sort((a, b) => a - b);

  // O eixo cobre o intervalo inteiro, e não apenas os anos que têm registros:
  // um ano vazio no meio da série é a lacuna mais severa possível, e saltá-lo
  // faria a série parecer contínua. Anos vazios viram colunas em branco.
  let escala: string[] = [];
  let intervaloContinuo = false;
  if (observados.length > 0) {
    const inicio = observados[0];
    const fim = observados[observados.length - 1];
    const largura = fim - inicio + 1;
    if (largura <= MAX_COLUNAS_ANO) {
      intervaloContinuo = true;
      escala = Array.from({ length: largura }, (_, i) => String(inicio + i));
    } else {
      // Um ano corrompido nos metadados (por exemplo "202") esticaria o eixo
      // para centenas de colunas ilegíveis. Nesse caso mostramos só os anos
      // observados e declaramos isso no contexto da tabela.
      escala = observados.map(String);
    }
  }
  const anos = porColuna.has(SEM_ANO) ? [...escala, SEM_ANO] : escala;

  const celulas: CelulaCobertura[] = [];
  let pior: CelulaCobertura | null = null;

  for (const ano of anos) {
    const grupo = porColuna.get(ano) ?? [];
    for (const campo of campos) {
      const preenchidos = grupo.reduce((n, d) => n + (campo.presente(d) ? 1 : 0), 0);
      const celula: CelulaCobertura = {
        ano,
        campo: campo.rotulo,
        preenchidos,
        total: grupo.length,
        percentual: grupo.length === 0 ? 0 : (preenchidos / grupo.length) * 100,
      };
      celulas.push(celula);
      // O pior ponto só é informativo se houver registros suficientes para o
      // percentual significar algo: um ano com 1 registro sem resumo marcaria
      // 0% e roubaria a atenção de uma lacuna real em um ano cheio.
      if (grupo.length >= 5 && (!pior || celula.percentual < pior.percentual)) pior = celula;
    }
  }

  return {
    anos,
    campos: [...campos],
    celulas,
    totaisPorAno: anos.map((ano) => ({ ano, total: porColuna.get(ano)?.length ?? 0 })),
    totalRegistros: docs.length,
    semAno: porColuna.get(SEM_ANO)?.length ?? 0,
    pior,
    intervaloContinuo,
    anosVazios: escala.filter((ano) => !porColuna.has(ano)),
  };
}
