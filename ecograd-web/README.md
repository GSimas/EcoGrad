# EcoGrad Web

Migração da plataforma **EcoGrad — Ecologia do Conhecimento (UFSC)** de Python/Streamlit para
**React 18 + Vite + TypeScript + Tailwind**, com backend serverless em **Netlify Functions**.

Toda a matemática de redes complexas, foresight e memética foi transcrita do `backend.py`
original e é **verificada numericamente** contra ele (ver [Paridade](#paridade-com-o-backend-python)).

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
> a extração ontológica e o Consultor IA ficam indisponíveis (a interface avisa e continua
> funcionando). Para a aplicação completa, use o comando abaixo.

### Aplicação completa (frontend + funções)

```bash
npm run netlify:dev
```

Isso sobe o Vite e as funções juntos em <http://localhost:8888>, roteando `/api/*` para
`netlify/functions/*`. Antes, defina as variáveis de ambiente em um `.env` na pasta `ecograd-web/`
(veja `.env.example`):

```bash
GEMINI_API_KEY=...
NEO4J_URI=...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...
```

> **Não chame `netlify dev` diretamente de dentro de `ecograd-web/`.** A CLI resolve `base`, o
> diretório de funções e o `.env` a partir da raiz do repositório git, e por isso o `netlify.toml`
> fica **na raiz** (com `base = "ecograd-web"`). O script `netlify:dev` cuida disso: ele executa a
> CLI a partir da raiz. Rodando de dentro da pasta, as funções respondem 404 e o `.env` é ignorado.

### Outros comandos

| Comando | O que faz |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` — checagem de tipos sem emitir |
| `npm run build` | Sincroniza dados, checa tipos e gera `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run sync:data` | Só copia as bases para `public/data/` |
| `npm run netlify:dev` | Frontend + funções em <http://localhost:8888> |
| `npm run verify:parity` | Compara os motores TS com o `backend.py` (requer o venv Python) |

---

## Arquitetura

```text
netlify.toml                    # na RAIZ do repositório, com base = "ecograd-web"
ecograd-web/
├── netlify/functions/
│   ├── lib/gemini.ts           # cliente Gemini (retry exponencial, fallback de modelos)
│   ├── gemini-synthesize.ts    # síntese epistemológica do perfil do PPG
│   ├── gemini-ontology.ts      # extração de teorias/métodos/ferramentas em lote
│   ├── gemini-chat.ts          # consultor acadêmico com streaming SSE → texto
│   ├── capes-proxy.ts          # proxy da API Sucupira/CAPES (contorna o CORS)
│   └── neo4j-query.ts          # consultas Cypher pré-registradas e parametrizadas
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
3. **Análise** — Dashboard, Motor de Busca, Foresight, Memética e Consultor IA.

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
- **Quociente Locacional** e **similaridade de Jaccard**: valores idênticos.

Duas diferenças conhecidas, ambas sem efeito sobre os números:

- **Louvain** é estocástico e os RNGs diferem; a comparação é feita por **modularidade**
  (0,523 no NetworkX vs. 0,533 no graphology — partições distintas, qualidade equivalente).
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

Defina as variáveis de ambiente (`GEMINI_API_KEY`, `NEO4J_URI`, `NEO4J_USERNAME`,
`NEO4J_PASSWORD`) no painel do site — elas vivem apenas no runtime das funções e **nunca**
entram no bundle do cliente.

> **Bases de dados**: os `.json.gz` (62 MB) são copiados para `public/data/` pelo `sync:data`
> durante o build, e por isso precisam estar versionados na raiz do repositório. Se preferir
> servi-los de um bucket externo, aponte `CAMINHO_BASE_PPG` / `CAMINHO_BASE_TCC` em
> `src/lib/data-loader.ts` para a URL correspondente.

### Limites do serverless

`gemini-ontology` processa no máximo **8 documentos por invocação** (com 4 s de intervalo entre
requisições, como no Python) para caber no tempo de execução das funções. O cliente encadeia
quantas invocações forem necessárias para o lote escolhido e exibe o ETA calculado a partir do
ritmo real.

---

## Segurança

- Nenhuma chave de API chega ao navegador: Gemini e Neo4j são acessados só pelas funções.
- `neo4j-query` **não aceita Cypher do cliente** — apenas o nome de uma consulta pré-registrada
  e parâmetros, que viajam como binds do driver.
- As respostas da IA passam por `markdownParaHtml`, que escapa o HTML antes de aplicar as
  marcações; links são restritos a `http(s)` e abrem com `target="_blank" rel="noopener noreferrer"`.
