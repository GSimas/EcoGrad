import { identidadeDocumento } from '../lib/navigation';
import { create } from 'zustand';
import { useEcoGradStore } from '../stores/useEcoGradStore';
import { abaDoEndereco, analysisPage, applyContext, captureContext, CHAVE_ABA_AVANCADA, compatible, HISTORY_KEY, HISTORY_LIMIT, pageUrl, paginaCanonica, parsePage, readHistory, statePage, trimHistory, type AbaAvancada, type Page, type Position, type Visit } from '../lib/navigation';

export interface NavigationPort {
  hash(): string;
  key(): unknown;
  replace(key: string, hash: string): void;
  push(key: string, hash: string): void;
  go(delta: number): void;
  onPop(callback: () => void): () => void;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}
export const useNavigation = create<{ page: Page; current: string; visits: Visit[]; restore: Position | null; revision: number; notice: string; storageError: string }>(() => ({ page: 'inicio', current: '', visits: [], restore: null, revision: 0, notice: '', storageError: '' }));
let readPosition: () => Position = () => ({ top: 0 });
export function registerPosition(reader: () => Position) { readPosition = reader; return () => { readPosition = () => ({ top: 0 }); }; }

/**
 * Suspende a restauração de rolagem enquanto alguém mais precisa mandar nela.
 *
 * Depois de cada navegação o `useNavigationPosition` segura o topo por um
 * segundo e meio, refazendo a rolagem a cada mudança de layout, e só desiste
 * diante de um gesto de verdade — roda, toque, tecla. O tour guiado precisa
 * rolar até o alvo nessa mesma janela, e sem isto perdia a disputa: o destaque
 * ia parar fora da tela. Devolve a função que restabelece o comportamento.
 */
let restauracoesSuspensas = 0;
export function suspenderRestauracaoDeRolagem(): () => void {
  restauracoesSuspensas += 1;
  let solto = false;
  return () => { if (solto) return; solto = true; restauracoesSuspensas -= 1; };
}
export const restauracaoDeRolagemAtiva = () => restauracoesSuspensas === 0;
let changePage: (page: Page) => void = () => {};
let move: (delta: number) => void = () => {};
/** Nenhum chamador consegue empurrar um endereço aposentado para o histórico. */
export const navigatePage = (page: Page) => changePage(paginaCanonica(page));
export const navigateBack = () => move(-1);
export const navigateForward = () => move(1);
export function navigateVisit(id: string) {
  const { visits, current } = useNavigation.getState();
  const from = visits.findIndex((v) => v.id === current), to = visits.findIndex((v) => v.id === id);
  if (from >= 0 && to >= 0) move(to - from);
}
let checkpoint: () => void = () => {};
export const checkpointPosition = () => checkpoint();

/** The browser contains opaque entry IDs; all context is local and bounded. */
export function initializeNavigation(port?: NavigationPort) {
  const browser: NavigationPort = port ?? {
    hash: () => window.location.hash,
    key: () => window.history.state?.ecogradVisit,
    replace: (ecogradVisit, hash) => window.history.replaceState({ ecogradVisit }, '', window.location.pathname + hash),
    push: (ecogradVisit, hash) => window.history.pushState({ ecogradVisit }, '', window.location.pathname + hash),
    go: (delta) => window.history.go(delta),
    onPop: (callback) => { window.addEventListener('popstate', callback); window.addEventListener('hashchange', callback); return () => { window.removeEventListener('popstate', callback); window.removeEventListener('hashchange', callback); }; },
    storage: { getItem: (key) => window.sessionStorage.getItem(key), setItem: (key, value) => window.sessionStorage.setItem(key, value), removeItem: (key) => window.sessionStorage.removeItem(key) },
  };
  if (!port) window.history.scrollRestoration = 'manual';
  let visits: Visit[] = [];
  try { visits = readHistory(browser.storage.getItem(HISTORY_KEY)); } catch { /* optional storage */ }
  let current = '';
  let applying = false;
  let pending: Page | null = null;
  const makeVisit = (page: Page, state = useEcoGradStore.getState()): Visit => ({ id: crypto.randomUUID(), page, analysisId: state.analysisId, baseVersion: state.baseVersion, context: captureContext(state), position: { top: 0 } });
  function persist() {
    visits = trimHistory(visits, current);
    try {
      const raw = JSON.stringify({ version: 1, updated: Date.now(), entries: visits });
      if (raw.length * 2 > HISTORY_LIMIT) throw new Error('Histórico maior que o limite.');
      browser.storage.setItem(HISTORY_KEY, raw);
      useNavigation.setState({ storageError: '' });
    } catch {
      try { browser.storage.removeItem(HISTORY_KEY); } catch { /* unavailable */ }
      useNavigation.setState({ storageError: 'O histórico funciona nesta aba, mas não pôde ser salvo para recarregar.' });
    }
    useNavigation.setState({ visits: [...visits], current });
  }
  function updateCurrent(state = useEcoGradStore.getState(), position = readPosition()) {
    visits = visits.map((v) => v.id === current ? { ...v, context: captureContext(state), position } : v);
  }
  function activate(visit: Visit, restored: boolean, notice = '') {
    current = visit.id;
    let page = visit.page;
    const s = useEcoGradStore.getState();
    if (analysisPage(page) && !s.dadosCarregados) {
      pending = page;
      page = 'inicio';
      notice ||= 'Busque e carregue as coleções para abrir a página solicitada. O link não contém a seleção nem os dados da análise.';
    } else pending = null;
    applying = true;
    try {
      const context = restored && compatible(visit, s) ? applyContext(s, visit.context) : {};
      useEcoGradStore.setState({ ...context, apresentacaoVista: page !== 'inicio', ...(analysisPage(page) ? { rota: page } : {}) });
    } finally { applying = false; }
    useNavigation.setState((n) => ({ page, restore: restored ? visit.position : { top: 0 }, revision: n.revision + 1, notice }));
    persist();
  }
  function push(page: Page, state = useEcoGradStore.getState()) {
    const previous = visits.find((v) => v.id === current);
    // Repeated clicks on the active page/identity do not fill the Back stack.
    if (previous?.page === page && previous.context.buscaTipo === state.buscaTipo && previous.context.buscaTermo === state.buscaTermo && identidadeDocumento(previous.context) === identidadeDocumento(state)) return;
    const index = visits.findIndex((v) => v.id === current);
    visits = index < 0 ? [] : visits.slice(0, index + 1);
    const next = makeVisit(page, state);
    visits.push(next);
    browser.push(next.id, pageUrl(page));
    activate(next, false);
  }
  /**
   * Um endereço aposentado abre a página que o sucedeu, já na aba que guarda o
   * conteúdo prometido. A aba é aplicada antes de a visita nascer, para que ela
   * entre no contexto capturado e sobreviva a voltar e avançar.
   */
  function aplicarAbaDoEndereco(pagina: Page | null): AbaAvancada | null {
    const aba = pagina ? abaDoEndereco(pagina) : null;
    if (aba) useEcoGradStore.setState((s) => ({ ui: { ...s.ui, [CHAVE_ABA_AVANCADA]: aba } }));
    return aba;
  }

  const enderecoInicial = parsePage(browser.hash());
  const abaInicial = aplicarAbaDoEndereco(enderecoInicial);
  const initialPage = enderecoInicial === null ? null : paginaCanonica(enderecoInicial);
  const initial = visits.find((v) => v.id === browser.key() && v.page === initialPage);
  if (initial && compatible(initial, useEcoGradStore.getState())) {
    // O percurso segue o mesmo; só a URL passa a ser a do endereço atual.
    if (abaInicial) browser.replace(initial.id, pageUrl(initial.page));
    activate(initial, true);
  } else {
    const fresh = makeVisit(initialPage ?? statePage(useEcoGradStore.getState()));
    visits = [fresh];
    browser.replace(fresh.id, pageUrl(fresh.page));
    activate(fresh, false, initial ? 'O percurso anterior pertence a outra análise ou versão da base. A análise atual foi mantida.' : '');
  }
  changePage = (page) => { updateCurrent(); push(page); };
  move = (delta) => {
    const index = visits.findIndex((v) => v.id === current);
    if (delta && index >= 0 && visits[index + delta]) { updateCurrent(); persist(); browser.go(delta); }
  };
  checkpoint = () => { updateCurrent(); persist(); };
  const unsubscribe = useEcoGradStore.subscribe((s, before) => {
    if (applying) return;
    if (s.analysisId !== before.analysisId) {
      // Old browser entries may remain, but can never restore a previous collection or result.
      const page = s.dadosCarregados && pending ? pending : statePage(s);
      const next = makeVisit(page, s);
      visits = [next];
      browser.replace(next.id, pageUrl(page));
      activate(next, false);
      return;
    }
    const changedPage = s.rota !== before.rota || s.apresentacaoVista !== before.apresentacaoVista;
    const changedEntity = s.buscaTipo !== before.buscaTipo || s.buscaTermo !== before.buscaTermo || identidadeDocumento(s) !== identidadeDocumento(before);
    if (changedPage || changedEntity) {
      updateCurrent(before);
      push(statePage(s), s);
    } else if (s.ui !== before.ui || s.tipoForesight !== before.tipoForesight || s.janelaRecente !== before.janelaRecente || s.metodoCorte !== before.metodoCorte || s.percentilCorte !== before.percentilCorte || s.usarBootstrap !== before.usarBootstrap || s.fonteMemes !== before.fonteMemes || s.minCoocorrencia !== before.minCoocorrencia) {
      updateCurrent(s); persist();
    }
  });
  const offPop = browser.onPop(() => {
    const endereco = parsePage(browser.hash()) ?? 'inicio';
    const aba = aplicarAbaDoEndereco(endereco);
    const page = paginaCanonica(endereco);
    // Com endereço aposentado o retorno antecipado não serve: a URL ainda
    // precisa ser reescrita, mesmo que a página exibida já seja a certa.
    if (!aba && browser.key() === current && visits.find((v) => v.id === current)?.page === page) return;
    updateCurrent();
    const visit = visits.find((v) => v.id === browser.key() && v.page === page);
    if (visit && compatible(visit, useEcoGradStore.getState())) activate(visit, true);
    else {
      const s = useEcoGradStore.getState();
      const fresh = makeVisit(page, s);
      // An unavailable entity context must not masquerade as the currently selected entity.
      if (page === 'busca') fresh.context.buscaTermo = null;
      const isNewAddress = !browser.key() || browser.key() === current;
      const index = visits.findIndex((v) => v.id === current);
      visits = isNewAddress && index >= 0 ? [...visits.slice(0, index + 1), fresh] : [fresh];
      browser.replace(fresh.id, pageUrl(page));
      activate(fresh, true, isNewAddress ? '' : 'Este ponto do histórico não está mais disponível. A análise atual foi mantida; selecione novamente a entidade se necessário.');
    }
  });
  return () => { unsubscribe(); offPop(); changePage = () => {}; move = () => {}; checkpoint = () => {}; };
}
