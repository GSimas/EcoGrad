# ADR 001 — Chat semântico sobre o acervo completo

**Status:** proposto. Nenhuma infraestrutura criada, nenhum serviço contratado, nenhum dado enviado a terceiros, nenhum commit ou publicação decorrente desta decisão.

**Data:** 15/09/2026 · **Decisor:** Gustavo Simas (produto e operação) · Primeiro registro da série ADR do EcoGrad.

## Contexto

### O acervo, medido

Números apurados diretamente nas bases publicadas (`base_consolidada_ufsc.json.gz` e `base_tcc_ufsc.json.gz`), não estimados:

| Medida | Valor |
| --- | --- |
| Registros | 92.331 (49.915 pós-graduação · 42.416 TCC) |
| JSON bruto | ~216 MB (135,8 MB + 79,7 MB) |
| Caracteres de resumo | 157 milhões (~45 milhões de tokens) |
| Resumo médio | 2.133 caracteres na pós · 1.337 no TCC |
| Registros sem resumo utilizável (vazio ou < 200 caracteres) | 11.916 — **12,9%** |
| Macrotemas (NMF) | 2.325 |
| Palavras-chave distintas | 72.973 |
| Coleções | 254 |
| Intervalo de anos | 1970–2026 |
| Registros com URL de fonte | 92.331 — **100%** |

### A arquitetura atual

O EcoGrad é estático por decisão. `scripts/sync-data.mjs` deriva das bases os fragmentos por coleção, o índice global de busca (254.867 itens em 5,3 MB) e o índice de orientações; os nomes carregam hash de conteúdo e são servidos com `Cache-Control: immutable`. Todo o resto — índices invertidos, métricas, SNA, redes — é derivado no navegador a partir de `construirIndicesInvertidos(docs)`.

Existem duas funções Netlify com `GEMINI_API_KEY` no servidor (síntese e extração de ontologia) e o UFSCão (consultor de IA) em **BYOK**: a chave é do usuário e a requisição sai do navegador direto para um dos nove provedores configuráveis, sem passar pelos servidores do EcoGrad.

`netlify/functions/neo4j-query.ts` está desativado, com a justificativa registrada no próprio arquivo: "a aplicação atual usa arquivos JSON por coleção". Um backend sempre ligado já foi tentado e revertido neste projeto — precedente que pesa nesta decisão.

### A lacuna

A busca da tela inicial é léxica e opera sobre rótulos (título, nome, palavra-chave, macrotema). Nenhum resumo é legível antes de o usuário escolher e baixar coleções. Em consequência, duas classes de pergunta não têm resposta hoje:

- **Panorama temático** — "como os trabalhos na UFSC estão tratando empreendedorismo feminino?" O acervo escreve isso como "mulheres empreendedoras", "gênero e empreendedorismo", "empreendedorismo por mulheres". Casamento léxico de rótulo não alcança.
- **Atributo transversal** — "quais ferramentas estão sendo utilizadas no contexto de psicologia positiva?" Exige ler resumos e extrair um campo, em escala.

A segunda já tem metade da solução construída: a extração de ontologia produz por documento `Teorias e Modelos`, `Ferramentas e Artefatos` e `Métodos e Técnicas`, validados contra o resumo com `validarEvidencias` e `hashResumo`. Só que roda a pedido do usuário, em lotes de até mil, e **nenhum documento da base publicada vem enriquecido**.

## Decisão

Adotar **Supabase (Postgres + pgvector) como índice derivado e reconstruível** do acervo, e oferecer na tela inicial um alternador entre a busca atual e um **agente com ferramentas**, cuja resposta é primeiro um recorte navegável e depois uma síntese citada.

As regras abaixo são a decisão; cada uma responde a um risco concreto.

**D1 — O Postgres é índice, nunca fonte.** Os `.json.gz` na raiz continuam canônicos. O índice é reconstruível por um comando a partir das mesmas bases, e o banco carrega a `base_version` que o gerou. Se o banco cair, pausar ou divergir, o EcoGrad continua inteiro: apenas o chat fica indisponível, com aviso explícito, e a interface mostra a data e a versão do índice.

**D2 — Recuperação híbrida em três ferramentas, não busca vetorial isolada.** O agente escolhe entre `consultar_estruturado` (SQL parametrizado: contagens, agregados por ano, coleção e pessoa), `buscar_texto` (FTS do Postgres com dicionário português, que resolve nome próprio e termo exato) e `buscar_semantico` (pgvector). Texto e semântica são fundidos por RRF. **O vetor nunca responde "quantos"** — busca por similaridade devolve os k mais parecidos e jamais um total; deixar contagem por conta dele produz número errado com aparência de certeza, que é a pior falha possível num aplicativo cuja credibilidade vem de rastreabilidade.

**D3 — A unidade indexada é o documento deduplicado.** O acervo tem o mesmo trabalho em mais de um registro — o app já convive com isso ("este título aparece em N registros"). Sem identidade estável, a busca devolve o mesmo trabalho cinco vezes, o agente apresenta como cinco trabalhos e qualquer contagem infla. Tabela `documento` com id estável, tabela `registro` com o vínculo a coleção e URL. A deduplicação ocorre **antes** de gerar embeddings, o que também evita pagar pelo mesmo texto repetido.

**D4 — Enriquecimento ontológico passa para o pipeline.** Teorias, ferramentas e métodos extraídos uma vez para todo o acervo com resumo utilizável, preservando evidência literal e `resumo_sha256`, reaproveitando a validação e o fluxo de curadoria já existentes. Com isso, "quais ferramentas em psicologia positiva" deixa de ser paráfrase de resumo e passa a ser consulta contável com evidência — "a ferramenta X aparece em 12 trabalhos, aqui estão eles".

**D5 — Escopo: pós-graduação e TCC, os 92.331.** Os 11.916 sem resumo utilizável ficam **fora** do índice semântico e **dentro** das contagens, e a resposta declara a ressalva sempre que o recorte os incluir. Silenciar essa fração produziria panoramas que parecem completos e não são.

**D6 — Macrotema do NMF é faceta legítima de recorte**, por decisão de quem responde pelo modelo, sempre apresentado como classificação automática da base e nunca como categoria oficial do programa.

**D7 — Forma da resposta: recorte antes, síntese depois.** Primeiro o que é verificável — quantos trabalhos, em quais coleções, em que faixa de anos, quais macrotemas concentram o tema, lista clicável. Depois a síntese. Toda afirmação carrega citação clicável para o dossiê do próprio EcoGrad; sem fonte, o agente não escreve. "Não encontrei base suficiente para afirmar isso" é resposta aceitável e esperada.

**D8 — Profundidade em dois níveis.** O padrão lê de 15 a 25 resumos. Um botão "aprofundar" varre todos os documentos do recorte em map-reduce, anunciando antes o custo e o tempo. A quantidade de resumos lidos é a variável que domina o custo por pergunta — deixá-la implícita seria esconder do usuário o que ele está gastando.

**D9 — O agente age dentro do app:** carregar as coleções do recorte, abrir o dossiê de uma pessoa, mandar o resultado para o Motor de Busca. Sem isso, o chat viraria um aplicativo paralelo e não verificável ao lado do rigoroso.

**D10 — Custeio: BYOK permanece o padrão.** A chave continua sendo do usuário e não passa pelos servidores do EcoGrad. Sem login, sem histórico salvo. Teto de **US$ 25/mês** para infraestrutura. Um eventual modo de demonstração com chave do projeto **não está autorizado por esta decisão** e, se vier, exige trava de orçamento, limite por origem e uma decisão própria — o teto de US$ 25 não acomoda infraestrutura e consumo de modelo ao mesmo tempo.

**D11 — A unificação de pessoas sobe para o servidor.** Deixa de ser preferência por navegador e passa a ser curadoria versionada no repositório, aplicada tanto na geração dos JSON estáticos quanto na do índice — com justificativa registrada, como já se faz na curadoria por termo. A fusão local continua existindo como camada pessoal por cima da canônica. Sem isso, o agente contaria "Patricia de Sa" e "Patricia de Sá Freire" como duas pessoas, contradizendo o que o usuário vê na tela.

## Modelo de dados (esboço)

```
documento(id, titulo, ano, nivel_academico, macrotema, resumo, resumo_sha256,
          resumo_utilizavel, base_version, tsv)         -- tsv: FTS português
registro(documento_id, colecao, url, programa_origem)    -- 1..N por documento
pessoa(id, nome_canonico)                                -- curadoria versionada
pessoa_grafia(pessoa_id, grafia)
documento_pessoa(documento_id, pessoa_id, papel)         -- Autor|Orientador|Co-orientador
ontologia(documento_id, categoria, termo, evidencia, resumo_sha256)
embedding(documento_id, vetor halfvec(512))              -- HNSW
```

Três funções expostas, nenhuma escrita: `consultar_estruturado`, `buscar_texto`, `buscar_semantico`. A chave anônima do Supabase é pública num app estático, então RLS somente leitura, nenhuma tabela de escrita alcançável e limite de requisições.

## Custos

Uma vez, na implantação:

| Item | Estimativa |
| --- | --- |
| Embeddings do acervo (~45M tokens, modelo pequeno de 512 dimensões) | **US$ 1** |
| Extração ontológica dos 80.415 documentos com resumo utilizável | **US$ 15 a US$ 80**, conforme o modelo (Flash-Lite ou Flash) |

Recorrente:

| Item | Estimativa |
| --- | --- |
| Supabase Pro (8 GB) | **US$ 25/mês** |
| Atualização semanal incremental (embeddings + ontologia dos novos) | centavos |
| Por pergunta, leitura padrão de 20 resumos | ~US$ 0,006 — **pago pelo usuário (BYOK)** |
| Por pergunta com "aprofundar" sobre ~300 documentos | ~US$ 0,06 a 0,12 — **pago pelo usuário** |

Dimensionamento do armazenamento: 92.331 vetores de 1.536 dimensões em `float32` ocupariam 567 MB só de vetores; em `halfvec(512)` caem para **95 MB**, e com índice HNSW e os textos o banco fica na casa de 300 a 400 MB. O plano gratuito do Supabase tem 500 MB e caberia, mas **pausa após sete dias sem uso** — inviável para um aplicativo público, daí o plano pago.

Total para o projeto: **US$ 25/mês mais US$ 16 a 81 de partida**, dentro do teto definido. Preços de provedor mudam; confirmar antes de contratar.

O custo relevante não é o financeiro. É operacional: um serviço sempre ligado, um pipeline de sincronização, uma segunda representação do acervo que pode divergir, e o trabalho de avaliar se a recuperação está boa.

## Alternativas descartadas

**Só pgvector, sem ferramentas estruturadas.** Descartada por D2: responderia contagem errada com confiança. A maioria das perguntas que o EcoGrad recebe é estruturada, não semântica.

**Permanecer inteiramente estático, com índice vetorial quantizado baixável.** 92.331 vetores de 256 dimensões em `int8` somam ~24 MB, comparável aos arquivos que o app já baixa, e a busca rodaria num Web Worker — zero custo e zero operação. Descartada como solução principal porque exige o download antes da primeira pergunta e não oferece agregação SQL sobre o acervo inteiro. **Guardada como plano B** caso o Supabase seja abandonado; D1 mantém essa saída aberta.

**Postgres como fonte de verdade.** Descartada por D1 e pelo precedente do Neo4j desativado.

**Reativar o Neo4j já presente no repositório.** Tem índice vetorial, mas reabriria um caminho que o próprio projeto reverteu e não entrega FTS em português nem agregação SQL com a mesma facilidade.

**Serviço de vetor dedicado (Qdrant, Vectorize, Weaviate).** Um serviço a mais ao lado do Postgres, sem ganho perceptível na escala de 92 mil vetores.

**Chat apenas sintético, sem recorte.** Descartada por D7: contraria a rastreabilidade que sustenta o aplicativo.

## Consequências

**Ganhos.** Duas classes de pergunta passam a ter resposta. O enriquecimento ontológico, hoje um recurso manual de alcance mínimo, vira patrimônio do acervo inteiro e alimenta também Foresight e Memética. A unificação de pessoas deixa de ser preferência isolada e se torna curadoria compartilhada.

**Novo modo de falha.** O chat depende de um serviço externo. A mitigação é D1: degradação declarada, com o resto do app intacto.

**Deriva.** A base muda semanalmente e o índice pode ficar atrás. A `base_version` e a data ficam visíveis na interface; a resposta declara sobre qual versão fala. Não haverá tentativa de garantir sincronia perfeita.

**Ninguém opera.** Com operação zero declarada, o projeto é dimensionado para reconstrução em um comando e para tolerar desatualização — não para alta disponibilidade nem para plantão. Sem alerta automático, a interface precisa mostrar quando o índice envelheceu.

**A unificação passa a ser decisão coletiva.** Fundir dois nomes passará a valer para todos os usuários. Exige revisão humana com justificativa e trilha, no mesmo padrão da curadoria por termo, e um caminho de reversão.

**Privacidade.** O acervo é público e vem do repositório institucional; não há conta, histórico nem dado pessoal de usuário armazenado. Em BYOK, a pergunta do usuário vai para o provedor **dele** — isso precisa estar dito na interface, não apenas aqui.

**Qualidade não medida é qualidade não existente.** Sem o conjunto de aferição da Etapa 0, não haverá como afirmar que o chat responde bem, nem que o pgvector acrescentou algo sobre a busca textual.

## Plano por etapas, com porta de saída

**Etapa 0 — Aferição.** 25 perguntas com resposta conhecida, incluindo as duas do briefing. Sem infraestrutura. *Porta: se não for possível escrever o gabarito de uma pergunta, ela não deve ser prometida ao usuário.*

**Etapa 1 — Chat com ferramentas sobre o recorte já carregado.** Zero infraestrutura, aproveitando os índices invertidos locais. Valida o alternador, o formato recorte-antes-da-síntese e as ações no app. *Porta: se o formato não convencer aqui, nenhum banco resolve.*

**Etapa 2 — Índice no Supabase apenas com metadados, FTS e agregados.** Sem vetor. Já responde quem, quantos e quando sobre o acervo inteiro. Mede também quanta duplicação existe de fato. *Porta: medir quantas das 25 perguntas ficam resolvidas só com isso.*

**Etapa 3 — Ontologia no pipeline.** Ferramentas, teorias e métodos viram consulta estruturada. *Porta: amostra curada por humano antes de publicar o enriquecimento.*

**Etapa 4 — pgvector.** `halfvec(512)` e fusão RRF. *Porta: só permanece se melhorar o resultado das 25 perguntas em relação às etapas 2 e 3.*

**Etapa 5 — Unificação canônica** aplicada nos dois lados da geração.

## O que esta decisão não autoriza

Contratar serviço, provisionar banco, enviar qualquer parte do acervo a terceiros, criar chave, alterar código de produção ou publicar. Cada etapa acima é aprovada separadamente.

## Pendências do decisor

- Confirmar os preços vigentes de Supabase e dos modelos antes da Etapa 2.
- Decidir, em ADR próprio, se haverá modo de demonstração com chave do projeto.
- Definir o responsável pela revisão humana da ontologia (Etapa 3) e das fusões canônicas (Etapa 5), hoje sem dono declarado.
