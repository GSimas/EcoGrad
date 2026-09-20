# ecograd-mcp

O acervo acadêmico da UFSC indexado pelo [EcoGrad](https://ecograd.netlify.app) — **92.331
registros** de teses, dissertações e TCCs, **85.567 trabalhos distintos** em **254 coleções** — como
ferramentas de um assistente.

Os dados vêm do [Repositório Institucional da UFSC](http://repositorio.ufsc.br/). O EcoGrad não
produz dado novo: coleta, normaliza e indexa o que já está depositado lá, e toda obra devolvida
preserva o link para a página original.

## Instalar

```bash
claude mcp add ecograd -- npx -y ecograd-mcp
```

Em qualquer outro cliente MCP, o mesmo comando:

```json
{ "mcpServers": { "ecograd": { "command": "npx", "args": ["-y", "ecograd-mcp"] } } }
```

Não há conta, chave nem configuração: o servidor roda na sua máquina, por stdio, e fala com o índice
público. A chave que ele embute é a publicável (`anon`), somente leitura — a mesma que o site já
entrega a qualquer navegador. Para apontar para outra instalação, defina `ECOGRAD_INDICE_URL` e
`ECOGRAD_INDICE_CHAVE`.

## Ferramentas

| Ferramenta | Para quê |
| --- | --- |
| `panorama_tematico` | o retrato exato de um tema: total, distribuições, orientadores e amostra com resumo — comece por aqui |
| `obras_do_tema` | os ids de **todas** as obras do tema, para ler o conjunto inteiro em vez da amostra |
| `resumos_das_obras` | resumo completo, em páginas, na ordem que numera as citações |
| `consultar_sql` | um `SELECT` somente leitura sobre pessoas, orientações, coleções, rede |
| `dicionario` | o esquema consultável — leia antes de escrever SQL |
| `contar_acervo` | tamanho do acervo e versão do índice |
| `pessoa` | quem é, em que papel, com quantas obras |
| `serie_anual` | registros por ano, com o ano ainda em coleta marcado |

O tema não é uma string: é uma lista de **grupos de sinônimos**, combinados em E entre grupos e em OU
dentro de cada grupo. `[["empreendedorismo","empreendedora"],["feminino","mulheres"]]` acha o que
`"empreendedorismo feminino"` sozinho não acharia, porque o acervo escreve de outro jeito.

## Três coisas que o assistente precisa respeitar

**Contagem vem de SQL, não da amostra.** `panorama_tematico` devolve o total exato *e* uma amostra de
até 30 obras. Somar a amostra dá número errado com aparência de certeza.

**Registro e trabalho distinto são números diferentes.** A mesma obra catalogada em duas coleções
conta duas vezes como registro. Em SQL, obras é `count(distinct documento_id)`.

**O último ano está em coleta.** Ele aparece marcado com `em_coleta`. Tratá-lo como produção fechada
inventa uma queda que não existe.

Além disso: macrotema é classificação automática (NMF) da base, não categoria oficial do programa; e
a unificação de grafias de nomes é automática e conservadora, sem curadoria humana.

## Frescor

O índice é derivado das bases e reconstruído pelo GitHub Actions depois da coleta semanal, nas
madrugadas de segunda. `contar_acervo` devolve o `base_version` que identifica as bases que o
geraram.

## Teste

```bash
node test.mjs
```

Verifica os contratos contra o índice real — é o que este pacote é, então não há o que testar sem
rede.

## Sob o capô

Não há servidor no meio: o cliente fala direto com o PostgREST do índice, que é uma API HTTP pública
documentada em [`docs/API.md`](https://github.com/GSimas/Ecology-Graph/blob/main/docs/API.md). Tudo o
que este pacote faz, um `curl` também faz.
