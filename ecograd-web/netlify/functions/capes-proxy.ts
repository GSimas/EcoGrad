/**
 * Proxy para a API Sucupira/CAPES (o endpoint oficial não envia headers CORS).
 * Transcrição de `carregar_catalogo_capes_ufsc` (backend.py:2410), incluindo a
 * paginação de 100 em 100 e a normalização do nome (sem acentos, caixa alta)
 * usada como chave de cruzamento com os nomes do repositório.
 */
import { erro } from './lib/gemini';

const URL_CAPES = 'https://apigw-proxy.capes.gov.br/observatorio/data/observatorio/ppg';
/** id-ies 4362 = UFSC. */
const ID_IES_UFSC = '4362';
const TAMANHO_PAGINA = 100;
/** Trava de segurança contra paginação infinita. */
const MAX_PAGINAS = 40;

interface PpgCapes {
  nome?: string;
  codigo?: string;
  conceito?: string;
  nomeGrandeAreaConhecimento?: string;
  nomeAreaAvaliacao?: string;
  nomeAreaConhecimento?: string;
  modalidade?: string;
  situacao?: string;
  nomeModalidadeEnsino?: string;
  grau?: string;
}

function normalizar(nome: string): string {
  return nome.trim().toUpperCase().normalize('NFD').replace(/\p{Mn}/gu, '');
}

export default async (req: Request): Promise<Response> => {
  const idIes = new URL(req.url).searchParams.get('idIes') ?? ID_IES_UFSC;
  if (!/^\d{1,8}$/.test(idIes)) return erro('Parâmetro `idIes` inválido.', 400);

  const programas: Record<string, Record<string, string>> = {};

  for (let page = 0; page < MAX_PAGINAS; page += 1) {
    const url = new URL(URL_CAPES);
    url.searchParams.set('query', `id-ies:(${idIes})`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(TAMANHO_PAGINA));

    let resultados: PpgCapes[];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const r = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!r.ok) break;

      const dados: unknown = await r.json();
      resultados = Array.isArray(dados)
        ? (dados as PpgCapes[])
        : (((dados as Record<string, unknown>).content ??
            (dados as Record<string, unknown>).data ??
            []) as PpgCapes[]);
    } catch {
      break; // Mesma política do Python: falha de rede encerra a paginação
    }

    if (resultados.length === 0) break;

    for (const ppg of resultados) {
      const nomeCapes = (ppg.nome ?? '').trim().toUpperCase();
      if (!nomeCapes) continue;
      programas[normalizar(nomeCapes)] = {
        Nome: ppg.nome ?? 'Não informado',
        Código: ppg.codigo ?? 'Não informado',
        Nota: ppg.conceito ?? 'Não informado',
        'Grande Área': ppg.nomeGrandeAreaConhecimento ?? 'Não informado',
        'Área de Avaliação': ppg.nomeAreaAvaliacao ?? 'Não informado',
        'Área de Conhecimento': ppg.nomeAreaConhecimento ?? 'Não informado',
        Modalidade: ppg.modalidade ?? 'Não informado',
        Situação: ppg.situacao ?? 'Não informado',
        'Modalidade de Ensino': ppg.nomeModalidadeEnsino ?? 'Não informado',
        'Grau Acadêmico': ppg.grau ?? 'Não informado',
      };
    }

    if (resultados.length < TAMANHO_PAGINA) break;
  }

  return new Response(JSON.stringify(programas), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // O catálogo muda raramente — 24h de cache, como o ttl=86400 do Streamlit
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
};
