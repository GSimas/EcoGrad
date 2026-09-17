# ADR 003 — O que a medição desmentiu no plano do chat semântico

**Status:** aceito. Revisa o [ADR 001](ADR-001-CHAT-SEMANTICO.md) com o que as Etapas 1 e 2 mediram. Nenhuma etapa nova é autorizada aqui.

**Data:** 16/09/2026 · **Decisor:** Gustavo Simas (produto e operação).

## Contexto

O ADR 001 foi escrito antes de existir qualquer medida. Ele apostou que a lacuna temática do EcoGrad era **semântica** — que o acervo escreve "mulheres empreendedoras" onde o usuário pergunta "empreendedorismo feminino", e que resolver isso exigiria busca vetorial. Sobre essa aposta foram desenhadas cinco etapas, com o pgvector da Etapa 4 como o instrumento que fecharia a lacuna.

As Etapas 0, 1 e 2 foram executadas. Existe agora um conjunto de aferição de 25 perguntas, um gabarito temático assinado por uma pessoa para Q10 e Q11, e um índice Postgres que reproduz os gabaritos contáveis sem aproximação. Três coisas que o ADR 001 afirmava não sobreviveram a isso.

## O que a medição mostrou

### A lacuna era de indexação, não de semântica

Lendo os 25 primeiros resumos por `ts_rank` — a profundidade que a decisão D8 fixou:

| | revocação | precisão |
| --- | --- | --- |
| Busca por rótulo, que é o app hoje | 46% | 100% |
| Ponta a ponta na Etapa 1, com recorte carregado | 42% | 100% |
| **FTS sobre título e resumo, no índice** | **79%** | **76%** |

A precisão passa a meta de 70% e a revocação fica a um ponto dos 80%, **sem vetor nenhum**. O que faltava não era entender que "mulheres empreendedoras" e "empreendedorismo feminino" são o mesmo tema: era ter o texto do resumo indexado. O ADR 001 tinha esse fato na mão — mediu que 10 dos 31 registros só existem no resumo — e ainda assim atribuiu a lacuna à semântica.

### A síntese não era o problema

A rodada BYOK da Etapa 1 pontuou a resposta do modelo contra o gabarito: citação em toda afirmação, nenhuma obra fabricada, as sete afirmações conferidas uma a uma contra o resumo citado, todas sustentadas. A reprovação foi só em revocação, e por herança — **o modelo citou todas as obras que recebeu**. A qualidade da redação nunca foi o gargalo, e o formato "recorte antes da síntese" da decisão D7 se sustentou.

### O tesauro do acervo funciona, e mesmo assim não resolve

A expansão de consulta pode sair do próprio acervo, sem modelo: `tesauro()` toma como semente o que a busca por rótulo já alcança, colhe os lexemas dos resumos dessa semente e ordena por *lift*. Para Q10 ele monta sozinho `'empreendedor' & ('feminin' | 'mulh')`, que é a consulta que havia sido escrita à mão conhecendo a resposta, e entrega os mesmos 79% e 76%.

Só que ele falha onde deveria servir:

| | semente | revocação | precisão |
| --- | --- | --- | --- |
| Q10 "empreendedorismo feminino" | 11 obras | 79% | 76% |
| Q11 "mulheres empreendedoras" | 3 obras | 63% | 60% |

Sobreposição entre as duas paráfrases: 64%, contra 67% da busca literal — ou seja, nenhuma melhora na invariância a paráfrase, que era o defeito a corrigir.

A causa é estrutural: **o tesauro é iniciado pelo próprio casamento léxico que deveria substituir.** Quando o usuário usa o vocabulário do acervo, a semente é grande e a expansão é boa. Quando usa outro — o caso inteiro para o qual o recurso existe — a semente encolhe, e com três obras qualquer palavra presente em duas delas vira termo de expansão.

## Decisão

**R1 — A pergunta da Etapa 4 muda.** Não é mais "o vetor melhora a recuperação?", porque o FTS já entrega 79/76 nas perguntas com apoio léxico. É: **o vetor alcança o tema quando não existe apoio léxico nenhum?** É a dependência que o tesauro não remove, e é o que Q11 expõe. A porta da etapa passa a ser medida em Q11 e em perguntas cuja semente seja pequena, não em Q10.

**R2 — A régua sobe.** O ADR 001 mandava manter o pgvector "se melhorar o resultado das 25 perguntas em relação às etapas 2 e 3". O ponto de comparação passa a ser **79% de revocação e 76% de precisão em k=25**, não os 46% da busca por rótulo. Vetor que não superar isso é custo sem ganho, e a decisão é descartá-lo.

**R3 — O FTS com tesauro é o padrão até que algo o supere.** Está construído, custa zero por pergunta e não depende de serviço de modelo. As funções `tesauro`, `consulta_expandida` e `buscar_texto` são a recuperação corrente do EcoGrad, e qualquer alternativa é medida contra elas.

**R4 — Sem apoio léxico, o sistema declara em vez de inventar.** Quando a consulta não produz semente, `consulta_expandida` cai na forma literal e não fabrica vocabulário. Uma resposta pobre e declarada é preferível a um recorte amplo que parece completo — é a mesma razão pela qual o catálogo passou a declarar o que não sabe em vez de responder com busca por texto.

**R5 — Teto de custo corrigido para US$ 35/mês.** Os US$ 25 do ADR 001 supunham o plano Pro dedicado ao EcoGrad; a organização já rodava outro projeto e o crédito de computação estava tomado. O projeto dedicado `ecograd-indice` custa US$ 10/mês além do Pro. A alternativa gratuita — um schema dentro do projeto existente — foi descartada porque a chave anônima é do projeto e não do schema: publicá-la num app estático exporia dois acervos ao mesmo tráfego anônimo.

**R6 — A generalização não está medida, e isso é limite declarado.** Há um único tema com gabarito humano assinado. Todo número deste documento vale para empreendedorismo feminino, e o risco de ajustar o sistema a ele é real — a primeira versão da consulta de Q10 foi escrita por quem já sabia a resposta. Antes de decidir a Etapa 4, a aferição precisa de uma amostra cega de temas sorteados, medindo **apenas precisão**, que não exige denominador completo e portanto não exige triagem por tema.

## Consequências

**A favor.** O EcoGrad já responde panorama temático com precisão aceitável e custo zero por pergunta, sem depender de provedor de modelo para recuperar — só para redigir. A Etapa 3, que o ADR 001 tratava como opcional para a classe de pergunta de Q15, continua sendo a única saída para atributo transversal, e isso não mudou.

**Contra, e assumido.** Paráfrase continua produzindo recortes diferentes. Quem pergunta com o vocabulário do acervo recebe uma resposta melhor do que quem não o conhece — exatamente o usuário que o chat deveria servir. A Etapa 4 existe para isso, e se o vetor não resolver, o defeito permanece declarado em vez de resolvido.

**Sobre o ADR 001.** Ele erra no diagnóstico e acerta no método. As portas por etapa, a exigência de gabarito antes de infraestrutura e a regra de que o vetor nunca responde "quantos" foram o que permitiu descobrir o erro em vez de construir cinco etapas sobre ele. A decisão D2 — recuperação híbrida, com o vetor como uma ferramenta entre três — sai reforçada, não enfraquecida.
