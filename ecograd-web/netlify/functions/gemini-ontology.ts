/**
 * Extração de teorias, métodos e ferramentas a partir de título + resumo.
 * Transcrição de `extrair_artefatos_llm` (backend.py:765) e do laço de
 * `processar_lote_ontologia` (backend.py:843), incluindo o delay de segurança
 * de 4s entre requisições e a blindagem contra formatos inesperados da IA.
 */
import { erro, gerarComRetry, json, MODELOS_RAPIDOS } from './_shared';

interface ItemLote {
  titulo: string;
  resumo: string;
}

interface Payload {
  /** Documentos do lote (o cliente controla o tamanho e a fila). */
  itens?: ItemLote[];
  /** Intervalo entre chamadas, em ms. Padrão 4000 (igual ao Python). */
  delayMs?: number;
}

export interface OntologiaIA {
  teorias_e_modelos: string[];
  ferramentas_e_artefatos: string[];
  metodos_e_tecnicas: string[];
}

const CHAVES = ['teorias_e_modelos', 'ferramentas_e_artefatos', 'metodos_e_tecnicas'] as const;

/** Limite conservador: mantém a função abaixo do teto de 10s/26s da Netlify. */
const MAX_ITENS_POR_CHAMADA = 8;

function montarPrompt(titulo: string, resumo: string): string {
  return `
    Extraia as entidades específicas que foram objeto central de desenvolvimento, análise ou uso metodológico no texto abaixo.
    Não extraia palavras genéricas. Busque ferramentas, métodos, algoritmos, frameworks ou teorias.

    REGRA CRÍTICA DE PADRONIZAÇÃO (NOME CANÔNICO):
    Padronize os nomes encontrados similares para a sua forma mais comum, curta ou sigla.
    Por exemplo: se o texto diz "Microscópio Eletrônico de Varredura" ou "Microscopia Eletrônica de Varredura", escolha apenas um nome e os agrupe.
    Agrupe variações do mesmo conceito sob um único nome guarda-chuva consolidado.

    O RETORNO DEVE SER EXATAMENTE UM JSON COM AS SEGUINTES CHAVES:
    {
        "teorias_e_modelos": ["teoria 1", "modelo A"],
        "ferramentas_e_artefatos": ["ferramenta 1", "software B"],
        "metodos_e_tecnicas": ["método 1", "técnica C"]
    }
    Se não houver itens para uma categoria, retorne uma lista vazia [].

    Título: ${titulo}
    Resumo: ${resumo}
  `;
}

/**
 * Blindagem idêntica à do Python: a IA às vezes devolve uma lista de objetos,
 * uma lista simples de strings, ou algo que não é um dicionário.
 */
function normalizarOntologia(bruto: unknown): OntologiaIA {
  let valor = bruto;

  if (Array.isArray(valor)) {
    if (valor.length > 0 && typeof valor[0] === 'object' && valor[0] !== null) {
      // CASO A: lista de objetos → achata pegando o primeiro valor de cada um
      const achatada: string[] = [];
      for (const item of valor as Array<Record<string, unknown>>) {
        const primeiro = Object.values(item)[0];
        if (primeiro) achatada.push(String(primeiro));
      }
      valor = { teorias_e_modelos: [], ferramentas_e_artefatos: achatada, metodos_e_tecnicas: [] };
    } else {
      // CASO B: lista simples de strings
      valor = {
        teorias_e_modelos: [],
        ferramentas_e_artefatos: (valor as unknown[]).map(String),
        metodos_e_tecnicas: [],
      };
    }
  }

  // CASO C: não é um dicionário
  if (!valor || typeof valor !== 'object') valor = {};

  const obj = valor as Record<string, unknown>;
  const saida = {} as OntologiaIA;
  for (const chave of CHAVES) {
    saida[chave] = Array.isArray(obj[chave]) ? (obj[chave] as unknown[]).map(String) : [];
  }
  return saida;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return erro('Use POST.', 405);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return erro('Corpo da requisição inválido (JSON esperado).', 400);
  }

  const itens = (payload.itens ?? []).slice(0, MAX_ITENS_POR_CHAMADA);
  const delayMs = Math.max(0, payload.delayMs ?? 4000);
  if (itens.length === 0) return erro('Informe ao menos um item em `itens`.', 400);

  const resultados: Array<{ titulo: string; ontologia: OntologiaIA | null; erro: string | null }> = [];

  for (let i = 0; i < itens.length; i += 1) {
    const { titulo, resumo } = itens[i];

    if (!titulo || !resumo) {
      resultados.push({ titulo, ontologia: null, erro: 'Documento sem resumo válido' });
      continue;
    }

    try {
      const texto = await gerarComRetry({
        contents: [{ role: 'user', parts: [{ text: montarPrompt(titulo, resumo) }] }],
        modelos: MODELOS_RAPIDOS,
        temperature: 0.2,
        responseMimeType: 'application/json',
      });
      resultados.push({ titulo, ontologia: normalizarOntologia(JSON.parse(texto)), erro: null });
    } catch (e) {
      resultados.push({ titulo, ontologia: null, erro: e instanceof Error ? e.message : String(e) });
    }

    // Delay de segurança entre requisições (evita estourar a cota gratuita)
    if (i < itens.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return json({
    resultados,
    processados: resultados.filter((r) => r.ontologia !== null).length,
    maxItensPorChamada: MAX_ITENS_POR_CHAMADA,
  });
};
