# EcoGrad Web

Migração da plataforma **EcoGrad — Ecologia do Conhecimento (UFSC)** de Python/Streamlit para
**React 18 + Vite + TypeScript + Tailwind**, com backend serverless em **Netlify Functions**.

Os motores de redes complexas, foresight e memética foram transcritos do `backend.py`
original. A regressão compara numericamente as métricas e os recortes descritos em
[Paridade](#paridade-com-o-backend-python); não demonstra equivalência para toda base ou execução estocástica.

---

## Início rápido

```bash
cd ecograd-web && npm install
```

Depois, para desenvolvimento com hot-reload:

```bash
npm run dev
```

O script `dev` roda `sync:data` antes do Vite, copiando as bases da raiz do repositório (`base_consolidada_ufsc.json.gz`,
`base_tcc_ufsc.json.gz`, `programas_ufsc.json`, `mapa_colecoes_tcc.json`) para `public/data/`.
A aplicação sobe em <http://localhost:5173>.

> **`npm run dev` sozinho não executa as Netlify Functions.** O Panorama CAPES, a síntese da IA,
> e a extração ontológica ficam indisponíveis (a interface avisa e continua funcionando).
> O UFSCão (consultor de IA) não depende delas: usa a chave de API do próprio usuário (BYOK), direto do
> navegador. Para a aplicação completa, use o comando abaixo.

### Aplicação completa (frontend + funções)

```bash
npm run netlify:dev
```

Isso sobe o Vite e as funções juntos em <http://localhost:8888>, roteando `/api/*` para
`netlify/functions/*`. Antes, defina as variáveis de ambiente em um `.env` na pasta `ecograd-web/`
(veja `.env.example`):

```bash
GEMINI_API_KEY=...
```

> **Não chame `netlify dev` diretamente de dentro de `ecograd-web/`.** A CLI resolve `base`, o
> diretório de funções e o `.env` a partir da raiz do repositório git, e por isso o `netlify.toml`
> fica **na raiz** (com `base = "ecograd-web"`). O script `netlify:dev` cuida disso: ele executa a
> CLI a partir da raiz. Rodando de dentro da pasta, as funções respondem 404 e o `.env` é ignorado.

### Outros comandos

| Comando | O que faz |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` — checagem de tipos sem emitir |
| `npm run test:capes` | Testes do proxy CAPES: catálogo, paginação e tratamento de falhas |
| `npm run build` | Sincroniza dados, checa tipos e gera `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run sync:data` | Só copia as bases para `public/data/` |
| `npm run netlify:dev` | Frontend + funções em <http://localhost:8888> |
| `npm run verify:parity` | Compara os motores TS com o `backend.py` (requer o venv Python) |
| `npm run test:all` | Regressão funcional, contratos, persistência, IA simulada e aparência |
| `npm run report:build` | Mede os arquivos JS iniciais, chunks adiados e bases do último build |

---

## Arquitetura

```text
netlify.toml                    # na RAIZ do repositório, com base = "ecograd-web"
ecograd-web/
├── netlify/functions/
│   ├── lib/gemini.ts           # cliente Gemini (retry exponencial, fallback de modelos)
│   ├── gemini-synthesize.ts    # síntese epistemológica do perfil do PPG
│   ├── gemini-ontology.ts      # extração de teorias/métodos/ferramentas em lote
│   ├── capes-proxy.ts          # proxy da API Sucupira/CAPES (contorna o CORS)
│   └── neo4j-query.ts          # endpoint legado desativado (HTTP 410)
├── public/data/                # bases estáticas (.json.gz sincronizados, fora do git)
├── scripts/
│   ├── sync-data.mjs           # copia as bases da raiz do repositório
│   └── verify-parity.*         # harness de paridade numérica TS ↔ Python
└── src/
    ├── lib/
    │   ├── graph-core.ts       # kernels CSR: Brandes, closeness, clustering, rich-club…
    │   ├── sna-engine.ts       # grafo global, SNA, maturidade, métricas complexas
    │   ├── foresight-math.ts   # momentum, novidade, bootstrap, backtest, grid search
    │   ├── memetics.ts         # fecundidade, mortalidade infantil, longevidade
    │   ├── memetic-network.ts  # rede de coocorrência entre memes (Ecologia SNA)
    │   ├── similarity.ts       # perfis e recomendação por Índice de Jaccard
    │   ├── ql.ts               # Quociente Locacional e Raio-X de Especialização
    │   ├── orbit.ts            # ego-graph com recorte temporal
    │   ├── capes.ts            # cruzamento com a ficha oficial (difflib → TS)
    │   ├── data-loader.ts      # download, descompressão e normalização
    │   ├── stats.ts            # quantis, spearman, linregress, K-Means, RNG semeado
    │   ├── lexicon.ts          # frequências para nuvem e séries históricas
    │   └── markdown.ts         # markdown seguro para as respostas da IA
    ├── workers/
    │   ├── sna.worker.ts       # SNA, maturidade, bootstrap e grid search
    │   └── data.worker.ts      # download + descompressão + filtro das bases
    ├── stores/useEcoGradStore.ts
    └── components/
        ├── layout/                 # Apresentação, tutorial em modal, sidebar, seleção
        └── {dashboard,search-engine,foresight,memetics,chat,ui}/
```

### Fluxo de telas

1. **Apresentação** — o que é o EcoGrad, como funciona e um tutorial de 5 passos
   em modal. Some depois do primeiro "Começar análise" (a sidebar mantém um
   atalho para voltar).
2. **Seleção de coleções** — escolha dos PPGs e cursos, com o Panorama CAPES
   sempre visível.
3. **Análise** — Dashboard, Motor de Busca, Foresight e Memética. O UFSCão, consultor de IA, fica em um botão
   flutuante e usa a chave de API do próprio usuário (OpenAI, Anthropic, Google, OpenRouter e outros).

O painel lateral recolhe para uma faixa de ícones (o estado fica salvo na sessão).

A página de Memética reúne o catálogo ontológico, as métricas de propagação, o gráfico de
longevidade (ano de nascimento × anos de sobrevivência, cor pelo ano da última aparição) e a
**Ecologia Memética (SNA)**: rede de coocorrência entre memes com métricas de redes complexas,
ecologia profunda, grafo interativo e tabela de centralidade global.

Qualquer nome clicável no Dashboard (chips de destaque e as barras dos Top 10)
abre o Motor de Busca já com o dossiê daquela entidade — a rota vive no store,
e por isso `navegarPara` consegue trocar de aba e de entidade num só passo.

### Por que Web Workers

Duas operações inviabilizariam a UI na main thread:

1. **Ingestão** — os `.json.gz` somam 62 MB comprimidos; o `JSON.parse` do conteúdo expandido
   congelaria a página por segundos. O `data.worker` baixa, descomprime e **filtra**, devolvendo
   apenas os documentos da seleção.
2. **Redes complexas** — Brandes, Louvain, bootstrap e a varredura de 108 combinações do Grid
   Search levam de segundos a minutos. O `sna.worker` executa tudo e reporta progresso real.

### Aproximações em redes grandes

O `backend.py` já aproximava o betweenness acima de 1500 nós
(`k = min(250, max(50, √n · 4))`); isso foi transcrito literalmente. O mesmo princípio foi
**estendido** às demais métricas O(n·m), porque a rede completa da UFSC passa de 100 mil nós:

| Métrica | Exato até | Acima disso |
| --- | --- | --- |
| Betweenness | 1 500 nós | `k` pivôs (fórmula do Python) |
| Closeness | 4 000 nós | 256 pivôs (estimador de Eppstein-Wang) |
| Eficiência global | 4 000 nós | 256 pivôs |
| Constraint de Burt | 5 000 nós | amostra determinística de 5 000 nós |
| Degree, clustering, Louvain, assortatividade, rich-club, γ | — | sempre exatos |

Abaixo dos limiares o resultado é **idêntico ao NetworkX**, bit a bit.

---

## Paridade com o backend Python

`npm run verify:parity` roda os dois motores sobre a mesma base (`base_ppgegc.json`) e compara
os resultados numericamente. Requer o venv do projeto Python em `../.venv` (ou `PYTHON=...`).

Cobertura da verificação:

- **Topologia** (150 docs, cálculo exato nos dois lados): degree, betweenness, closeness e
  clustering para 400 nós — diferença relativa máxima de `2e-16` (limite do ponto flutuante).
- **Métricas complexas**: densidade, eficiência global, entropia da distribuição de graus,
  clustering médio, PageRank, centralidade de autovetor, constraint de Burt, grau médio e desvio.
- **Maturidade**: assortatividade, rich-club, γ por regressão log-log e γ pelo estimador MLE.
- **Radar de Foresight**: os 43 termos, com Total, Aparições Recentes, Tração, Momentum e
  Novidade — todos com diferença exatamente zero.
- **Backtest histórico**: as 89 linhas, a distribuição por quadrante e os oito vereditos.
- **Memética**: total de memes, mortalidade, sobreviventes, longevidade e tempo de meia-vida.
- **Rede de coocorrência (densa)**: rich-club por grau (todos os 153 valores), clustering
  ponderado e simples, assortatividade e γ. Este caso existe porque o grafo estrutural tem
  rich-club 0 e mascarava erros — foi assim que se descobriu que a varredura do rich-club
  ordenava as arestas pelo maior grau em vez do menor, produzindo coeficientes acima de 1.
- **Quociente Locacional**: as 95 entidades não vazias do perfil de referência são exigidas nos dois motores antes de comparar QL e total; não se limita a um prefixo de 40 linhas. **Similaridade de Jaccard**: mesmos professores no recorte verificado.

Limites e diferenças conhecidos:

- **Louvain** é estocástico e os RNGs diferem. Modularidade e número de comunidades são apenas informados (nesta rodada, 0,523/29 no NetworkX e 0,534/26 no graphology). Não há asserção de igualdade nem demonstração de qualidade equivalente das partições.
- **Empates de contagem** na memética: o `sort_values` do pandas usa quicksort (instável), então
  a ordem entre memes com a mesma fecundidade é arbitrária. O TS desempata por nome, o que torna
  o Top-N reprodutível.

### Divergências deliberadas

- `_extrair_entidades_por_tipo` para Macrotema devolve string vazia quando o documento não tem
  macrotema (fiel ao `.get(chave, default)` do Python, que só usa o default se a **chave** não
  existir). O QL continua contabilizando essa entidade, mas ela é omitida da tabela — nenhum
  outro valor de QL muda.
- `normalizarNivel` mapeia `TCC` para a coluna "Outros" do QL. No Python, um TCC nessa tabela
  levantaria `KeyError` (o dicionário só tem Teses/Dissertações/Outros); nenhuma base de PPG
  exercita esse caminho.

---

## Deploy na Netlify

O `netlify.toml` fica **na raiz do repositório** e já está configurado com
`base = "ecograd-web"`, rotas SPA, roteamento de `/api/*` para as funções, e headers de cache
para `dist/assets` (imutável) e `public/data`. Não é preciso configurar nada no painel: o `base`
do arquivo já aponta para a subpasta da aplicação.

Todo módulo compartilhado entre funções mora em `netlify/functions/lib/` — arquivos na raiz de
`netlify/functions/` viram endpoints publicáveis, inclusive os prefixados com `_`.

Defina `GEMINI_API_KEY` no painel do site, no escopo de funções — elas vivem apenas no runtime das funções e **nunca**
entram no bundle do cliente.

> **Bases de dados**: os `.json.gz` (62 MB) são copiados para `public/data/` pelo `sync:data`
> durante o build, e por isso precisam estar versionados na raiz do repositório. Se preferir
> servi-los de um bucket externo, aponte `CAMINHO_BASE_PPG` / `CAMINHO_BASE_TCC` em
> `src/lib/data-loader.ts` para a URL correspondente.

### Limites do serverless

`gemini-ontology` processa no máximo **8 documentos por invocação** (com 4 s de intervalo entre
requisições, como no Python) para caber no tempo de execução das funções. O cliente envia um documento por invocação, com pausa cancelável de quatro segundos, para
preservar cada resultado concluído e retomar somente pendências/falhas. Os resultados ficam
em revisão até a aplicação explícita à análise.

---

## Segurança

- Nenhuma chave de API chega ao navegador: Gemini é acessado pelas funções.
- `neo4j-query` retorna HTTP 410 com `NEO4J_DISABLED`, sem ler credenciais ou conectar a banco. O frontend usa arquivos JSON por coleção.
- As respostas da IA passam por `markdownParaHtml`, que escapa o HTML antes de aplicar as
  marcações; links são restritos a `http(s)` e abrem com `target="_blank" rel="noopener noreferrer"`.

## Evolução da experiência

O andamento das entregas, critérios de aceite e próximos passos está em [Implementação UX](../docs/IMPLEMENTACAO-UX.md).

`npm run test:workers` verifica o ciclo de vida das atividades (cancelamento, fila, reinício e invalidação). Cálculos continuam durante a navegação entre páginas da mesma sessão; recarregar a aba ainda encerra as atividades.

`npm run test:selecao` verifica equivalência de coleções, aplicação atômica da seleção e reinício da análise. Em telas estreitas, use o menu do cabeçalho; ajuda e CAPES permanecem acessíveis durante a análise.

### Recuperação da sessão

A aba salva textos/preferências em sessionStorage (1 MiB) e a análise em IndexedDB (64 MiB por checkpoint, 128 MiB/4 checkpoints no navegador). A validade é de 24 horas desde o último salvamento. O painel **Recuperação da sessão** mostra limites, falhas e a ação **Salvar sessão agora**. Aguarde **Sessão salva** antes de recarregar para recuperar o último checkpoint completo.

Resultados só voltam se o identificador da análise, o formato persistido e o hash da base conferirem. `npm run sync:data` gera `public/data/manifest.json` com SHA-256 das bases; esse arquivo precisa acompanhar o deploy. Atualize `SESSION_SCHEMA` em `src/lib/session-codec.ts` quando mudar o contrato dos resultados ou o formato persistido. Requisições/algoritmos interrompidos por reload exigem reinício manual; textos parciais são conservados. Testes: `npm run test:session` e `npm run test:workers`.

### Rotas e percurso

As páginas têm rotas `#/inicio`, `#/selecao`, `#/dashboard`, `#/busca`, `#/foresight`, `#/memetica` e `#/chat`. Voltar/avançar do navegador e o controle **Histórico desta análise** recuperam entidades, filtros, abas, seções abertas, rolagem e foco, sem substituir a base, os rascunhos ou atividades em andamento. Links diretos sem base pedem selecionar as coleções antes de abrir a página desejada.

A URL contém apenas a página. Entidades e contexto ficam na aba, em até 60 visitas/256 KiB adicionais de sessionStorage (validade de 24 h). Uma nova análise ou versão da base invalida o percurso anterior. Compartilhar o link não transfere a entidade, as coleções nem conversas. Testes: `npm run test:navigation`.

### Entrada por objetivos e prévia das coleções (parte 6)

A seleção mostra metadados de 264 coleções antes de baixar as bases. `sync:data` gera `public/data/colecoes-cobertura.json` (~75 KiB), vinculado à versão do manifesto. O catálogo preserva nomes completos e identificadores, distingue coleções semelhantes e informa a cobertura do recorte local, sem estimar a produção total da instituição. A data da coleta não está disponível.

A ficha CAPES exige um vínculo documental exato em `src/data/vinculos-capes.json`; nome coincidente ou semelhante nunca transfere nota à coleção. A curadoria inicial cobre Odontologia `74720`; as demais entradas permanecem não verificadas. Fontes, critérios e pendências: [Curadoria CAPES](../docs/VINCULOS-CAPES.md).

Objetivo, filtros da seleção e etapa do tutorial permanecem na sessão. A carga abre a ferramenta escolhida, respeitando links diretos pendentes. Editar sem aplicar mantém a análise ativa. Validação: `npm run test:colecoes` e as suítes de navegação/sessão/workers/CAPES. Ver a sequência no [plano](../docs/IMPLEMENTACAO-UX.md).

### Resultados antes dos métodos (parte 7)

Dashboard e dossiês apresentam trabalhos, resumos e fontes antes das análises opcionais. A lista oferece busca, filtros e paginação, conservados no percurso. Títulos repetidos exigem identificar o registro por coleção, ano, autoria e fonte; a referência exata permanece local à sessão. A rede científica mantém sua identidade por título e explicita a possível agregação de homônimos.

A comparação mostra cobertura e tipos originais, com opção de janela temporal comum que afeta somente a tabela. TCCs são identificados como acervo de graduação/especialização, sem receber ficha ou nota de programa CAPES. Volumes não representam qualidade nem produção total da instituição. Métodos científicos, vínculos curados, atividades e recuperação permanecem preservados.

Validação: `npm run test:resultados` e as suítes existentes de navegação, sessão, workers, seleção, coleções e CAPES. Cenários e limitações registrados no [relatório da implementação](../docs/IMPLEMENTACAO-UX.md). Controles, leitura e exportação de gráficos/tabelas foram implementados na parte 8.

### Gráficos, tabelas e redes (parte 8)

Gráficos oferecem descrições/unidades e uma vista em tabela com os mesmos dados. Tabelas permitem buscar, ordenar, paginar, ler nomes completos e exportar todas as linhas filtradas. CSV/JSON contextualizados incluem recorte, versão, fonte, filtros e parâmetros, sem conversas ou rascunhos. O CSV ontológico para reimportação permanece separado.

Redes têm controles por teclado para câmera, zoom, enquadramento e movimento, além de tabelas de nós/conexões. Vistas, filtros, páginas e câmera ficam na sessão/histórico. A navegação de termos usa o extrator da análise correspondente; tokens de títulos e artefatos não são tratados como palavras-chave por aproximação. O módulo científico apenas passa a exportar um extrator existente, sem alterar sua implementação.

Verificação: `npm run test:visualizacao`, `npm run test:navigation` e suítes de regressão anteriores; build e cenários de teclado/320–1440 px no [registro da implementação](../docs/IMPLEMENTACAO-UX.md). Próxima etapa: organização progressiva e interpretação de Foresight/Memética.

### Experiência de uso — parte 9

Foresight e Memética distinguem exploração comum de configuração avançada. Períodos efetivos, cobertura, critérios e incertezas acompanham os resultados; rótulos de apresentação são descritivos e os campos científicos das exportações permanecem compatíveis. Atividades continuam acessíveis com seções fechadas. Consulte [a implementação e as validações](../docs/IMPLEMENTACAO-UX.md).

Validação específica: `npm run test:interpretacao`; build: `npm run build`.

### IA, contexto e importação (parte 10)

O Consultor informa o recorte do catálogo e do histórico enviado, preserva respostas parciais e permite repetir a última tentativa sem perder o rascunho. Sínteses são geradas explicitamente, com prévia da amostra e preservação do último texto concluído. Extração salva resultados por documento, continua durante a navegação e permite retomar pendências após interrupção/reload; aguarde “Sessão salva” antes de recarregar. Cancelar encerra a espera local, mas o provedor pode concluir pedidos já recebidos.

Importação CSV oferece prévia, validação de versão/identidade, bloqueio de ambiguidades e substituição explícita. É possível escolher arquivo ou colar CSV. O formato para reimportação usa listas JSON e IDs estáveis, sem aproximação por nomes. Consulte [o contrato de importação](../docs/IMPORTACAO-ONTOLOGIA.md). Aplicar enriquecimentos fica bloqueado durante cálculos e invalida resultados dependentes dos documentos.

Validação: `npm run test:ia` (contratos e recuperação) e `npm run test:all` (suíte completa, com endpoints simulados), seguidos de `npm run build`. As validações de teclado, tamanhos de tela e limitações estão no [registro da implementação](../docs/IMPLEMENTACAO-UX.md). `tests/manual-ia-server.mjs` é uma fixture local de UI com respostas artificiais; não deve ser usada como serviço de IA ou publicada.

### Aparência e conforto (parte 11)

O botão **Aparência e conforto** na apresentação e no menu oferece tema claro/escuro/sistema, densidade confortável/compacta e redução de movimento. Textos, controles, tabelas e gráficos compartilham tokens; foco, seleção e desabilitação têm estados visíveis. A redução de movimento alcança CSS, gráficos e redes, preservando cálculos e controles manuais.

Preferências ficam em `localStorage` (`ecograd.aparencia.v1`, três valores enumerados, menos de 200 bytes), separadas da sessão científica. Não são incluídas em URLs ou exportações. Falha de armazenamento é informada sem impedir o ajuste em memória. Validação: `npm run test:all` e `npm run build`; cenários, contraste e limites no [registro da implementação](../docs/IMPLEMENTACAO-UX.md).


## Entrega integrada e homologação

A parte 12 reúne 114 testes aprovados, comparação científica nos recortes documentados, build, avaliação dos fluxos e matriz de cinco páginas × dois temas × quatro larguras. Relatório completo, evidências, correções e pendências: [Avaliação integrada](../docs/AVALIACAO-INTEGRADA.md).

Gráficos e redes são carregados sob demanda; falha do desenho mantém a alternativa em tabela. `npm run report:build` verifica o JS inicial do último build e informa o tamanho das bases. O ganho no JS não elimina os aproximadamente 64,9 MB compactados das bases PPG + TCC em uma seleção mista. IA real, leitores de tela, participantes e desempenho em celulares físicos devem ser homologados antes de prometer cobertura desses cenários. Os servidores em `tests/manual-ia-server.mjs` são simulações locais e não devem ser publicados.


## Bloco 13 — entrega por coleção

O carregamento baixa somente as coleções selecionadas, verifica hashes e preserva registros, ordem e versão científica. Para Ecologia + TCC Administração Pública EAD, os dados caíram de 64,9 MB para 363.651 bytes, além dos catálogos. `sync:data` gera arquivos com hash e interrompe o build se faltar uma fonte. Testes: `npm run test:all`; relatório, evidências, limites e próximo prompt em [Entrega por coleção](../docs/ENTREGA-POR-COLECAO.md). As medições históricas acima descrevem o carregamento anterior; homologação física e IA semântica continuam pendentes.


## Bloco 14 — IA rastreável

Sínteses incluem o recorte no texto; falhas preservam a amostra do último sucesso. Extrações recebem somente resumos e exigem trechos literais com hash, exibidos na revisão e exportação JSON. O CSV científico permanece compatível; o JSON de revisão deve ser conservado separadamente. Lotes antigos são recuperados e identificados como legados sem evidência. [Testes, limites e próximos passos](../docs/IA-RASTREAVEL.md).


## Bloco 15 — curadoria por termo

Aceite, rejeição e correção com justificativa e evidência literal; histórico e proposta original preservados, aplicação somente de aprovações salvas por ID exato. Recuperação conferida na interface, 138 testes e build aprovados. [Evidências, limites e próximo prompt](../docs/CURADORIA-POR-TERMO.md). Restam dois blocos previstos: homologação humana/assistiva/móvel e revisão final no runtime de destino. Sem publicação.


## Bloco 16 — homologação disponível

Tutorial atualizado para entrega por coleção e curadoria; abertura do catálogo identificada pelo título completo. 138 testes, paridade e build aprovados; teclado, fonte e recuperação retestados. Extrações reais arquivadas revisadas textualmente; participantes, leitores reais, aparelhos e aceite científico continuam pendentes. [Resultados, ações e próximo prompt](../docs/HOMOLOGACAO-BLOCO16.md). Nenhuma publicação.


## Bloco 17 — revisão final local

Build alinhado ao Node 24 (`.nvmrc` e engines); dados de nome fixo exigem revalidação de cache. 138 testes, build e cinco bundles Node 24 aprovados localmente. [Pacote, manifesto, plano de rollback e ações finais](../docs/REVISAO-FINAL-BLOCO17.md). Destino remoto e evidências humanas ainda pendentes; nenhuma publicação.
