# API pública do EcoGrad

O acervo indexado do EcoGrad é consultável por HTTP, sem instalar nada e sem baixar as bases. Não
há um serviço próprio no meio: o **PostgREST do Supabase** expõe diretamente as funções do
[`indice/schema.sql`](../ecograd-web/indice/schema.sql) que têm `grant execute … to anon`. É a mesma
API que a aplicação em <https://ecograd.netlify.app> usa — o cliente dela, com os contratos em
TypeScript, é [`indice-remoto.ts`](../ecograd-web/src/lib/indice-remoto.ts).

Para usar de dentro de um assistente (Claude, Cursor, qualquer cliente MCP), veja
[`ecograd-mcp/`](../ecograd-mcp/README.md), que embrulha estes mesmos endpoints.

---

## Endereço e chave

```
https://unipsxtosltcbtuwnikh.supabase.co
```

A chave é a publicável (`anon`) e **é pública por desenho**: o RLS é somente leitura e não existe
tabela de escrita alcançável. Ela já vai no JavaScript que o navegador baixa do site, e por isso o
`netlify.toml` a omite do scanner de segredos. Pegue o valor de `VITE_INDICE_CHAVE` no
[`.env.example`](../ecograd-web/.env.example) da sua instalação, no bundle publicado, ou do pacote
`ecograd-mcp`, que já vem com ele.

Toda chamada é `POST` para `/rest/v1/rpc/<função>`, com o corpo em JSON e três cabeçalhos:

```bash
curl -s -X POST "$ECOGRAD_URL/rest/v1/rpc/contar_acervo" \
  -H "apikey: $ECOGRAD_CHAVE" \
  -H "authorization: Bearer $ECOGRAD_CHAVE" \
  -H "content-type: application/json" \
  -d '{}'
```

```json
[{"registros":92331,"trabalhos_distintos":85567,"com_resumo":80415,"sem_resumo":11916,
  "colecoes":254,"base_version":"fd4bdfc5c4f3ad53",
  "unidade":"registros do acervo; trabalhos distintos deduplicam a mesma obra catalogada em mais de uma coleção"}]
```

Funções que devolvem `returns table` chegam como **lista de linhas**; as que devolvem `returns json`
chegam como **um objeto**. A coluna `unidade`, quando existe, diz o que foi contado — registro e
trabalho distinto são números diferentes, e a resposta que não diz qual está usando está errada.

### GET, para testar no navegador

Todas as funções do índice são `stable`, e o PostgREST aceita **GET** para elas: os argumentos vão na
query string e a chave também, como `?apikey=…`. Basta colar no navegador.

```
https://unipsxtosltcbtuwnikh.supabase.co/rest/v1/rpc/contar_acervo?apikey=<CHAVE>
https://unipsxtosltcbtuwnikh.supabase.co/rest/v1/rpc/top_macrotemas?limite=5&apikey=<CHAVE>
https://unipsxtosltcbtuwnikh.supabase.co/rest/v1/rpc/serie_anual?colecao_filtro=engenharia%20e%20gest%C3%A3o&apikey=<CHAVE>
```

Os tipos compostos também passam, contanto que venham codificados:

| Tipo | Como escrever na URL | Exemplo |
| --- | --- | --- |
| `jsonb` (`grupos`) | JSON, URL-encoded | `grupos=%5B%5B%22mem%C3%A9tica%22%5D%5D` para `[["memética"]]` |
| `text[]` (`ids`) | chaves do Postgres, URL-encoded | `ids=%7Bid1,id2%7D` para `{id1,id2}` |
| `text` com espaço ou acento | URL-encoded | `nome=freire%2C%20patricia` |

Duas observações. A chave na query string entra no histórico do navegador e nos logs de quem estiver
no caminho — para esta chave isso é irrelevante, porque ela já é pública, mas não transfira o hábito
para a `service_role`. E o navegador mostra JSON cru: instale uma extensão de formatação ou use
`curl … | python3 -m json.tool` se for ler bastante.

`POST` continua sendo o caminho de produção: a chave vai no cabeçalho, o corpo não tem limite de
comprimento de URL, e consulta SQL longa não cabe numa query string.

---

## Duas regras que a API impõe, não sugere

**Contagem nunca sai de similaridade.** `panorama_tematico` aceita um vetor para *escolher o que
ler*, mas todo total (`obras`, `por_ano`, `por_colecao`) vem do casamento léxico em SQL. A obra
achada só por significado volta marcada com `origem: "significado"` e contada à parte, em
`obras_so_por_significado`. Quem reproduz um total somando a amostra produz número errado.

**O índice é derivado, e pode estar atrás das bases.** Ele é reconstruído pelo GitHub Actions depois
da coleta semanal. `indice_meta` guarda o sha256 das bases que o geraram; o
[`manifest.json`](https://ecograd.netlify.app/data/manifest.json) publicado guarda os mesmos hashes.
Comparar os dois é a checagem de idade, e a aplicação se recusa a responder quando eles divergem:

```bash
curl -s "$ECOGRAD_URL/rest/v1/indice_meta?select=base_version,sha256_pos,sha256_tcc,sha256_lotes,gerado_em" \
  -H "apikey: $ECOGRAD_CHAVE" -H "authorization: Bearer $ECOGRAD_CHAVE"
```

Tabela vazia significa carga interrompida — sem o carimbo final, o índice não responde sobre meia
base.

---

## Panorama temático

A função central. O tema não é uma string: é uma lista de **grupos de sinônimos**, e os grupos se
combinam em E, os termos dentro de cada grupo em OU. `[["empreendedorismo","empreendedora"],
["feminino","mulheres"]]` vira *(empreendedorismo OU empreendedora) E (feminino OU mulheres)*. Isso
substitui o tesauro automático, que falhava justamente quando a pergunta não usava o vocabulário do
acervo.

```bash
curl -s -X POST "$ECOGRAD_URL/rest/v1/rpc/panorama_tematico" \
  -H "apikey: $ECOGRAD_CHAVE" -H "authorization: Bearer $ECOGRAD_CHAVE" -H "content-type: application/json" \
  -d '{"grupos":[["gestão do conhecimento"]],"amostra":20,"colecao_filtro":null,"ano_min":2015,"ano_max":null}'
```

| Parâmetro | Tipo | Padrão | O que faz |
| --- | --- | --- | --- |
| `grupos` | `string[][]` | — | grupos de sinônimos; termo com menos de 3 letras é ignorado |
| `amostra` | `int` | `20` | tamanho da amostra, preso entre 5 e 30 |
| `colecao_filtro` | `text` | `null` | casa por trecho do nome, sem acento |
| `ano_min`, `ano_max` | `int` | `null` | recorte temporal |
| `vetor` | `text` | `null` | vetor da pergunta como `"[0.1,0.2,…]"`, 768 dimensões |
| `similaridade_minima` | `real` | `0.70` | piso do vizinho semântico |

O retorno traz `consulta` (a `tsquery` efetiva), `obras`, `registros`, `obras_sem_resumo`,
`obras_so_por_significado`, `palavras_chave_casadas`, as distribuições `por_ano`, `por_colecao`,
`por_nivel`, `por_macrotema`, `principais_orientadores` — todas como pares `[rótulo, obras]` — e a
`amostra`, com cota por coleção proporcional à fatia de cada uma. Cada item da amostra tem
`documento_id`, `titulo`, `ano`, `colecao`, `nivel`, `url`, `autores`, `orientador`,
`palavras_chave`, `aderencia`, `similaridade`, `origem` e um `trecho` do resumo com os termos
destacados.

O campo `vetor` é o único que exige algo de fora: um embedding de 768 dimensões do modelo
`gemini-embedding-2`, no formato de consulta `task: search result | query: <pergunta>`. A aplicação
o obtém pela função [`embedding-consulta`](../ecograd-web/netlify/functions/embedding-consulta.ts),
que só aceita chamada do próprio site. Sem vetor a busca é puramente léxica, e é assim que os
clientes de fora devem usá-la.

> Tema muito amplo com o cache do banco frio pode passar dos 3 segundos de `statement_timeout`. A
> segunda tentativa costuma achar o cache quente — o cliente oficial repete uma vez antes de
> desistir.

---

## Ler o tema inteiro

`panorama_tematico` devolve uma amostra. Para percorrer **todas** as obras, são duas chamadas: uma
monta a lista de ids (a parte cara), as outras leem os resumos em páginas.

```bash
curl -s -X POST "$ECOGRAD_URL/rest/v1/rpc/obras_do_tema" … \
  -d '{"grupos":[["gestão do conhecimento"]],"colecao_filtro":null,"ano_min":null,"ano_max":null,"teto":400}'
# → {"consulta":"…","obras":1186,"com_resumo":1102,"teto":400,"ids":["…","…"]}

curl -s -X POST "$ECOGRAD_URL/rest/v1/rpc/resumos_das_obras" … -d '{"ids":["id1","id2"]}'
# → [{"documento_id":"…","titulo":"…","ano":2021,"colecao":"…","nivel":"…","url":"…",
#     "autores":["…"],"orientador":"…","resumo":"… (até 3.000 caracteres)"}]
```

Aqui **o vetor não entra**: dizer "li todas as obras do tema" sobre um conjunto que inclui vizinhos
semânticos seria falso. `teto` vai de 1 a 1.000 (padrão 400) e os ids vêm em ordem de aderência —
é essa ordem que numera as citações. `resumos_das_obras` corta em 200 ids por chamada sem avisar;
pagine em 100. Só obra com resumo utilizável volta.

Tema grande pode estourar os 3 segundos. O Postgres devolve `code: "57014"`, e a resposta certa é
restringir por coleção ou período, não insistir.

---

## SQL somente leitura

`consultar` executa **um** `SELECT` (ou `WITH … SELECT`) sobre views comentadas, com privilégio de
um papel separado (`consulta_leitor`), `statement_timeout` de 3 segundos e teto de 1.000 linhas. É
o mesmo caminho que o assistente do site usa para escrever SQL.

```bash
curl -s -X POST "$ECOGRAD_URL/rest/v1/rpc/consultar" … \
  -d '{"consulta_sql":"select nome, obras_orientadas, orientandos_distintos from pessoas where nome_tokens @> tokens_de_nome(''patricia de sa freire'')","limite":50}'
# → {"linhas":[…],"truncado":false,"limite":50}
```

Recusa qualquer coisa que não comece com `select`/`with`, que tenha `;`, ou que passe de 4.000
caracteres. O erro volta com a mensagem do Postgres, que é o que se usa para corrigir a consulta.

O `search_path` já inclui o schema `consulta`, então escreva `from obras`, não `from consulta.obras`.
**Leia o dicionário antes de escrever SQL** — ele é a definição viva do esquema:

```sql
select visao, descricao_visao, coluna, tipo, descricao from dicionario
```

| View | Uma linha por |
| --- | --- |
| `acervo` | o acervo inteiro (tamanho, versão, `ano_em_coleta`) |
| `obras` | obra deduplicada, sem o texto do resumo |
| `registros` | catalogação — a mesma obra aparece em mais de uma coleção |
| `registro_pessoas` | vínculo registro–pessoa com papel (Autor, Orientador, Co-orientador) |
| `registro_palavras_chave` | palavra-chave de cada registro |
| `pessoas` | pessoa unificada, com perfil |
| `pessoa_grafias` | grafia do acervo e a pessoa em que foi unificada |
| `pessoa_palavras_chave`, `pessoa_macrotemas`, `pessoa_colecoes` | atuação da pessoa por papel |
| `orientacoes` | par orientador–orientando |
| `colecoes`, `colecoes_por_ano` | coleção (PPG ou curso de TCC) e sua série anual |
| `palavras_chave`, `macrotemas` | termo e macrotema, com obras, anos, coleções |
| `rede` | métrica de rede por escopo (`acervo` ou `colecao`) |
| `dicionario` | coluna de cada view, com tipo e descrição |

Três armadilhas que as descrições repetem: contar obras é `count(distinct documento_id)`, não
`count(*)`; macrotema é classificação automática (NMF), não categoria oficial do programa; e
métricas de `rede` só se comparam dentro do mesmo escopo e coleção. O último ano da série está **em
coleta** — `ano_em_coleta` e a coluna `em_coleta` de `serie_anual` existem para que ninguém o trate
como produção fechada.

---

## Demais endpoints

| Função | Argumentos | Devolve |
| --- | --- | --- |
| `contar_acervo` | — | `registros`, `trabalhos_distintos`, `com_resumo`, `sem_resumo`, `colecoes`, `base_version`, `unidade` |
| `serie_anual` | `colecao_filtro` (opcional) | `ano`, `registros`, `em_coleta` |
| `recorte_da_colecao` | `nome` | `colecao`, `registros`, `trabalhos_distintos`, `sem_resumo`, `ano_min`, `ano_max`, `niveis` |
| `pessoa_no_indice` | `nome` | `grafia`, `papel`, `registros`, `trabalhos_distintos`, `colecoes`, `unidade` |
| `top_macrotemas` | `limite` (10) | `macrotema`, `registros`, `origem` |
| `registros_do_titulo` | `titulo_busca` | `documento_id`, `titulo`, `colecao`, `ano`, `url` |
| `buscar_texto` | `consulta`, `limite` (25) | `documento_id`, `titulo`, `aderencia` |
| `tesauro` | `consulta`, `termos` (8) | `lexema`, `na_semente`, `no_acervo`, `lift` |
| `consulta_expandida` | `consulta` | a `tsquery` expandida, como texto |
| `consulta_por_grupos` | `grupos` | a `tsquery` dos grupos, como texto |

`pessoa_no_indice`, `recorte_da_colecao` e `registros_do_titulo` casam por trecho, sem acento e sem
distinguir maiúsculas. A unificação de pessoas é automática e conservadora, **sem curadoria
humana**: a grafia devolvida é a canônica, e grafias diferentes da mesma pessoa podem ter escapado.

`tesauro` e `consulta_expandida` existem para inspecionar a expansão de vocabulário; a medição do
[ADR 003](ADR-003-O-QUE-A-MEDICAO-MUDOU.md) mostrou o limite delas — o tesauro é iniciado pelo mesmo
casamento léxico que deveria substituir, então semente pequena expande mal. É por isso que
`panorama_tematico` pede grupos explícitos.

---

## Limites, custo e uso justo

Não há autenticação por usuário nem cota por chamador: a chave é a mesma para todo mundo. O que
protege o banco são os limites das próprias funções — `statement_timeout` de 3 segundos, teto de
1.000 linhas em `consultar`, 1.000 ids em `obras_do_tema`, 200 em `resumos_das_obras`, amostra de no
máximo 30.

O índice roda num **Supabase Pro (US$ 25/mês)**, e a conta cresce com egress e compute, não com o
número de endpoints. Duas coisas mantêm isso previsível, e quem consome a API de fora deve respeitar
as duas:

- **Guarde o que não muda.** O acervo só se move uma vez por semana, depois da coleta de segunda.
  Cachear a resposta com `base_version` como chave é correto e barato; repetir `contar_acervo` a cada
  requisição não é.
- **Peça o recorte, não a base.** `resumos_das_obras` com 100 ids são ~270 KB. Varrer o acervo inteiro
  por essa API é o uso errado: as bases completas estão publicadas como `.json.gz` estáticos em
  `/data/`, servidos pelo CDN da Netlify, e é de lá que se baixa tudo.

Se o volume justificar, o passo seguinte é uma função na Netlify em frente ao Supabase (o free tier
cobre 125 mil invocações por mês), com limite por IP e a URL do banco escondida. Enquanto a API for
usada como acima, ela não acrescenta nada à conta atual.
