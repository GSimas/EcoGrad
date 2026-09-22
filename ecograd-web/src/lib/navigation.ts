import type { EcoGradState } from '../stores/useEcoGradStore';
import type { Rota } from '../types';
export const PAGES = ['inicio', 'selecao', 'dashboard', 'busca', 'avancada', 'exploracao', 'foresight', 'memetica'] as const;
export type Page = typeof PAGES[number] | 'nao-encontrada';
export const PAGE_LABELS: Record<Page, string> = { inicio: 'Início', selecao: 'Seleção de coleções', dashboard: 'Dashboard', busca: 'Motor de Busca', avancada: 'Análise Avançada', exploracao: 'Análise Avançada', foresight: 'Análise Avançada', memetica: 'Análise Avançada', 'nao-encontrada': 'Página não encontrada' };
export const HISTORY_KEY = 'ecograd-navigation-v1';
export const HISTORY_LIMIT = 256 * 1024;
export const HISTORY_COUNT = 60;
export const HISTORY_TTL = 24 * 60 * 60 * 1000;
export const analysisPage = (page: Page): page is Rota => ['dashboard', 'busca', 'avancada'].includes(page);

/**
 * As páginas que o EcoGrad oferece agora.
 *
 * A lista continua existindo porque esconder de verdade é mais do que tirar do
 * menu: uma sessão antiga guarda a rota, e um endereço antigo continua sendo
 * digitável. Por isso `rotaVisivel` guarda também a restauração da sessão e a
 * leitura da URL — tirar uma rota daqui basta para escondê-la inteira, e
 * devolvê-la à lista basta para trazê-la de volta.
 */
export const ROTAS_VISIVEIS: readonly Rota[] = ['dashboard', 'busca', 'avancada'];
export const rotaVisivel = (rota: string): rota is Rota => (ROTAS_VISIVEIS as readonly string[]).includes(rota);
/** Para onde vai quem chega numa página escondida, por sessão antiga ou por URL. */
export const ROTA_PADRAO: Rota = 'dashboard';

/** As abas da Análise Avançada, na ordem em que aparecem. */
export const ABAS_AVANCADA = ['temas', 'tempo', 'rede', 'dados'] as const;
export type AbaAvancada = typeof ABAS_AVANCADA[number];
export const ROTULOS_ABA: Record<AbaAvancada, string> = {
  temas: 'Temas e conceitos',
  tempo: 'Tempo e tendências',
  rede: 'Estrutura da rede',
  dados: 'Especialização e dados',
};
/**
 * Onde a aba escolhida é guardada. O prefixo `tabs.` já a inclui no contexto
 * que o histórico captura, então voltar e avançar recuperam a aba junto com o
 * resto da vista — sem que ela precise aparecer na URL.
 */
export const CHAVE_ABA_AVANCADA = 'tabs.avancada';

/**
 * Endereços de antes de as três telas de análise virarem abas de uma só.
 *
 * Continuam abrindo: sessões guardadas no navegador e links compartilhados
 * dependem disso, e mandar alguém para "página não encontrada" por causa de uma
 * reorganização nossa seria um defeito. Cada um leva à aba que hoje guarda o
 * conteúdo que ele prometia.
 */
export const ROTAS_APOSENTADAS: Record<string, AbaAvancada> = {
  exploracao: 'temas',
  foresight: 'tempo',
  memetica: 'temas',
};
/** Aba pedida por um endereço aposentado, ou `null` se o endereço é atual. */
export const abaDoEndereco = (page: string): AbaAvancada | null => ROTAS_APOSENTADAS[page] ?? null;
/** Nome público da página: um endereço aposentado vira a página que o sucedeu. */
export const paginaCanonica = (page: Page): Page => (page in ROTAS_APOSENTADAS ? 'avancada' : page);
/** Rota utilizável a partir do que a sessão guardou, por mais antigo que seja. */
export const rotaCanonica = (rota: string): Rota =>
  rotaVisivel(rota) ? rota : rota in ROTAS_APOSENTADAS ? 'avancada' : ROTA_PADRAO;
/** Only fixed, public page names can enter a URL. No entity, draft, collection or search query. */
export const pageUrl = (page: Page) => `#/${page === 'nao-encontrada' ? 'pagina-nao-encontrada' : page}`;
export function parsePage(hash: string): Page | null {
  if (!hash || hash === '#') return null;
  const value = hash.replace(/^#\//, '').replace(/\/$/, '');
  return (PAGES as readonly string[]).includes(value) && hash.startsWith('#/') ? value as Page : 'nao-encontrada';
}
/** Sem base carregada o lugar é a apresentação: é lá que as coleções são escolhidas. */
export function statePage(s: EcoGradState): Page {
  if (!s.apresentacaoVista || !s.dadosCarregados) return 'inicio';
  // A sessão guardada pode apontar para uma página aposentada ou escondida.
  return rotaCanonica(s.rota);
}
export const contextualKey = (key: string) => /^(tabela\.|grafico\.|rede\.|tabs\.|expander\.|dossie\.|orbita\.|capes\.|memes\.|dashboard\.|busca\.texto\.)/.test(key);
export type ViewContext = Pick<EcoGradState, 'buscaTipo' | 'buscaTermo' | 'tipoForesight' | 'janelaRecente' | 'metodoCorte' | 'percentilCorte' | 'usarBootstrap' | 'fonteMemes' | 'minCoocorrencia'> & { ui: Record<string, unknown> };
export function captureContext(s: EcoGradState): ViewContext {
  const { buscaTipo, buscaTermo, tipoForesight, janelaRecente, metodoCorte, percentilCorte, usarBootstrap, fonteMemes, minCoocorrencia } = s;
  return { buscaTipo, buscaTermo, tipoForesight, janelaRecente, metodoCorte, percentilCorte, usarBootstrap, fonteMemes, minCoocorrencia,
    ui: Object.fromEntries(Object.entries(s.ui).filter(([key]) => contextualKey(key))) };
}
/** Restore view settings without rewinding drafts, chat, documents, tasks or ontology progress. */
export function applyContext(s: EcoGradState, c: ViewContext): Partial<EcoGradState> {
  const safe = captureContext(c as EcoGradState);
  return { ...safe, ui: { ...Object.fromEntries(Object.entries(s.ui).filter(([key]) => !contextualKey(key))), ...safe.ui } };
}
export const identidadeDocumento = (c: { ui: Record<string, unknown> }) => JSON.stringify(c.ui['dossie.documento'] ?? null);
export interface Position { top: number; focus?: { tag: string; label: string; text: string; ordinal: number } }
export interface Visit {
  id: string; page: Page; analysisId: string; baseVersion: string;
  context: ViewContext; position: Position;
}
export function visitLabel(v: Visit) {
  const ref = v.context.ui['dossie.documento'] as { origem?: string } | undefined;
  return v.page === 'busca' && v.context.buscaTermo !== null
    ? `${v.context.buscaTipo}: ${v.context.buscaTermo || 'Sem título'}${v.context.buscaTipo === 'Documento' && typeof ref?.origem === 'string' ? ` · ${ref.origem}` : ''}`
    : v.page === 'busca' ? `Motor de Busca · ${v.context.buscaTipo}` : PAGE_LABELS[v.page];
}
export function compatible(v: Visit, s: EcoGradState) { return v.analysisId === s.analysisId && v.baseVersion === s.baseVersion; }
export function trimHistory(entries: Visit[], currentId: string): Visit[] {
  let result = entries.slice();
  while ((result.length > HISTORY_COUNT || JSON.stringify(result).length * 2 > HISTORY_LIMIT - 1024) && result.length > 1) {
    if (result[0].id === currentId) result.pop(); else result.shift();
  }
  return result;
}
export function readHistory(raw: string | null): Visit[] {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (data?.version !== 1 || !Number.isFinite(data.updated) || Date.now() - data.updated >= HISTORY_TTL || data.updated > Date.now() + 60000
      || !Array.isArray(data.entries) || data.entries.length > HISTORY_COUNT || (raw?.length ?? 0) * 2 > HISTORY_LIMIT) return [];
    return data.entries.filter((v: Visit) => {
      const c = v?.context;
      return typeof v?.id === 'string' && [...PAGES, 'nao-encontrada'].includes(v.page)
        && typeof v.analysisId === 'string' && typeof v.baseVersion === 'string'
        && Number.isFinite(v.position?.top) && v.position.top >= 0
        && c && ['Documento', 'Pessoa', 'Autor', 'Orientador', 'Co-orientador', 'Palavra-chave', 'Macrotema'].includes(c.buscaTipo)
        && (c.buscaTermo === null || typeof c.buscaTermo === 'string')
        && ['Palavra-chave', 'Macrotema', 'Artefatos (Ontologia IA)'].includes(c.tipoForesight)
        && ['Percentil fixo', 'K-Means adaptativo (4 clusters)'].includes(c.metodoCorte)
        && ['Palavras-chave', 'Artefatos Extraídos'].includes(c.fonteMemes) && typeof c.usarBootstrap === 'boolean'
        && [c.janelaRecente, c.percentilCorte, c.minCoocorrencia].every(Number.isFinite)
        && c.ui && typeof c.ui === 'object' && !Array.isArray(c.ui) && Object.keys(c.ui).every(contextualKey);
    });
  } catch { return []; }
}
