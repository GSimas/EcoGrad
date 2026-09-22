import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useEcoGradStore as store } from '../src/stores/useEcoGradStore';
import { initializeNavigation, navigateBack, navigateForward, navigatePage, navigateVisit, registerPosition, useNavigation, type NavigationPort } from '../src/services/navigation';
import { abaDoEndereco, captureContext, applyContext, CHAVE_ABA_AVANCADA, HISTORY_COUNT, HISTORY_KEY, HISTORY_TTL, pageUrl, paginaCanonica, parsePage, readHistory, ROTA_PADRAO, ROTAS_VISIVEIS, rotaCanonica, rotaVisivel, statePage, trimHistory, type Visit } from '../src/lib/navigation';
import { OBJETIVOS, objetivoPorId } from '../src/lib/objetivos';

function browser(hash = '') {
  const entries = [{ key: undefined as unknown, hash }];
  let index = 0;
  const listeners = new Set<() => void>();
  const data = new Map<string, string>();
  const port: NavigationPort = {
    hash: () => entries[index].hash, key: () => entries[index].key,
    replace: (key, hash) => { entries[index] = { key, hash }; },
    push: (key, hash) => { entries.splice(index + 1); entries.push({ key, hash }); index++; },
    go: (delta) => { if (entries[index + delta]) { index += delta; listeners.forEach((l) => l()); } },
    onPop: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    storage: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } },
  };
  const address = (hash: string) => { entries.splice(index + 1); entries.push({ key: undefined, hash }); index++; listeners.forEach((l) => l()); listeners.forEach((l) => l()); };
  return { port, entries, data, address };
}
function setup(hash = '') {
  store.setState(store.getInitialState(), true);
  store.setState({ apresentacaoVista: true, dadosCarregados: true, baseVersion: 'v1', docs: [{ titulo: 'documento' }] as never });
  const b = browser(hash);
  const stop = initializeNavigation(b.port);
  return { ...b, stop };
}
test('URLs contain only whitelisted pages; unknown and injected URLs resolve safely', () => {
  assert.equal(parsePage('#/avancada'), 'avancada');
  assert.equal(parsePage('#/busca/'), 'busca');
  assert.equal(parsePage(''), null);
  assert.equal(parsePage('#/busca?rascunho=privado'), 'nao-encontrada');
  assert.equal(parsePage('#/../chat'), 'nao-encontrada');
  assert.equal(pageUrl('busca'), '#/busca');
  // Endereços de antes da fusão das três telas continuam sendo lidos, e cada
  // um resolve para a página que o sucedeu — nunca para "não encontrada".
  for (const antigo of ['exploracao', 'foresight', 'memetica'] as const) {
    assert.equal(parsePage(`#/${antigo}`), antigo);
    assert.equal(paginaCanonica(antigo), 'avancada');
    assert.ok(abaDoEndereco(antigo));
  }
  assert.equal(paginaCanonica('busca'), 'busca');
  assert.equal(abaDoEndereco('busca'), null);
  assert.equal(pageUrl('avancada'), '#/avancada');
});
test('browser back/forward restores entity and filters without resetting documents, chat or work state', () => {
  const b = setup();
  try {
    const docs = store.getState().docs;
    store.getState().setJanelaRecente(4);
    store.getState().navegarPara('Orientador', 'Pessoa A');
    store.setState({ ui: { 'dossie.cumulativo': true }, statusSNA: 'calculando' });
    store.getState().navegarPara('Documento', 'Trabalho B');
    store.getState().setJanelaRecente(7);
    store.getState().setChat({ entrada: 'rascunho mais novo', parcial: 'resposta em curso', streaming: true });
    navigateBack();
    assert.equal(store.getState().buscaTermo, 'Pessoa A');
    assert.equal(store.getState().buscaTipo, 'Orientador');
    assert.equal(store.getState().janelaRecente, 4);
    assert.equal(store.getState().ui['dossie.cumulativo'], true);
    assert.equal(store.getState().chat.entrada, 'rascunho mais novo');
    assert.equal(store.getState().chat.streaming, true);
    assert.equal(store.getState().statusSNA, 'calculando');
    assert.equal(store.getState().docs, docs);
    navigateForward();
    assert.equal(store.getState().buscaTermo, 'Trabalho B');
    assert.equal(store.getState().janelaRecente, 7);
    assert.ok(b.entries.every((e) => !e.hash.includes('Pessoa') && !e.hash.includes('rascunho') && typeof e.key === 'string'));
  } finally { b.stop(); }
});
test('duplicates, typing and progress do not fill history; a new branch replaces Forward', () => {
  const b = setup();
  try {
    navigatePage('avancada'); navigatePage('avancada');
    for (let i = 0; i < 20; i++) store.setState({ mensagemCarregamento: String(i), ui: { 'busca.texto.Documento': `parcial ${i}` } });
    assert.equal(b.entries.length, 2);
    navigatePage('busca'); navigateBack(); navigatePage('dashboard');
    assert.equal(b.entries.length, 3);
    navigateForward();
    assert.equal(useNavigation.getState().page, 'dashboard');
  } finally { b.stop(); }
});
test('reload restores the same history entry and its forward path', () => {
  const b = setup();
  store.getState().navegarPara('Autor', 'Pessoa A');
  navigatePage('avancada'); navigateBack();
  b.stop();
  const stop = initializeNavigation(b.port);
  try {
    assert.equal(store.getState().buscaTermo, 'Pessoa A');
    assert.equal(useNavigation.getState().visits.length, 3);
    navigateForward(); assert.equal(useNavigation.getState().page, 'avancada');
    navigateVisit(useNavigation.getState().visits[0].id);
    assert.equal(useNavigation.getState().page, 'dashboard');
  } finally { stop(); }
});
test('new analysis invalidates old entity history even when native Back reaches it', () => {
  const b = setup();
  try {
    store.getState().navegarPara('Orientador', 'Pessoa antiga');
    navigatePage('avancada');
    store.getState().novaConsulta();
    const analysisId = store.getState().analysisId;
    b.port.go(-1);
    assert.equal(store.getState().analysisId, analysisId);
    assert.equal(store.getState().docs.length, 0);
    assert.equal(store.getState().buscaTermo, null);
    assert.match(useNavigation.getState().notice, /não está mais disponível/);
  } finally { b.stop(); }
});
test('direct links require a base and continue to the requested page after loading', () => {
  store.setState(store.getInitialState(), true);
  const b = browser('#/foresight');
  const stop = initializeNavigation(b.port);
  try {
    // Sem base, o link direto cai na apresentação: é lá que as coleções são buscadas.
    assert.equal(useNavigation.getState().page, 'inicio');
    store.getState().concluirCarregamento([{ titulo: 'Documento' }] as never, { programas: ['Coleção'], cursosTcc: [] }, 'v1');
    // O link antigo do Foresight abre a Análise Avançada na aba temporal, e o
    // endereço passa a ser o atual: ninguém fica com uma URL que não existe.
    assert.equal(useNavigation.getState().page, 'avancada');
    assert.equal(store.getState().ui[CHAVE_ABA_AVANCADA], 'tempo');
    assert.equal(b.port.hash(), '#/avancada');
    assert.equal(store.getState().programasSelecionados[0], 'Coleção');
  } finally { stop(); }
});
test('context excludes live operations, conversation, drafts and base selection', () => {
  const b = setup();
  try {
    store.setState({ ui: { 'ontologia.processando': true, 'selecao.rascunho': 'novo', 'tabs.perfil': 'evolucao' } });
    const c = captureContext(store.getState());
    assert.deepEqual(Object.keys(c.ui), ['tabs.perfil']);
    assert.equal('chat' in c, false); assert.equal('docs' in c, false); assert.equal('programasSelecionados' in c, false);
    assert.equal(applyContext(store.getState(), { ...c, ui: {} }).ui?.['ontologia.processando'], true);
    assert.equal(applyContext(store.getState(), { ...c, ui: {} }).ui?.['selecao.rascunho'], 'novo');
  } finally { b.stop(); }
});
test('expired, corrupt and oversized histories are discarded; storage rejection leaves navigation operational', () => {
  assert.deepEqual(readHistory('{broken'), []);
  assert.deepEqual(readHistory(JSON.stringify({ version: 1, updated: Date.now() - HISTORY_TTL, entries: [{}] })), []);
  const b = setup(); b.stop();
  b.port.storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const stop = initializeNavigation(b.port);
  try {
    navigatePage('avancada'); navigateBack();
    assert.equal(useNavigation.getState().page, 'dashboard');
    assert.match(useNavigation.getState().storageError, /não pôde ser salvo/);
    const visit = useNavigation.getState().visits[0];
    const many: Visit[] = Array.from({ length: HISTORY_COUNT + 5 }, (_, i) => ({ ...visit, id: String(i) }));
    const trimmed = trimHistory(many, String(many.length - 1));
    assert.equal(trimmed.length, HISTORY_COUNT);
    assert.equal(trimmed.at(-1)?.id, String(many.length - 1));
    assert.equal(b.data.has(HISTORY_KEY), false);
  } finally { stop(); }
});

test('scroll and focus belong to each visit and survive reload', () => {
  const b = setup();
  let top = 400;
  const release = registerPosition(() => ({ top, focus: { tag: 'BUTTON', label: '', text: 'Abrir trabalho', ordinal: 0 } }));
  try {
    navigatePage('busca'); top = 900;
    navigatePage('avancada'); top = 0;
    navigateBack();
    assert.equal(useNavigation.getState().restore?.top, 900);
    assert.equal(useNavigation.getState().restore?.focus?.text, 'Abrir trabalho');
    b.stop();
    const stop = initializeNavigation(b.port);
    assert.equal(useNavigation.getState().restore?.top, 900);
    stop();
  } finally { b.stop(); release(); }
});
test('unknown addresses keep the known path and do not duplicate popstate/hashchange events', () => {
  const b = setup();
  try {
    navigatePage('avancada');
    b.address('#/does-not-exist');
    assert.equal(useNavigation.getState().page, 'nao-encontrada');
    assert.equal(useNavigation.getState().visits.length, 3);
    navigateBack();
    assert.equal(useNavigation.getState().page, 'avancada');
    b.stop();
    const stop = initializeNavigation(b.port);
    navigateForward(); assert.equal(useNavigation.getState().page, 'nao-encontrada');
    stop();
  } finally { b.stop(); }
});
test('stored context cannot overwrite actions, conversation or base via unexpected fields', () => {
  const b = setup();
  try {
    const context = { ...captureContext(store.getState()), chat: { entrada: 'antigo' }, docs: [], novaConsulta: 'invalid' };
    const patch = applyContext(store.getState(), context);
    assert.equal('chat' in patch, false);
    assert.equal('docs' in patch, false);
    assert.equal('novaConsulta' in patch, false);
  } finally { b.stop(); }
});

test('goal selection and catalog search preserve history, drafts, live activity and documents', () => {
  const b = setup('#/foresight');
  try {
    const docs = store.getState().docs;
    store.getState().setChat({ entrada: 'rascunho privado', streaming: true, parcial: 'em andamento' });
    store.setState({ statusSNA: 'calculando' });
    const before = b.entries.length;
    store.setState({ ui: { 'entrada.objetivo': 'trabalhos', 'selecao.busca.ppg': 'Odontologia', 'selecao.rascunho': { programas: ['A', 'B'], cursosTcc: [] }, 'tutorial.passo': 3 } });
    assert.equal(b.entries.length, before);
    navigatePage('inicio'); navigatePage('selecao'); navigateBack(); navigateBack();
    assert.equal(store.getState().docs, docs);
    assert.equal(store.getState().statusSNA, 'calculando');
    assert.equal(store.getState().chat.entrada, 'rascunho privado');
    assert.equal(store.getState().chat.streaming, true);
    assert.equal(store.getState().ui['entrada.objetivo'], 'trabalhos');
    assert.equal(store.getState().ui['selecao.busca.ppg'], 'Odontologia');
    assert.equal(store.getState().ui['tutorial.passo'], 3);
  } finally { b.stop(); }
});
test('an explicit direct link takes precedence over the loading goal', () => {
  store.setState(store.getInitialState(), true);
  const b = browser('#/memetica');
  const stop = initializeNavigation(b.port);
  try {
    store.getState().concluirCarregamento([{ titulo: 'X' }] as never, { programas: ['A'], cursosTcc: [] }, 'v1', 'trabalhos');
    assert.equal(useNavigation.getState().page, 'avancada');
    assert.equal(store.getState().ui[CHAVE_ABA_AVANCADA], 'temas');
    assert.equal(b.port.hash(), '#/avancada');
  } finally { stop(); }
});

test('dashboard filters and exact document identity survive back, forward and reload with duplicate titles', () => {
  const b = setup('#/dashboard');
  try {
    const docs = [
      { titulo: 'Título repetido', programa_origem: 'Coleção A', url: 'https://example.org/a' },
      { titulo: 'Título repetido', programa_origem: 'Coleção B', url: 'https://example.org/b' },
    ] as never;
    store.setState({ docs, ui: { 'dashboard.trabalhos.filtro': { busca: 'repetido', colecao: 'Coleção A', comResumo: true }, 'dashboard.trabalhos.pagina': 2, 'dashboard.comparacao.periodo': 'comum' }, statusSNA: 'calculando' });
    store.getState().setChat({ entrada: 'mensagem preservada', streaming: true });
    store.getState().navegarDocumento(0);
    store.getState().navegarDocumento(1);
    assert.equal(b.entries.length, 3);
    assert.equal(b.port.hash(), '#/busca');
    navigateBack();
    assert.equal((store.getState().ui['dossie.documento'] as { indice: number }).indice, 0);
    navigateBack();
    assert.equal(store.getState().rota, 'dashboard');
    assert.equal(store.getState().ui['dashboard.comparacao.periodo'], 'comum');
    assert.equal(store.getState().ui['dashboard.trabalhos.pagina'], 2);
    assert.equal(store.getState().docs, docs);
    assert.equal(store.getState().statusSNA, 'calculando');
    assert.equal(store.getState().chat.entrada, 'mensagem preservada');
    b.stop(); const stop = initializeNavigation(b.port);
    navigateForward(); navigateForward();
    assert.equal((store.getState().ui['dossie.documento'] as { indice: number }).indice, 1);
    assert.equal(store.getState().chat.streaming, true);
    stop();
  } finally { b.stop(); }
});

test('table query, chart view and network camera survive traversal without rewinding live work', () => {
  const b=setup();
  try {
    const ui={'tabela.Radar':{busca:'água',coluna:'Total',direcao:'desc',pagina:2},'grafico.Radar':'tabela','rede.orbita.camera':{zoom:2,x:12,y:30}};
    store.setState({ui,statusSNA:'calculando'});
    navigatePage('avancada');
    store.getState().setChat({entrada:'Texto atual',parcial:'Resposta parcial'});
    navigateBack();
    assert.deepEqual(store.getState().ui,ui);
    assert.equal(store.getState().chat.entrada,'Texto atual');
    assert.equal(store.getState().statusSNA,'calculando');
    assert.equal(b.entries[0].hash,'#/dashboard');
    const parsed=readHistory(b.data.get(HISTORY_KEY)??null);
    assert.ok(parsed.some((v)=>v.context.ui['rede.orbita.camera']));
  } finally {b.stop();}
});

test('so as paginas visiveis chegam ao menu, aos objetivos e a restauracao da sessao', () => {
  // As cinco páginas de análise estão abertas. A lista continua sendo o único
  // interruptor: tirar uma rota daqui a esconde do menu, dos objetivos, da URL
  // e da restauração da sessão de uma vez só.
  assert.deepEqual([...ROTAS_VISIVEIS], ['dashboard', 'busca', 'avancada']);
  for (const rota of ROTAS_VISIVEIS) assert.equal(rotaVisivel(rota), true);
  assert.equal(rotaVisivel('inicio'), false);
  assert.equal(rotaVisivel('pagina-inventada'), false);

  // Nenhum objetivo oferecido pode levar a uma página que não abre.
  assert.ok(OBJETIVOS.length > 0);
  for (const o of OBJETIVOS) assert.ok(rotaVisivel(o.rota), `objetivo "${o.id}" aponta para ${o.rota}`);
  // Id desconhecido continua caindo num objetivo utilizável.
  assert.ok(rotaVisivel(objetivoPorId('nao-existe').rota));

  // Toda rota visível é restaurada como está; uma rota fora da lista cai no padrão.
  const base = { apresentacaoVista: true, dadosCarregados: true } as Parameters<typeof statePage>[0];
  for (const rota of ROTAS_VISIVEIS) assert.equal(statePage({ ...base, rota }), rota);
  // Sessão guardada antes da fusão abre a página que sucedeu a rota dela.
  for (const antiga of ['exploracao', 'foresight', 'memetica']) {
    assert.equal(statePage({ ...base, rota: antiga as typeof base.rota }), 'avancada');
    assert.equal(rotaCanonica(antiga), 'avancada');
  }
  assert.equal(statePage({ ...base, rota: 'rota-inventada' as typeof base.rota }), ROTA_PADRAO);
  assert.equal(rotaCanonica('rota-inventada'), ROTA_PADRAO);
});
