# 🌌 EcoGrad — Ecologia do Conhecimento

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.9%2B-blue?style=for-the-badge&logo=python)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)

Plataforma de **cientometria, análise de redes sociais (SNA) e mineração de textos** que mapeia a
produção acadêmica da UFSC — teses, dissertações e trabalhos de conclusão — para revelar a
estrutura latente do conhecimento: redes de colaboração, genealogia acadêmica, temas emergentes e
o papel topológico de pesquisadores e conceitos.

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

1. **Apresentação** — o que é a plataforma, como funciona e um tutorial de 5 passos em modal.
2. **Seleção de coleções** — escolha de PPGs e cursos de graduação, com o Panorama CAPES já
   visível enquanto se decide.
3. **Análise** — as cinco seções abaixo.

O painel lateral recolhe para uma faixa de ícones, e o estado fica salvo na sessão.

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

### 5. 🤖 Consultor Acadêmico IA

Chat com streaming que recebe o dossiê institucional completo — métricas de rede, mapa de
especialidades de cada docente e catálogo de trabalhos com os links do repositório. Recomenda
orientadores compatíveis com a ideia do candidato e indica teses para ler, com os títulos como
hiperlinks que abrem o repositório da UFSC em nova aba.

---

## 🏗️ Arquitetura

```text
netlify.toml                  # na raiz, com base = "ecograd-web"
ecograd-web/
├── netlify/functions/        # Gemini (síntese, ontologia, chat), proxy CAPES, Neo4j
├── src/lib/                  # motores analíticos em TypeScript puro
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

**Backend serverless** — Netlify Functions em TypeScript. As chaves da API vivem só no runtime das
funções, nunca no bundle. O `neo4j-query` não aceita Cypher do cliente: só o nome de uma consulta
pré-registrada e parâmetros, que viajam como binds do driver.

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
