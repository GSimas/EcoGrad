# 🌌 EcoGrad — Ecologia do Conhecimento

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)
![Postgres](https://img.shields.io/badge/Postgres_+_pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.9%2B-blue?style=for-the-badge&logo=python)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)

Plataforma de **cientometria, análise de redes sociais (SNA) e mineração de textos** que mapeia a
produção acadêmica da UFSC — teses, dissertações e trabalhos de conclusão — para revelar a
estrutura latente do conhecimento: redes de colaboração, genealogia acadêmica, temas emergentes e
o papel topológico de pesquisadores e conceitos.

**Os dados vêm do [Repositório Institucional da UFSC](http://repositorio.ufsc.br/)**, que roda DSpace.
O EcoGrad não produz dado novo: coleta, normaliza, indexa e reorganiza o que já está depositado lá,
e todo trabalho preserva o link para a página original. O acervo atual tem **92.331 registros**,
**85.567 trabalhos distintos** (a mesma obra pode estar catalogada em mais de uma coleção) e
**254 coleções**; 80.415 registros têm resumo utilizável.

Em produção: **<https://ecograd.netlify.app>**

---

## 📦 O que vive na raiz do repositório

A aplicação é a versão web, em [`ecograd-web/`](ecograd-web/) — React 18 + Vite + TypeScript +
Tailwind, com Netlify Functions. Rode com `cd ecograd-web && npm install && npm run netlify:dev`;
detalhes no [README da aplicação](ecograd-web/README.md).

A raiz guarda o que alimenta e valida essa aplicação:

| Arquivo | Papel |
| --- | --- |
| `backend.py` (+ `app_config.py`, `gemini_utils.py`) | Referência numérica do Python original, importada por `npm run verify:parity` |
| `pipeline_ufsc.py` | Enriquecimento da base: macrotemas (NMF + Gemini), normalização, consolidação |
| [`coleta/`](coleta/) | Coleta semanal do Repositório Institucional, executada pelo GitHub Actions |
| `base_*.json.gz`, `programas_ufsc.json`, `mapa_colecoes_tcc.json` | Bases copiadas para `ecograd-web/public/data/` no `sync:data` |
| `base_ppgegc.json` | Base de referência da comparação de paridade |

A versão web é uma migração de um app Streamlit. Toda a matemática de redes complexas, foresight
e memética foi **transcrita e verificada numericamente** contra o `backend.py` original — veja
[Paridade](#-paridade-numérica-com-o-backend-python). A interface Streamlit em si (`Principal.py`
e `pages/`) foi removida do repositório em favor da versão web; ela continua acessível no
histórico do git, até o commit `cad47e3`.

---

## 🎯 Visão geral

O projeto vai além da contagem de publicações. Usando teoria de **sistemas complexos** e **grafos**,
mapeia a "ecologia do conhecimento" de ecossistemas acadêmicos para:

- avaliar a maturidade e a resiliência de linhas de pesquisa;
- identificar *brokers* (corretores de conhecimento) e *hubs* interdisciplinares;
- rastrear a genealogia acadêmica (alunos que se tornam formadores);
- prospectar temas emergentes antes que virem consenso;
- recomendar conexões por similaridade topológica.

---

## 🚀 Funcionalidades

### Fluxo de telas

1. **Tela inicial**, com dois caminhos para o mesmo acervo:
   - **Buscar** — procura qualquer item do acervo inteiro (documento, pessoa, palavra-chave,
     macrotema, coleção) e carrega só o que você confirmar. Nada é baixado antes disso.
   - **Conversar** — o UFSCão respondendo sobre o **acervo inteiro** pelo índice, sem baixar
     coleção nenhuma.
2. **Análise** — as cinco seções abaixo, sobre o recorte carregado.

O painel lateral recolhe para uma faixa de ícones, e o estado fica salvo na sessão. O botão
**Sobre**, na tela inicial, explica a procedência dos dados e como a plataforma funciona por baixo.

### 1. 📊 Dashboard

KPIs da base, comparativo entre PPGs quando há mais de um, **ficha oficial da CAPES** (cruzada com
a Plataforma Sucupira por *fuzzy matching*, que resolve programas renomeados) e uma síntese do
perfil epistemológico escrita por IA.

Traz também as **métricas de ecologia profunda**: assortatividade ($r$), coeficiente rich-club
($\Phi$), expoente $\gamma$ da lei de potência e correlação de Spearman ($\rho$) entre grau e
intermediação.

Todo nome exibido é clicável — chips de destaque e as barras dos Top 10 — e leva direto ao dossiê
da entidade no Motor de Busca.

### 2. 🔍 Motor de Busca e Dossiê

Busca unificada por Documento, Autor, Orientador, Co-orientador, Palavra-chave e Macrotema. Cada
entidade abre um dossiê com:

- **Raio-X de Especialização** — peculiaridade temática (NMF), densidade local na rede e raridade
  do vocabulário (IDF);
- **Quociente Locacional (QL)** — especialização relativa à média global da base;
- **Evolução histórica** — produção ano a ano, com opção cumulativa;
- **Lexicometria** — nuvem de palavras de conceitos, títulos ou resumos;
- **Órbita de relacionamentos** — ego-graph animado com player temporal;
- **Itens semelhantes** — recomendação topológica pelo **Índice de Jaccard**, calculada sobre a
  sobreposição do "DNA acadêmico" (vizinhança na rede).

### 3. 🔮 Radar de Foresight

Cruza **Momentum Temporal** (aceleração do uso de um termo, normalizada por taxa relativa com
suavização de Laplace) com **Novidade Estrutural** (Betweenness × IDF), separando os termos em
quatro quadrantes: Tendências, Sinais Fracos, Mainstream e Base/Declínio.

- Segmentação por **percentil fixo** ou **K-Means adaptativo** de 4 clusters.
- **Bootstrap** de 100 reamostragens para um betweenness robusto em bases pequenas.
- **Grid Search** que varre 108 configurações, valida cada uma contra a história real da base
  (treino até T1, conferência em T2) e ranqueia por **MCC** — robusto a classes desbalanceadas.

Funciona sobre Palavras-chave, Macrotemas ou Artefatos da Ontologia IA.

### 4. 🧬 Memética e Ontologia

- **Mineração de artefatos** — a IA lê os resumos e extrai teorias, métodos e ferramentas de fato
  utilizados, indo além das palavras-chave genéricas. O catálogo é exportável em CSV e pode ser
  recarregado depois, sem gastar cota da API.
- **Genética das ideias** — fecundidade, mortalidade infantil e tempo de meia-vida dos memes.
- **Longevidade** — dispersograma de ano de nascimento × anos de sobrevivência, com cor pelo ano
  da última aparição e tamanho pelas replicações.
- **Ecologia Memética (SNA)** — rede de coocorrência entre memes, com métricas de redes complexas,
  métricas de ecologia profunda, grafo interativo e tabela de centralidade global exportável.

### 5. 🐕 UFSCão · Consultor de IA

O UFSCão fala em **duas superfícies**, com a mesma persona, a mesma configuração e os mesmos
limites:

| Onde | Sobre o quê | Como recupera |
| --- | --- | --- |
| **Conversar**, na tela inicial | o acervo inteiro | índice Postgres: SQL para quem/quanto/quando, busca textual e vetorial para tema |
| **Botão flutuante**, nas páginas | as coleções carregadas | dossiê montado por pergunta a partir do recorte em memória |

A conversa iniciada na tela inicial **acompanha você** para o botão flutuante, visível e citada,
com o recorte de cada resposta declarado — as duas telas respondem sobre corpora diferentes, e o
prompt diz isso ao modelo em vez de misturar os números em silêncio.

**BYOK.** A chave de API é sua, fica no seu navegador e vai direto ao provedor escolhido (OpenAI,
Anthropic, Google, Groq, OpenRouter ou qualquer serviço compatível com a API de chat da OpenAI).
O EcoGrad não recebe nem guarda a conversa. Configure em **Configurações** ou dentro do próprio
chat. A única chamada a modelo que o servidor faz é o *embedding* da pergunta, para a busca por
significado.

**O modelo só escreve.** Toda contagem sai de SQL; a busca por similaridade escolhe o que ler, e
nunca responde "quantos". Cada afirmação sobre um trabalho leva a citação `[n]` da obra que a
sustenta, e cada `[n]` é um botão que abre a obra no Motor de Busca. Citação a fonte que não foi
enviada é apontada na tela.

**Duas profundidades de leitura.** A resposta padrão lê uma amostra representativa de 15 a 20
obras, espalhada por coleção. **Aprofundar** lê todas as obras do tema com resumo utilizável, em
lotes — mostrando chamadas, tokens e tempo estimados **antes** de gastar a sua chave.

**Guardrails** ([`src/lib/guardrails.ts`](ecograd-web/src/lib/guardrails.ts)) valem nas duas telas,
num arquivo só para não divergirem:

- **Injeção pelo acervo.** Título, resumo e palavra-chave são texto que terceiros depositaram, sem
  revisão pensando em modelo de linguagem. Tudo isso chega ao contexto **cercado** por marcadores
  que o próprio conteúdo não consegue fechar, e o prompt manda tratar o que está lá dentro como
  dado — e declarar quando encontrar uma ordem em vez de conteúdo.
- **Escopo, dano e pessoas reais.** Pedido fora do acervo recebe recusa cordial; conteúdo que
  ataque, exponha ou sexualize alguém é recusado inclusive como hipótese ou ficção; sobre as
  pessoas do acervo vale só o que ele registra — sem juízo de mérito, sem inferir atributo
  pessoal a partir do nome ou do tema, sem contato ou vínculo atual.
- **Barreiras estruturais**, que é o que de fato impede estrago: o papel do banco só executa
  `SELECT`, com teto de tempo e de linhas; não existe tabela de escrita alcançável pela chave
  publicada; e a chave do modelo é do próprio usuário.

---

## 🗃️ O índice do acervo

Responder "como a UFSC trata tal tema?" sem baixar nada exige um lugar onde o acervo inteiro já
esteja indexado. Esse lugar é um **Postgres** (Supabase) com o texto dos resumos em FTS e um vetor
por obra em **pgvector**. Ele é **derivado e reconstruível**: os `.json.gz` da raiz continuam sendo
a fonte, e `indice_meta` guarda o sha256 das bases que o geraram — a aplicação compara com o
manifesto publicado e se recusa a responder sobre uma base que não é mais a da tela.

| Camada | O que faz |
| --- | --- |
| `buscar_texto`, `tesauro`, `consulta_expandida` | recuperação léxica, com expansão de vocabulário tirada do próprio acervo |
| `documento_embedding` (pgvector, HNSW) | busca por significado, para o tema escrito com outro vocabulário |
| `panorama_tematico` | panorama exato do tema **em SQL** mais uma amostra representativa, com cota por coleção |
| `obras_do_tema`, `resumos_das_obras` | a lista inteira do tema e os resumos em páginas, para o "Aprofundar" |
| `consulta.*` + `consultar()` | views comentadas e execução somente leitura, que é como o modelo escreve SQL (NL2SQL) |
| `pessoa`, `pessoa_fusao`, perfis, `rede_metrica` | pessoas unificadas automaticamente, perfis e métricas de rede pré-calculadas |

**Contagem nunca sai de similaridade.** O vetor escolhe o que ler; quem conta é SQL. Obra achada só
por significado vai ao modelo marcada como aproximação e fora de qualquer total.

```bash
cd ecograd-web
npm run indice:derivar          # gera os arquivos do índice a partir das bases
npm run indice:carregar         # carrega por COPY (porta 5432)
npm run indice:carregar:https   # ou por HTTPS, onde a 5432 está bloqueada
npm run indice:embeddings       # vetores das obras (custo único, ~US$ 8)
```

`indice/schema.sql` é a definição canônica: aplicá-lo num Postgres vazio e rodar os comandos acima
reconstrói o índice do zero. Não há migração incremental de propósito — divergência silenciosa
entre base e índice é o modo de falha que o projeto quer evitar, e reconstruir custa minutos.

### Atualização automática

Duas rotinas no GitHub Actions mantêm tudo em dia, e a segunda depende da primeira:

| Rotina | Quando | O que faz |
| --- | --- | --- |
| [`coleta-ufsc.yml`](.github/workflows/coleta-ufsc.yml) | segundas, 03:00 (Brasília) | coleta os depósitos novos do repositório e commita um lote em `coletas/` |
| [`indice-supabase.yml`](.github/workflows/indice-supabase.yml) | logo após a coleta, mais rede de segurança nos dias 1 e 15 | deriva o índice das bases **mais os lotes**, carrega no Supabase, enriquece e calcula os vetores das obras novas |

A segunda roda por `workflow_run`, e não num horário próprio: o índice tem que ser derivado das
mesmas bases que o site publicou, e amarrar pelo relógio deixaria as duas metades fora de fase na
semana em que a coleta demorasse. Sem lote novo não há commit, o `workflow_run` não dispara, e o
índice fica como está — que é o correto, porque nada mudou.

O último passo é [`indice:conferir`](ecograd-web/scripts/indice-conferir.mjs), que falha o job se o
carimbo não bater com as contagens, se o enriquecimento não tiver entrado, se a cobertura de vetor
cair abaixo de 90% ou se `panorama_tematico` e `obras_do_tema` discordarem. Numa rotina automática,
falhar alto é melhor do que servir meio acervo em silêncio.

**Segredos necessários no repositório:** `SUPABASE_DB_URL` (pooler em modo sessão, porta 5432) e
`GEMINI_API_KEY`. Os embeddings são incrementais — cada vetor guarda o sha256 do texto que o gerou,
então uma semana de coleta custa centavos.

> **Runner e qualidade do resumo.** Em runner hospedado do GitHub, a coleta fica fora da RedeUFSC: o
> DSpace pede verificação anti-robô e ela cai no Oasisbr/IBICT, **sem resumo**. Como o resumo é o que
> alimenta a busca textual e os vetores, colher pelo DSpace exige um runner self-hosted na rede da
> UFSC (ou com VPN), apontado pela variável de repositório `COLETA_RUNNER`.

### Decisões e medição

O índice e o UFSCão foram construídos por etapas com porta de medição, e o plano mudou duas vezes
**porque a medição desmentiu a aposta inicial**. Os ADRs registram isso, e o mais recente vale
sobre os anteriores:

| Documento | O que decide |
| --- | --- |
| [ADR 001](docs/ADR-001-CHAT-SEMANTICO.md) | o plano original do chat semântico, em cinco etapas |
| [ADR 002](docs/ADR-002-RECORTE-POR-ITEM.md) | recorte por item, e não por coleção inteira |
| [ADR 003](docs/ADR-003-O-QUE-A-MEDICAO-MUDOU.md) | **a lacuna era de indexação, não de semântica**: indexar o resumo levou a revocação de 46% para 79%, sem vetor nenhum |
| [ADR 004](docs/ADR-004-UFSCAO-SOBRE-O-ACERVO.md) | o UFSCão sobre o acervo inteiro, em quatro fases (A0 a C) |
| [Aferição](docs/AFERICAO-ETAPA-0.md) | as 25 perguntas, os gabaritos e todo número medido |

Recuperação medida contra a triagem humana assinada, em k = 25 (revocação / precisão):

| Método | "empreendedorismo feminino" | "mulheres empreendedoras" | Sobreposição |
| --- | --- | --- | --- |
| Busca por rótulo (o app antes do índice) | 46% / 100% | — | — |
| Texto (`buscar_texto`) | 79% / 76% | 63% / 83% | 64% |
| Vetor | 79% / 95% | 79% / 100% | 96% |
| Híbrido (RRF) — o que vai à tela | 83% / 87% | 75% / 82% | 80% |

**Limite declarado:** há um único tema com gabarito humano assinado. Uma amostra cega de 8 temas
sorteados está congelada em `docs/evidencias/afericao/`, aguardando triagem — é ela que dirá se os
números acima generalizam.

```bash
npm run afericao               # roda o conjunto de aferição contra os gabaritos
npm run afericao:vetor         # compara texto, vetor e híbrido
npm run afericao:amostra-cega  # sorteia temas para medir generalização
```

---

## 🏗️ Arquitetura

```text
netlify.toml                  # na raiz, com base = "ecograd-web"
docs/                         # ADRs e aferição: o porquê de cada decisão, com os números
ecograd-web/
├── indice/schema.sql         # definição canônica do índice Postgres
├── netlify/functions/        # Gemini (síntese, ontologia, embedding), proxy CAPES, Neo4j
├── scripts/                  # derivação e carga do índice, aferição, paridade
├── src/lib/                  # motores analíticos, prompts e guardrails, em TypeScript puro
├── src/workers/              # ingestão e redes complexas fora da main thread
└── src/components/           # UI React
```

**Front-end** — React 18, Vite, Tailwind, Zustand (estado), TanStack Query (cache), Radix UI,
ECharts (gráficos e nuvem de palavras) e react-force-graph (grafos).

**Motores analíticos** — kernels próprios sobre estrutura CSR: Brandes (BFS e Dijkstra, com
amostragem de pivôs), closeness com correção Wasserman-Faust, clustering simples e ponderado,
PageRank, autovetor, constraint de Burt, rich-club, assortatividade e Louvain (graphology).

**Web Workers** — a ingestão descomprime `.json.gz` de 62 MB e filtra a seleção; o worker de rede
roda SNA, bootstrap, grid search e a rede memética. Sem isso a página congelaria por minutos.

**Backend serverless** — Netlify Functions em TypeScript. As chaves secretas vivem só no runtime das
funções, nunca no bundle. O `neo4j-query` não aceita Cypher do cliente: só o nome de uma consulta
pré-registrada e parâmetros, que viajam como binds do driver. O `embedding-consulta` é a única
chamada a modelo que o servidor faz por conta própria — o vetor da pergunta, para a busca por
significado — e é cercada: só aceita a própria origem, texto curto e 30 chamadas por minuto por IP.

**O que o EcoGrad não faz** — não guarda conversa, não recebe a sua chave de API, não registra quem
perguntou o quê. A conversa do UFSCão vai do seu navegador direto ao provedor que você escolheu; o
que fica no EcoGrad é só o que você vê na sessão, e some ao fechar a aba.

### Aproximações em redes grandes

O `backend.py` já aproximava o betweenness acima de 1500 nós; o mesmo princípio foi estendido às
demais métricas O(n·m), porque a rede completa da UFSC passa de 100 mil nós. Abaixo dos limiares o
resultado é idêntico ao NetworkX. A tabela completa está no
[README da aplicação](ecograd-web/README.md#aproximações-em-redes-grandes).

---

## ✅ Paridade numérica com o backend Python

```bash
cd ecograd-web && npm run verify:parity
```

O harness roda os dois motores sobre a mesma base e compara os resultados. Cobertura:

| Bloco | O que é comparado |
| --- | --- |
| Topologia | degree, betweenness, closeness e clustering — diferença relativa máxima `2e-16` |
| Métricas complexas | densidade, eficiência global, entropia, PageRank, autovetor, Burt |
| Rede de coocorrência | rich-club por grau (153 valores), clustering ponderado, assortatividade, γ |
| Maturidade | assortatividade, rich-club, γ por regressão log-log e por estimador MLE |
| Radar de Foresight | os 43 termos, com Momentum e Novidade — diferença exatamente zero |
| Backtest | as 89 linhas, distribuição por quadrante e os oito vereditos |
| Memética | memes, mortalidade, sobreviventes, longevidade, meia-vida |
| QL e Jaccard | valores idênticos |

Duas diferenças conhecidas, ambas sem efeito sobre os números: **Louvain** é estocástico (a
comparação é por modularidade) e **empates de contagem** na memética têm ordem arbitrária no
pandas, que usa quicksort instável — o TypeScript desempata por nome, o que torna o Top-N
reprodutível.

O harness já pagou por si: foi ele que expôs o autovetor iterando `A·x` em vez do `x + A·x` do
NetworkX, e a varredura do rich-club ordenando as arestas pelo maior grau em vez do menor — erro
que produzia coeficientes acima de 1.

---

## 🛠️ Instalação

### Aplicação web

```bash
cd ecograd-web && npm install
```

Crie `ecograd-web/.env` a partir de `.env.example` e rode tudo (front-end + funções) em
<http://localhost:8888>:

```bash
npm run netlify:dev
```

Para trabalhar só na interface, sem as funções, use `npm run dev`. As bases da raiz são copiadas
para `public/data/` automaticamente. Detalhes, comandos e notas de deploy no
[README da aplicação](ecograd-web/README.md).

### Variáveis de ambiente

| Variável | Onde vale | Para quê |
| --- | --- | --- |
| `VITE_INDICE_URL`, `VITE_INDICE_CHAVE` | **build** | endereço e chave publicável do índice. O Vite as grava no JS que vai ao navegador |
| `GEMINI_API_KEY` | runtime das funções | síntese, ontologia e o *embedding* da pergunta |
| `SUPABASE_DB_URL` ou `SUPABASE_SERVICE_ROLE_KEY` | só na carga, na sua máquina | reconstruir o índice. **Nunca** precisam existir no ambiente de build |

As duas `VITE_*` são **públicas por desenho** — o prefixo significa gravar o valor no bundle, e a
chave é a publicável (`anon`), com RLS somente leitura e nenhuma tabela de escrita alcançável. Por
isso o `netlify.toml` traz `SECRETS_SCAN_OMIT_KEYS` para as duas: sem isso o scanner de segredos da
Netlify reprova o build ao encontrá-las no próprio bundle que acabou de gerar. O scanner segue
ligado para todo o resto.

Por serem de build, mudá-las exige **recompilar** — republicar o mesmo artefato não adianta.

### Verificação

```bash
npm run test:all       # suíte completa
npm run typecheck      # tsc --noEmit
npm run build          # sync de dados + typecheck + build de produção
npm run verify:parity  # paridade numérica com o backend Python
```

### Referência Python (paridade e pipeline)

A interface Streamlit foi removida; o que ficou na raiz é a referência numérica usada pela
comparação de paridade e o pipeline de enriquecimento da base.

```bash
pip install -r requirements.txt
```

As credenciais são lidas de variáveis de ambiente (ou de `.streamlit/secrets.toml`, que
`app_config.py` ainda aceita):

```bash
GEMINI_API_KEY=...
NEO4J_URI=...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...
```

---

## 📋 Estado da migração

A migração cobre os módulos centrais, mas **nem tudo do app Streamlit foi portado**. O que não
foi portado e hoje só existe no histórico do git (até o commit `cad47e3`):

| Módulo original | Onde estava | Status |
| --- | --- | --- |
| Espaço Topológico 3D (Grau × Betweenness × Closeness) | Exploração Global | ⏳ não portado |
| Mapa Temático (quadrantes de Callon / Bibliometrix) | Principal | ⏳ não portado |
| Sankey Temporal de palavras-chave | Fluxos | ⏳ não portado |
| Boxplot de Especialização (QL por nível) | Exploração Global | ⏳ não portado |
| Furos Estruturais de Burt (seção dedicada) | Exploração Global | ⏳ não portado |
| Exportação da rede (GEXF / GraphML / JSON) | Exploração Global | ⏳ não portado |
| Tabela geral da base com métricas SNA | Principal | ⏳ não portado |
| Órbita via Neo4j (Cypher) | Motor de Busca | ⚠️ função pronta, UI usa o grafo em memória |
| Métricas de redes complexas do grafo global | Exploração Global | ⚠️ motor pronto, exposto só na rede memética |

Os motores matemáticos de vários desses itens já existem em `ecograd-web/src/lib/` — falta a
camada de interface.

---

## 📄 Licença

Ver [LICENSE](LICENSE).

Desenvolvido por **Gustavo Simas** — [github.com/GSimas](https://github.com/GSimas)
