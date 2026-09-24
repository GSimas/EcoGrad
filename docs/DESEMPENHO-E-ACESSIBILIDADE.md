# Desempenho e acessibilidade — auditoria de 24/09/2026

**Escopo:** o app web (`ecograd-web`), em quatro frentes — Core Web Vitals, WCAG 2.1 AA, renderização e memória, resiliência. **Restrição:** nenhuma mudança de identidade visual, de regra de negócio ou de contrato de dados. O que exigiria uma delas não foi feito e está em [Pendências para decisão](#pendências-para-decisão).

## Como medir

Tudo roda a partir de `ecograd-web/` e é repetível:

| Comando | O que mede |
| --- | --- |
| `ANALYZE=1 npm run build` | O build de sempre, mais o mapa do bundle em `bundle-report/` (treemap e JSON) |
| `npm run medir:bundle` | JS e CSS iniciais (bruto, gzip, brotli), chunks sob demanda e workers, a partir do `dist/index.html` |
| `npm run medir:desempenho` | Chrome real (`puppeteer-core`), CPU 4× e, na carga fria, 4G lento: FCP, LCP, CLS, TBT, INP, tarefas longas com atribuição por script (Long Animation Frames), quadros por segundo da carga da coleção ao fim do SNA, heap da página e dos workers e axe-core (WCAG 2.1 A/AA) em sete estados da interface |
| `npm run lint:a11y` | `eslint-plugin-jsx-a11y`, conjunto *strict*, sobre `src/**/*.tsx` |
| `node scripts/comparar-medicoes.mjs` | Tabela antes × depois, com a mediana de várias execuções de cada lado e a marca "≈" onde a diferença cabe na variação entre execuções; `--memoria-*` e `--cpu1-*` somam execuções dedicadas de memória e sem desaceleração |

O `medir:desempenho` serve o `dist/` como a Netlify serve (Brotli/gzip nos textos, `.json.gz` sem recodificar, fallback de SPA) e percorre o fluxo de um usuário: apresentação, busca no acervo, carga da maior coleção (PPG em Engenharia de Produção, 4.384 documentos), cálculo da rede, navegação entre páginas e abas, dossiê de pessoa e cinco ciclos de abrir e fechar janelas com gráficos. Opções: `--cpu`, `--rodadas`, `--cenarios`, `--dist` (outro build, para A/B), `--base` (servidor já rodando), `--perfil` (perfil de CPU da main thread por janela — contra o servidor de dev, os nomes de função chegam legíveis), `--heap` (heap da página por tipo, por construtor e as maiores strings) e `--ciclos` (com mais de 5, o heap acumulado a cada ciclo). O heap dos workers é lido depois de uma coleta de lixo em cada um.

O A/B abaixo compara o commit `0f9084f`, construído num *worktree*, com esta versão, em execuções intercaladas na mesma máquina. Cada número é a mediana entre as execuções.

## O que a medição mostrou

A linha de base, antes de qualquer mudança:

- **O JS inicial carregava o app inteiro.** 1.098 KB (345 KB gzip) em três arquivos: as três páginas de análise, o chat, o relatório, o panorama, o `graphology` com o Louvain e o `pako`. Os dois últimos só são usados de verdade nos workers; chegavam ao bundle inicial por acoplamento de módulos (`foresight-math` misturava funções puras com as de grafo; `collection-loader` importava o `pako` no topo).
- **Focar a busca da apresentação travava a página por segundos.** O catálogo de ~5 MB era descomprimido, lido e normalizado (NFD de ~250 mil nomes) na main thread: tarefa única de 1,6 s e TBT de 3 s a CPU 4×. Digitar varria os 250 mil nomes a cada tecla: INP de 920 ms.
- **O checkpoint da sessão serializava a base inteira na main thread** — ao carregar a coleção e de novo quando o SNA terminava —, e a gravação no IndexedDB lia de volta todas as sessões guardadas, com textos de dezenas de MB, só para decidir o despejo: mais de 1,5 s bloqueados enquanto o worker de SNA calculava.
- **O fundo animado ocupava 43% da main thread com a tela parada**, e o carrossel de indicadores forçava um layout por cartão a cada quadro da rotação automática.
- **Voltar a uma página refazia tudo.** Índices, contagens, resumos e o catálogo do Motor de Busca viviam em `useMemo` por instância: cada montagem recalculava, e o catálogo ainda era ordenado duas vezes. Clicar em Motor de Busca custava 592 ms de INP.
- **A lateral assinava o store inteiro** e renderizava a cada tecla, trecho de resposta da IA e progresso de cálculo.
- **Memória sem vazamento.** Janelas com gráficos e WebGL não deixavam canvas órfão, e 15 ciclos de abrir e fechar acumulavam ~4,7 MB que se estabilizam (caches internos das bibliotecas de gráfico). O maior item do heap era o catálogo da busca, ~34 MB, guardado na página para sempre depois do primeiro uso (`gcTime: Infinity`).
- **Acessibilidade já estava bem encaminhada:** o axe achou uma regra (contraste dos cartões desfocados do carrossel) e uma boa prática (ordem de títulos). O lint *strict* apontou 25 ocorrências, a maioria padrões corretos do ARIA APG que o conjunto não distingue; as reais eram rótulos sem associação programática, `autoFocus`, e o chat — o texto em streaming não era anunciado a leitores de tela, e a síntese citada, que já tinha `aria-live`, era relida a cada trecho.

## O que mudou

**Main thread.** O catálogo da busca passou para o `busca.worker`: download, descompressão, normalização e cada consulta acontecem lá, com varredura incremental enquanto se digita. Quem precisa do índice inteiro na página (conversa, dossiê, nuvens) o recebe em lotes de 5 mil itens, cada um numa tarefa curta, já com as chaves normalizadas — mesmo tipo `IndiceBusca`, mesmos resultados. O checkpoint da sessão reaproveita o JSON dos objetos que não mudaram, serializa o resto em fatias de 8 ms e grava pelo `sessao.worker` a mesma transação do IndexedDB; o texto gravado é idêntico byte a byte (há teste). O texto leve da sessão e o histórico de navegação deixaram de ser regravados a cada tecla: vão juntos no máximo a cada 150 ms, e sair da aba, escondê-la ou navegar grava na hora. O fundo animado desenha num `OffscreenCanvas` no `fundo.worker`, com o mesmo código de cena (`lib/fundo-cena.ts`); sem esse recurso, o laço na página continua valendo.

**Bundle.** Dashboard, Motor de Busca, Análise Avançada, o painel do UFSCão, a conversa da apresentação e o Panorama UFSC viraram chunks sob demanda (`lib/preguicoso.tsx`). Enquanto uma coleção baixa, o app adianta o Dashboard, o Motor de Busca e o UFSCão; a Análise Avançada vem logo depois que a análise aparece, com a página ociosa. Se o chunk já chegou, a página monta sem passar pelo fallback. O `graphology` e o Louvain saíram do bundle inicial (`foresight-grafo.ts` e `memes-documento.ts` separam o que monta grafo do que é puro), o `pako` virou fallback do `DecompressionStream` nativo, e o relatório, as ações de IA e a configuração do provedor deixaram de arrastar módulos pesados.

**Renderização e memória.** Índices, contagens, resumos, relações, perfis de similaridade, grafo histórico e o catálogo do Motor de Busca são calculados uma vez por base e compartilhados (cache por identidade do array de documentos, que nunca é alterado no lugar). O catálogo padrão do Motor de Busca é montado em fatias assim que a análise aparece (ordenação estável fatiada — mesmo resultado do `sort`, com teste), e o primeiro clique já o encontra pronto. Os seletores de opção guardam as chaves normalizadas e o conjunto das opções, e só a opção escolhida desenha o ícone de marcação — as demais reservam a mesma caixa, em vez de um SVG invisível por opção. A lateral e o histórico usam seletores atômicos; as falas do chat são memoizadas. O carrossel lê todas as posições antes de escrever. O ciclo de vida de canvas e WebGL foi conferido no código das bibliotecas (`echarts-for-react` descarta a instância e o *size-sensor*; o `force-graph` pausa o laço e esvazia o grafo) e medido: nenhum canvas órfão depois de fechar as janelas, e o acúmulo em 15 ciclos é o mesmo da versão anterior.

**Memória.** O catálogo da busca saiu da página e mora no `busca.worker`, junto das chaves normalizadas — que antes eram recalculadas a cada volta à apresentação. As chaves são compactadas depois que a busca já responde: `normalize('NFD')` deixa a chave de um nome acentuado com dois bytes por caractere no V8, e uma volta pelo JSON devolve a mesma chave com um (~6 MB a menos). O checkpoint guarda o JSON de cada objeto uma vez só: o resultado da atividade de SNA é um envelope em volta da mesma rede do store, e guardar o envelope duplicava 2,8 MB. A medição por worker força uma coleta de lixo em cada um antes de ler o heap — um worker ocioso quase não coleta sozinho.

**Acessibilidade.** Rótulos associados por `htmlFor`/`id` ao `Select`; foco explícito ao abrir o UFSCão, em vez de `autoFocus` — na caixa de mensagem ou, sem provedor configurado, no primeiro controle da configuração (antes o foco ficava fora do diálogo nesse caso) — e sem roubar o foco quando a sessão é restaurada com o painel aberto; a resposta do UFSCão é anunciada inteira, uma vez, quando termina (`AnuncioDeResposta`), e a síntese citada fica `aria-busy` enquanto é escrita; o fim ou a falha de cada atividade de fundo é anunciado (`AvisosDeAtividade`); as redes interativas dizem quantos nós e conexões mostram; um `h2` só para leitores de tela corrige a ordem de títulos do Dashboard sem mexer no tamanho da fonte do celular. O lint usa o conjunto *strict*; onde ele não distingue um padrão do ARIA APG (listbox em `ul`/`li`, `Escape` num diálogo não modal, região rolável focável) valem as opções do próprio conjunto *recommended* do plugin ou uma exceção local justificada no código.

**Resiliência e entrega.** `LimiteDeErro` isola páginas, o UFSCão, a conversa da apresentação, o Panorama, cada janela de bloco e cada gráfico ou rede: a falha vira um aviso com "Tentar novamente" (e "Recarregar a página" quando o que falhou foi o download de um chunk), e o resto do app segue. O `netlify.toml` passou a mandar `X-Frame-Options: DENY`; `nosniff`, `Referrer-Policy` e o cache imutável de `/assets/*` já existiam, e a compressão Brotli/gzip é automática na Netlify (conferida no site publicado).

## Resultado

Execuções intercaladas — antes, depois, antes, depois — na mesma janela de tempo, com CPU 4× e, na carga fria, 4G lento. Cada número é a mediana; "≈" marca a diferença que cabe na variação entre execuções do mesmo build. A memória vem de execuções dedicadas de 15 ciclos, com coleta de lixo na página e em cada worker antes de ler o heap.

| Métrica | Antes | Depois | Ganho / Delta |
| :--- | ---: | ---: | :--- |
| **Bundle de produção** | | | |
| JS inicial (bruto) | 1097.9 KB | 517.2 KB | -52,9% ✅ |
| JS inicial (gzip) | 345.1 KB | 169.2 KB | -51,0% ✅ |
| JS inicial (brotli) | 280.7 KB | 144.8 KB | -48,4% ✅ |
| Chunks sob demanda (lazy) | 10 | 45 | +350,0% ✅ |
| Workers | 2 | 5 | +150,0% ✅ |
| **Carga fria (4G lento + CPU 4×, mediana de todas as rodadas)** | | | |
| JS transferido na carga | 281.5 KB | 145.3 KB | -48,4% ✅ |
| FCP | 2.746 ms | 2.106 ms | -23,3% ✅ |
| LCP | 2.746 ms | 2.106 ms | -23,3% ✅ |
| TBT (desde a navegação) | 689 ms | 742 ms | +7,8% ≈ |
| CLS | 0,0008 | 0,0008 | 0,0000 (limite "bom": 0,1) ≈ |
| Main thread ocupada com a tela parada | 52,8% | 7,9% | -85,1% ✅ |
| **Busca na apresentação (CPU 4×)** | | | |
| Preparo do índice: até a busca responder | 5.485 ms | 1.483 ms | -73,0% ✅ |
| Preparo do índice: TBT | 3.431 ms | 35 ms | -99,0% ✅ |
| Preparo do índice: maior tarefa | 1.767 ms | 85 ms | -95,2% ✅ |
| Digitação: INP | 1.124 ms | 108 ms | -90,4% ✅ |
| Digitação: TBT | 4.632 ms | 70 ms | -98,5% ✅ |
| **Coleção grande (4.384 documentos, CPU 4×)** | | | |
| Clique em Carregar → Dashboard | 3.965 ms | 3.603 ms | -9,1% ≈ |
| Clique em Carregar → rede calculada e página ociosa | 10.484 ms | 9.495 ms | -9,4% ≈ |
| Nesse intervalo: TBT | 5.848 ms | 2.702 ms | -53,8% ✅ |
| Nesse intervalo: maior tarefa | 1.867 ms | 1.608 ms | -13,9% ≈ |
| Nesse intervalo: FPS | 18,8 | 26,0 | +38,5% ✅ |
| Nesse intervalo: quadros > 50 ms | 18 | 25 | +36,1% ≈ |
| Nesse intervalo: maior intervalo entre quadros | 2.067 ms | 1.809 ms | -12,5% ≈ |
| **Coleção grande sem desaceleração (CPU 1×)** | | | |
| Clique em Carregar → Dashboard | 886 ms | 678 ms | -23,5% ≈ |
| Clique em Carregar → rede calculada e página ociosa | 6.076 ms | 4.130 ms | -32,0% ✅ |
| Nesse intervalo: TBT | 1.010 ms | 242 ms | -76,1% ✅ |
| Nesse intervalo: maior tarefa | 335 ms | 249 ms | -25,7% ≈ |
| Nesse intervalo: FPS | 45,9 | 48,9 | +6,6% ≈ |
| Nesse intervalo: quadros > 50 ms | 9 | 7 | -23,5% ≈ |
| Nesse intervalo: maior intervalo entre quadros | 350 ms | 267 ms | -23,9% ≈ |
| **Interações (INP, CPU 4×)** | | | |
| Sidebar → Motor de Busca | 872 ms | 320 ms | -63,3% ✅ |
| Sidebar → Análise Avançada | 224 ms | 232 ms | +3,6% ≈ |
| Aba → Tempo e tendências | 144 ms | 124 ms | -13,9% ✅ |
| Aba → Estrutura da rede | 136 ms | 220 ms | +61,8% ≈ |
| Aba → Especialização e dados | 120 ms | 132 ms | +10,0% ≈ |
| Aba → Temas e conceitos | 112 ms | 92 ms | -17,9% ≈ |
| Sidebar → Dashboard | 1.004 ms | 556 ms | -44,6% ✅ |
| Pior INP da navegação | 1.004 ms | 556 ms | -44,6% ✅ |
| Digitação no Motor de Busca: INP | 604 ms | 296 ms | -51,0% ✅ |
| Digitação no Motor de Busca: TBT | 1.645 ms | 575 ms | -65,0% ✅ |
| Abrir dossiê de pessoa: INP | 612 ms | 316 ms | -48,4% ✅ |
| **Memória (15 ciclos abrir/fechar janela com gráficos, heap pós-coleta)** | | | |
| Heap da página após a jornada | 53,2 MB | 43,8 MB | -9,4 MB |
| Heap dos workers no mesmo ponto | 0,0 MB | 51,9 MB | +51,9 MB |
| Heap total (página + workers) | 53,2 MB | 95,6 MB | +42,4 MB |
| Destaques: crescimento do heap da página | 4,73 MB | 4,09 MB | -0,6 MB |
| Espaço 3D (WebGL): crescimento do heap da página | 2,89 MB | 2,80 MB | -0,1 MB |
| Canvases órfãos após fechar | 0 | 0 | = |
| **Acessibilidade** | | | |
| axe WCAG 2.1 A/AA: regras violadas | 1 | 1 | 0,0% ≈ |
| axe WCAG 2.1 A/AA: nós afetados (7 estados) | 7 | 7 | +7,7% ≈ |
| axe boas práticas: nós afetados | 1 | 0 | -100,0% ✅ |
| ESLint jsx-a11y (strict) | 25 | 0 | -100,0% ✅ |

≈ diferença dentro da variação entre execuções do mesmo build (Mann-Whitney, p > 0,05, com 5 ou mais amostras de cada lado; com menos, distância entre medianas menor que a amplitude de um dos lados).

**Como ler.**

- **Busca da apresentação.** Fica pronta em 1,5 s em vez de 5,5 s, e digitar custa 108 ms de INP em vez de 1,1 s. Focar a busca não trava mais a página (TBT de 3,4 s para 35 ms).
- **Carga de uma coleção grande.** Do clique em "Carregar" até a rede calculada, a main thread fica bloqueada 2,7 s em vez de 5,8 s. O que resta é uma tarefa de 1,2 a 1,9 s — desserializar os 4.384 documentos e montar o Dashboard no mesmo quadro —, igual à da versão anterior ([pendência 3](#pendências-para-decisão)). A janela "durante o SNA" da linha de base deixou de ser comparável: sem checkpoint síncrono, o cálculo termina antes de o Dashboard ficar ocioso e o custo do fim do SNA cai na janela do carregamento. Por isso a tabela mede as duas juntas.
- **Navegação.** O INP de abrir o Motor de Busca foi de 872 para 320 ms, e o de voltar ao Dashboard de 1.004 para 556 ms. As abas da Análise Avançada, que já respondiam abaixo de 200 ms, ficam na variação.
- **Carga fria.** Metade do JS e FCP 23% mais cedo. O TBT desde a navegação fica na variação: ele é dominado pela avaliação do JS inicial e pela primeira renderização, que custam o mesmo nos dois builds. Com a tela parada, a main thread passa de 53% a 8% ocupada, porque o fundo animado saiu dela.
- **Memória.** Sem vazamento: 15 ciclos de abrir e fechar janelas acumulam o mesmo que antes, estabilizando, e nenhum canvas fica órfão. O total da página com os workers sobe de 53 para 96 MB. O catálogo da busca (34 MB) saiu da página para o worker e lá fica junto das chaves normalizadas (17 MB, já compactadas); o checkpoint guarda o JSON da base e da rede (22 MB). É memória trocada por tempo de resposta; as pendências 7 e 8 dizem como devolvê-la e quanto custa.
- **Acessibilidade.** O lint *strict* foi de 25 ocorrências a 0, e a boa prática de ordem de títulos foi resolvida. A única regra WCAG que o axe ainda acusa é o contraste do carrossel ([pendência 1](#pendências-para-decisão)); o número de nós varia com a posição do carrossel no momento da auditoria.
- **Outra janela, mesma ordem de grandeza.** Numa janela mais quieta da máquina (rodadas 4 e 5, com as mesmas mudanças na main thread), a busca ficou pronta em 1,2 s (era 4,6 s), a digitação caiu de 940 para 108 ms de INP, o TBT do clique à rede de 4,1 para 2,1 s, o Motor de Busca de 692 para 140 ms e o Dashboard de 892 para 324 ms.

## Pendências para decisão

Nada aqui foi aplicado: cada item mudaria algo que a auditoria não podia mudar sozinha — aparência, comportamento ou um contrato de dados.

1. **Contraste dos cartões afastados do carrossel de indicadores (WCAG 1.4.3).** É a única regra WCAG que o axe ainda acusa: os cartões fora do centro chegam a 35% de opacidade, com desfoque, e o texto fica em 2,59:1. Resolver pede um piso de opacidade (cerca de 0,8) e texto sem desfoque — o efeito de "foco no centro" fica mais sutil. Ganho: zero violações WCAG em todos os estados auditados.
2. **Lista de sugestões do Motor de Busca.** Cada tecla re-renderiza até 300 sugestões; é o custo que sobra ao digitar ali. Virtualizar a lista (montar só as linhas visíveis) mantém a aparência, mas muda o que o leitor de tela percorre e pede `aria-setsize`/`aria-posinset`; reduzir o limite para ~50 mudaria o que dá para rolar. A primeira opção preserva tudo o que o usuário vê.
3. **Carga da coleção em lotes.** A maior tarefa que resta é desserializar os 4.384 documentos e montar o Dashboard no mesmo quadro (~2 s a CPU 4×). Entregar a base em lotes, como o índice da busca já faz, exige mudar o protocolo do worker de dados e das atividades.
4. **Índice de metadados no IndexedDB.** A gravação do checkpoint já não trava a página, mas o worker ainda lê todas as sessões guardadas a cada checkpoint para decidir o despejo. Um índice por `updated` e `bytes` permitiria ler só os metadados; é uma migração de esquema (versão 1 → 2), e uma aba antiga aberta durante a transição deixaria de abrir o banco até recarregar.
5. **`tailwind-merge`** é agora o maior item do JS inicial (~100 KB brutos). Trocar o `cn()` exigiria auditar cada combinação de classes, com risco visual.
6. **`Content-Security-Policy: frame-ancestors 'none'`**, o equivalente moderno do `X-Frame-Options: DENY`. Uma CSP completa pede o inventário de todos os domínios de IA, Supabase e CAPES.
7. **Memória × CPU no checkpoint.** O JSON da base e da rede fica guardado enquanto elas estão carregadas — ~22 MB para 4.384 documentos (19 MB da base, 2,8 MB da rede) — para os checkpoints seguintes não os serializarem de novo. Dispensar o cache devolve essa memória ao custo de serializar a base outra vez, nas mesmas fatias de 8 ms, a cada checkpoint (fim do SNA, da maturidade, de cada atividade).
8. **Liberar o catálogo da busca fora da apresentação.** O `busca.worker` guarda o catálogo (~34 MB de itens e ~17 MB de chaves) enquanto a aba está aberta; a versão anterior guardava os itens na página. Encerrar o worker quando a apresentação sai de cena devolveria ~51 MB durante a análise. O custo é preparar o catálogo de novo — ~1,2 s a CPU 4×, no worker, sem travar a página — ao voltar à busca da apresentação ou ao abrir, pela primeira vez depois disso, um recurso que usa o catálogo inteiro (carregar do acervo no dossiê, citações do UFSCão).
