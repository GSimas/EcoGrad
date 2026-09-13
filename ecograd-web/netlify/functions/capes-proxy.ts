/**
 * Proxy para a API Sucupira/CAPES (o endpoint oficial não envia headers CORS).
 * Paginação completa e identidade pelo código oficial, preservando homônimos.
 */
import { erro } from './lib/gemini';
import { carregarPaginaCapes } from './_shared/capes-tls';
import type { CatalogoCapes, ProgramaCapes } from '../../src/types';

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

export default async (req: Request): Promise<Response> => {
  const idIes = new URL(req.url).searchParams.get('idIes') ?? ID_IES_UFSC;
  if (!/^\d{1,8}$/.test(idIes)) return erro('Parâmetro `idIes` inválido.', 400);

  const programas: Record<string, ProgramaCapes> = {};

  for (let page = 0; page < MAX_PAGINAS; page += 1) {
    const url = new URL(URL_CAPES);
    url.searchParams.set('query', `id-ies:(${idIes})`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(TAMANHO_PAGINA));

    let resultados: PpgCapes[];
    try {
      const dados = await carregarPaginaCapes(url);
      const linhas = Array.isArray(dados)
        ? dados
        : dados && typeof dados === 'object'
          ? (dados as Record<string, unknown>).content ?? (dados as Record<string, unknown>).data
          : null;
      if (!Array.isArray(linhas) || linhas.some((p) =>
        !p || typeof p.nome !== 'string' || !p.nome.trim() ||
        typeof p.codigo !== 'string' || !p.codigo.trim() ||
        ['conceito', 'nomeGrandeAreaConhecimento', 'nomeAreaAvaliacao', 'nomeAreaConhecimento',
          'modalidade', 'situacao', 'nomeModalidadeEnsino', 'grau'].some((k) =>
          p[k] != null && typeof p[k] !== 'string'),
      )) {
        throw new Error('Formato de catálogo CAPES inválido.');
      }
      resultados = linhas as PpgCapes[];
    } catch (e) {
      console.error('[capes-proxy] Falha ao consultar CAPES:', e);
      return erro('Não foi possível consultar a CAPES agora. Tente novamente em instantes.', 502);
    }

    if (resultados.length === 0) break;

    for (const ppg of resultados) {
      const codigo = ppg.codigo!.trim();
      const ficha: ProgramaCapes = {
        Nome: ppg.nome!.trim(),
        Código: codigo,
        Nota: ppg.conceito ?? 'Não informado',
        'Grande Área': ppg.nomeGrandeAreaConhecimento ?? 'Não informado',
        'Área de Avaliação': ppg.nomeAreaAvaliacao ?? 'Não informado',
        'Área de Conhecimento': ppg.nomeAreaConhecimento ?? 'Não informado',
        Modalidade: ppg.modalidade ?? 'Não informado',
        Situação: ppg.situacao ?? 'Não informado',
        'Modalidade de Ensino': ppg.nomeModalidadeEnsino ?? 'Não informado',
        'Grau Acadêmico': ppg.grau ?? 'Não informado',
      };
      if (programas[codigo] && JSON.stringify(programas[codigo]) !== JSON.stringify(ficha)) {
        return erro('A CAPES retornou registros conflitantes para o mesmo código. Tente novamente mais tarde.', 502);
      }
      programas[codigo] = ficha;
    }

    if (resultados.length < TAMANHO_PAGINA) break;
    if (page === MAX_PAGINAS - 1) {
      return erro('A consulta CAPES excedeu o limite de páginas. Tente novamente mais tarde.', 502);
    }
  }

  if (Object.keys(programas).length === 0) {
    return erro('A CAPES não retornou programas para a instituição consultada.', 404);
  }

  const fonte = new URL(URL_CAPES);
  fonte.searchParams.set('query', `id-ies:(${idIes})`);
  fonte.searchParams.set('size', String(TAMANHO_PAGINA));
  const catalogo: CatalogoCapes = {
    versao: 2,
    programas,
    fonte: { url: fonte.toString(), idIes, consultadoEm: new Date().toISOString(), totalProgramas: Object.keys(programas).length },
  };
  return new Response(JSON.stringify(catalogo), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // O catálogo muda raramente — 24h de cache, como o ttl=86400 do Streamlit
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
};
