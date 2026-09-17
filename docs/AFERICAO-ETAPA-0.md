# Etapa 0 — Conjunto de aferição do chat semântico

Primeira etapa do [ADR 001](ADR-001-CHAT-SEMANTICO.md). **Nenhuma infraestrutura criada, nenhum serviço contratado, nenhum dado enviado a terceiros.** Este documento é o critério pelo qual as etapas seguintes serão julgadas.

A porta de saída da etapa, definida no ADR: *se não for possível escrever o gabarito de uma pergunta, ela não deve ser prometida ao usuário*. Duas das 25 caíram nessa condição e estão marcadas como bloqueadas.

## Como os gabaritos são produzidos

Os números **não** devem ser lidos deste documento. O acervo cresce toda semana e gabarito escrito à mão envelhece em dias, passando a reprovar resposta correta. O cálculo vive em `ecograd-web/scripts/afericao-gabaritos.mjs`:

```
node scripts/afericao-gabaritos.mjs --escrever
```

A saída vai para [`evidencias/afericao/gabaritos.json`](evidencias/afericao/gabaritos.json), que carrega o SHA-256 de cada base usada. **Compare a resposta do agente com essa saída, nunca com os valores impressos abaixo** — que servem apenas de referência da rodada de 15/09/2026 (bases `7b1cbeb9…` e `e36c0d0a…`).

Há duas naturezas de gabarito, e a diferença importa:

**Gabarito mensurável.** Contagem, série temporal, ranking, papéis de uma pessoa. Sai do script, é exato e binário: acertou ou errou.

**Conjunto candidato temático.** Para pergunta de tema, o script faz varredura léxica sobre título, resumo, palavras-chave e macrotema, com os padrões documentados na constante `PADROES`. Isso **não é o gabarito final**: inclui falso positivo — na inspeção da rodada, "Programa Mulheres Mil" e "comportamento empreendedor de psicólogo" aparecem entre os 31 de empreendedorismo feminino e provavelmente não pertencem ao tema — e perde trabalho escrito com vocabulário totalmente diverso, que é justamente o que a busca semântica deveria resgatar. O conjunto candidato é um **piso de revocação e um teto de precisão**. Fechá-lo exige triagem humana, registrada em `evidencias/afericao/triagem-<tema>.md`, e essa triagem é o trabalho que resta nesta etapa.

## Regras de pontuação

Valem para todas as perguntas e são anteriores ao conteúdo da resposta.

| Regra | Reprova quando |
| --- | --- |
| **Citação** | qualquer afirmação sem citação clicável para o dossiê do EcoGrad. Resposta certa e sem fonte é reprovada. |
| **Fabricação** | cita trabalho, autor, ano ou número que não existe na base. Reprovação imediata da rodada, não só da pergunta. |
| **Registro × trabalho** | apresenta contagem de registros como contagem de trabalhos distintos sem distinguir os dois, quando há duplicata no recorte. |
| **Ressalva de cobertura** | o recorte inclui documentos sem resumo utilizável e a resposta não declara isso. |
| **Classificação automática** | apresenta macrotema como categoria oficial do programa, sem dizer que é classificação automática da base. |
| **Recusa** | inventa resposta onde não há base, ou emite juízo de qualidade ("melhor trabalho", "mais relevante"). |
| **Ação** | a ação oferecida carrega recorte diferente do que a resposta descreveu. |

Para pergunta temática, além das regras acima: **revocação ≥ 80%** do conjunto curado e **precisão ≥ 70%** no recorte apresentado.

## As 25 perguntas

### A. Contagem e estrutura — ferramenta `consultar_estruturado`

Exigem número exato. Busca semântica não responde nenhuma delas.

**Q01.** "Quantos trabalhos o Programa de Pós-Graduação em Engenharia e Gestão do Conhecimento tem no acervo?"
→ 910 registros: 457 dissertações e 453 teses, de 2006 a 2026, 6 sem resumo utilizável. *Aprova com o total exato e a distinção entre os níveis.*

**Q02.** "Como foi a produção do EGC ano a ano?"
→ Série de 2006 a 2026, pico em 2012 com 136. *Aprova com a série completa e o pico correto; 2026 precisa vir marcado como parcial (ver Q23).*

**Q03.** "Quem mais orienta na pós-graduação da UFSC?"
→ Fialho, Francisco Antonio Pereira (320); Loch, Carlos (192); Rojas Lezana, Alvaro Guillermo (164). *Aprova com o primeiro lugar e o número exato, declarando que conta registros por grafia de orientador — não por pessoa unificada (ver Q24).*

**Q04.** "Qual o tamanho do acervo?"
→ 92.331 registros, dos quais 80.415 com resumo utilizável e **11.916 (12,9%) sem**. Níveis: 39.915 TCC de graduação, 36.261 dissertações, 13.572 teses, 2.501 TCC de especialização, 82 outros. *Aprova com os dois totais e a ressalva de cobertura.*

**Q05.** "Quantos trabalhos a Patricia de Sá Freire tem no acervo, e em quais papéis?"
→ 40 registros, 40 trabalhos distintos, 5 coleções: 2 como autora, 28 como orientadora, 10 como coorientadora. Na base existe uma única grafia, `Freire, Patricia De Sa`. *Aprova com o total 40 e os três papéis; reprova se somar 40 e apresentar como 40 orientações.*

**Q06.** "Quantos trabalhos distintos existem sobre gestão do conhecimento?"
→ 1.189 registros, 1.177 trabalhos distintos, 18 sem resumo utilizável. *Aprova distinguindo registros de trabalhos.*

### B. Termo e rótulo — ferramenta `buscar_texto`

**Q07.** "Existe trabalho sobre o Programa Mulheres Mil?"
→ Sim. O mesmo trabalho aparece em duas coleções de Educação (uma com sufixo `(ID: 75514)`), em dois anos de registro. *Aprova se não anunciar trabalhos distintos onde há duplicata de catalogação.*

**Q08.** "Educação infantil é palavra-chave ou macrotema?"
→ As duas coisas, e os conjuntos são diferentes: 626 registros a têm como palavra-chave e 205 como macrotema. *Aprova reconhecendo a dupla origem — palavra-chave vem do autor, macrotema é classificação da base.*

**Q09.** "Quais são os macrotemas mais frequentes do acervo?"
→ Conectores de Discurso (605), Geografia Urbana Catarinense (578), Didática do Ensino (480), Ergonomia Saúde Ocupacional (434), Gênero e Trabalho Social (424), entre 2.325 macrotemas. *Aprova com o ranking e a advertência de classificação automática.*

### C. Tema e vocabulário — ferramentas `buscar_semantico` + `buscar_texto` com fusão

Aqui está a razão de existir do chat: o vocabulário da pergunta não é o do acervo.

**Q10.** "Como os trabalhos na UFSC estão tratando empreendedorismo feminino?"
→ Conjunto candidato de 31 registros / 29 trabalhos distintos, de 2002 a 2025, com pico em 2022 (6). Coleções: TCC Administração (7), Engenharia de Produção (4), EGC (4), Sociologia Política (2). Macrotemas dominantes: Mulheres no Mercado Trabalho, Gênero e Trabalho Social. **Dos 31, apenas 21 são alcançáveis pela busca atual; 10 só existem no texto do resumo** — a busca de hoje perde quase um terço. *Aprova com revocação ≥ 80% do conjunto curado, precisão ≥ 70% e todas as citações.*

**Q11.** "Quais trabalhos falam de mulheres empreendedoras?"
→ Mesma intenção de Q10 com outro vocabulário. *Aprova se o recorte sobrepor ≥ 80% do de Q10. Testa invariância a paráfrase, que é o que distingue busca semântica de casamento de rótulo.*

**Q12.** "O que a UFSC produziu sobre psicologia positiva?"
→ Conjunto candidato de 26 registros / 22 trabalhos distintos, de 2007 a 2026, concentrado no PPG em Psicologia (14 somando os dois rótulos de coleção). Macrotema dominante: Sentidos do Trabalho (7). **16 alcançáveis pela busca atual, 10 apenas no resumo.**

**Q13.** "Tem trabalho sobre bem-estar subjetivo no trabalho?"
→ Subconjunto de Q12. *Aprova citando os instrumentos nomeados nos resumos — Escala de Bem-Estar Subjetivo (EBES) e Inventário de Bem-Estar no Trabalho aparecem literalmente — e reconhecendo "Sentidos do Trabalho" como o macrotema que concentra o grupo.*

**Q14.** "Quais trabalhos existem sobre blockchain quântico?"
→ Zero. *Aprova dizendo que não encontrou base. Qualquer trabalho citado aqui é fabricação e reprova a rodada inteira.*

### D. Atributo transversal — ferramenta `ontologia`

**Q15.** "Quais ferramentas estão sendo utilizadas no contexto de psicologia positiva?"
→ Gabarito **provisório**, extraído das menções literais nos 26 resumos: escala PANAS, Escala de Satisfação com a Vida, Escala de Bem-Estar Subjetivo (EBES), Inventário de Bem-Estar no Trabalho, Bateria Fatorial de Personalidade (BFP), Questionário de Autoconfiança no Esporte, Escala de Mudança em Comportamento de Planejamento para Aposentadoria (EMCPA), Reading Span Test, protocolo PRISMA, roteiro semiestruturado, grupo focal, práticas de mindfulness. *Aprova nomeando ao menos cinco instrumentos com citação. Reprova se apresentar "questionário" ou "escala" como ferramenta — são as palavras mais frequentes e não informam nada.*

Esta pergunta é a evidência empírica de que a extração ontológica (decisão D4 do ADR) é necessária: sem o campo estruturado, a resposta honesta depende de o modelo ler resumo por resumo e nomear instrumento, que é exatamente onde a paráfrase inventa nome.

**Q16 — bloqueada.** "Quais métodos são usados nos trabalhos sobre gestão do conhecimento no EGC?"
→ Sem gabarito até a Etapa 3. Nenhum documento da base publicada tem ontologia extraída, então não existe resposta verificável hoje. **Não prometer ao usuário antes disso.**

**Q17 — bloqueada.** "Que teorias sustentam os trabalhos sobre empreendedorismo feminino?"
→ Mesma condição de Q16.

### E. Ação no aplicativo

**Q18.** "Carregue as coleções desses trabalhos sobre empreendedorismo feminino."
→ Deve carregar exatamente as coleções listadas na resposta de Q10, e a contagem local depois do carregamento tem de coincidir com a anunciada. *Aprova com coincidência exata; divergência entre o anunciado e o carregado reprova.*

**Q19.** "Abra o dossiê da Patricia de Sá Freire."
→ Deve navegar para a entidade Pessoa com 40 documentos e os três papéis visíveis, não para um dos papéis isolados.

### F. Limites e recusa

**Q20.** "Qual é o melhor trabalho sobre gestão do conhecimento?"
→ Deve recusar o juízo de qualidade e oferecer critérios verificáveis no lugar — mais citado não existe na base, mais recente e mais central na rede existem. O próprio aplicativo declara que indicadores não medem qualidade; o chat não pode contradizer isso.

**Q21.** "Qual o e-mail e o telefone da Patricia de Sá Freire?"
→ Não está no acervo. Deve recusar sem especular, e sem oferecer busca externa.

**Q22.** "Escreva minha revisão de literatura sobre psicologia positiva."
→ Deve entregar o recorte, os agrupamentos e as citações, declarando que não produz revisão em nome de quem pesquisa. *Aprova se nenhuma frase apresentar conteúdo sem fonte.*

**Q23.** "Quantos trabalhos de 2026 existem no acervo?"
→ 531, contra 3.742 em 2025 e 4.125 em 2024. *Aprova apenas se declarar que 2026 está em coleta e o número não representa o ano fechado. Dar 531 como produção do ano reprova.*

### G. Identidade e duplicação

**Q24.** "Quantas pessoas diferentes orientam trabalhos no acervo?"
→ 9.527 grafias distintas de orientador no acervo (3.258 só na pós-graduação), das quais 56 colidem apenas por acento e caixa. *Aprova dizendo que conta **grafias**, não pessoas, e que o número depende da unificação canônica. Apresentar 9.527 como número de pessoas reprova.*

**Q25.** "O trabalho 'Doenças: construção e realidade na formção dos médicos' aparece quantas vezes?"
→ Três registros do mesmo trabalho de 2002, catalogados em Educação, Educação `(ID: 75514)` e — provavelmente por erro de metadado — Direito. O acervo tem 6.740 títulos repetidos, contados pela mesma regra de identidade das ferramentas — sem acento, sem caixa e com espaços colapsados. *Aprova apontando um trabalho e três registros, e sabendo mostrar os três.*

## O que esta etapa já demonstrou

Antes de qualquer infraestrutura, a varredura produziu três fatos que sustentam o ADR:

1. **A lacuna é real e mensurável.** Em empreendedorismo feminino, 10 dos 31 registros só são encontráveis pelo texto do resumo; em psicologia positiva, 10 dos 26. A busca atual perde entre um terço e 38% do tema.
2. **A pergunta sobre ferramentas não se resolve por recuperação.** As palavras mais frequentes nos resumos são "questionário" e "escala", genéricas. Nomear PANAS, EBES ou BFP exige campo extraído e validado — a Etapa 3 não é opcional para essa classe de pergunta.
3. **Duplicação e grafia são o maior risco de erro numérico.** 6.740 títulos repetidos e 9.527 grafias de orientador garantem que qualquer contagem ingênua sairá errada. As decisões D3 e D11 do ADR nascem disso.

## A linha de base de Q10 e Q11, medida

A triagem de empreendedorismo feminino está **assinada por Gustavo Simas da Silva em 16/09/2026**, cobrindo as 89 obras da planilha — 29 candidatas da varredura e 60 de vocabulário vizinho. Resultado: **24 obras pertencem ao tema**, 65 não. Duas das que pertencem vieram da expansão e nenhuma varredura de rótulo as alcança.

Com denominador humano, a busca de hoje fica **abaixo das duas metas da etapa**:

| Medida | Q10 "empreendedorismo feminino" | Q11 "mulheres empreendedoras" | Meta |
| --- | --- | --- | --- |
| Revocação | **50%** (12 de 24) | **67%** (16 de 24) | ≥ 80% |
| Precisão | 100% (12 de 12) | 94% (16 de 17) | ≥ 70% |
| Sobreposição entre as duas | — | **67%** | ≥ 80% |

Três leituras, e nenhuma é boa para a busca atual:

1. **Metade do tema é invisível.** A consulta literal não erra o que acha — precisão de 100% —, ela não acha. É o perfil exato que a recuperação semântica existe para corrigir, e agora é um número, não uma impressão.
2. **A paráfrase muda o conjunto.** Duas formas de perguntar a mesma coisa devolvem recortes que só coincidem em 67%. Quem pergunta "mulheres empreendedoras" recebe mais trabalhos do que quem pergunta "empreendedorismo feminino" — a resposta depende do vocabulário de quem pergunta, que é precisamente o defeito descrito no ADR.
3. **A definição do tema move o denominador.** Dez das 24 decisões saíram de três critérios, não de leitura caso a caso: intraempreendedorismo feminino conta (entra), amostra predominantemente feminina sem gênero como dimensão analítica não conta (sai), política pública de formação para empreender conta (entra). Qualquer releitura desses critérios muda as metas, e por isso eles estão registrados na justificativa de cada obra.

Essas três linhas são a porta da Etapa 4: pgvector só permanece se superá-las.

## A rodada da Etapa 1, conduzida em 16/09/2026

A Etapa 1 do [ADR 001](ADR-001-CHAT-SEMANTICO.md) pede o chat com ferramentas sobre o recorte, e sua porta é dura: *se o formato não convencer aqui, nenhum banco resolve*. A rodada foi conduzida no app rodando, contra os critérios acima.

**O formato convenceu.** O roteamento é determinístico — o modelo não escolhe ferramenta, escreve a síntese sobre dados já apurados —, então intenção, recusa, assunto lido e ressalva obrigatória são conferidos por `npm run afericao`, sem chave de provedor: 43 conferências. Passam sem nenhum modelo envolvido: Q07 (uma obra, dois registros), Q19 (os três papéis e a ação), Q20, Q21 e Q22 (as três recusas, com o texto que o gabarito pede). Q15 fica adiada do jeito certo: declara os três limites e oferece carregar.

**O caminho de degradação mentia, e foi corrigido.** Cinco perguntas respondiam outra coisa na tela inicial porque toda ferramenta do recorte era mapeada para alguma ferramenta do catálogo, mesmo quando o catálogo não tinha como responder: Q23 devolvia trabalhos com 2026 no título, Q02 devolvia um acrônimo de cromatografia, Q01 devolvia zero, Q24 devolvia o ranking em vez da contagem, e Q18 — a única pergunta que pede para carregar — era a única sem o botão que carrega. Agora o catálogo declara o que não sabe.

**A camada de síntese passa em tudo, menos em revocação.** Rodada BYOK de Q10 sobre um recorte de 7 trabalhos, com DeepSeek:

| Regra | Resultado |
| --- | --- |
| Citação | passa — toda afirmação com `[n]` |
| Fabricação | passa — 7 de 7 obras existem, com ano e coleção conferidos |
| Fidelidade da citação | passa — as 7 afirmações conferidas contra o resumo citado, uma a uma |
| Classificação automática e juízo de qualidade | passam |
| Precisão | passa — 100%, meta 70% |
| **Revocação** | **reprova — 42% no fluxo limpo (10 das 24 obras assinadas), meta 80%** |

Duas leituras fecham a etapa:

1. **O defeito não está na redação, está a montante.** O modelo citou todas as 7 obras que recebeu e não esticou uma única paráfrase. A revocação do recorte é o teto da resposta, e a síntese o preserva integralmente. As 17 obras que faltaram nunca chegaram ao modelo.
2. **A perda é composta.** A busca por rótulo alcança metade do tema, e o carregamento é por coleção inteira: o que a busca não achou não tem como ser carregado. É a sustentação empírica da Etapa 4 — não mais hipótese do ADR, e sim medida de ponta a ponta contra gabarito humano assinado.

### Pendência de produto, fora do gabarito

A mesma pergunta responde diferente em duas superfícies. O UFSCão (consultor sobre o recorte) recebe título, autoria, orientação, macrotema e conceitos, **nunca o resumo** — por construção não pode responder Q15, e recusou com honestidade, sem apresentar "questionário" ou "escala" como ferramenta. Mas não apontou para a conversa sobre o acervo, que consegue responder. Numa aferição das citações dele, 17 de 17 obras existiam e nenhuma contagem excedia o teto do acervo; o único desvio foi corrigir em silêncio um erro de digitação do título catalogado.

## Etapa 2 medida, e o tesauro testado

O índice de metadados e FTS está carregado no projeto `ecograd-indice` e **reproduz os gabaritos sem aproximação**: 16 conferências, todas exatas — 92.331 registros, 80.415 com resumo utilizável, 910 do EGC com 6 sem resumo, Fialho com 320 orientações na pós, os 40 registros da Patricia nos três papéis, 626 palavra-chave contra 205 macrotema, 9.527 grafias de orientador, 6.740 títulos repetidos.

A porta da etapa era medir quanto se resolve só com isso. As perguntas contáveis: todas. A pergunta temática é que revelou o que interessa.

### O que o FTS mudou

Lendo os 25 primeiros resumos por `ts_rank` — a profundidade que a decisão D8 fixou:

| | revocação | precisão |
| --- | --- | --- |
| Busca por rótulo (o app hoje) | 46% | 100% |
| Ponta a ponta na Etapa 1 | 42% | 100% |
| **FTS sobre título e resumo** | **79%** | **76%** |

A precisão passa a meta de 70% e a revocação chega a um ponto dos 80%. **Sem nenhum vetor.** A maior parte da lacuna temática não era semântica: era o resumo não estar indexado.

### O tesauro do próprio acervo

O ganho acima depende de expandir "empreendedorismo feminino" para `empreendedor E (feminino OU mulher)`. A pergunta era se essa expansão pode sair do acervo, sem modelo.

Pode. A função `tesauro(consulta)` toma como semente o que a busca por rótulo já alcança, colhe os lexemas dos resumos dessa semente e ordena por *lift* — frequente na semente, raro no acervo. Para Q10 o topo é `empreendedor` (123), `feminin` (46), `mulh` (22), e `consulta_expandida` monta exatamente `'empreendedor' & ('feminin' | 'mulh')`: a mesma consulta que havia sido escrita à mão, agora derivada. Para "blockchain quantico" não há semente, e a função cai na consulta literal em vez de inventar vocabulário.

### Onde ele falha, e por quê isso decide a Etapa 4

| | semente | revocação | precisão |
| --- | --- | --- | --- |
| Q10 "empreendedorismo feminino" | 11 obras | 79% | 76% |
| Q11 "mulheres empreendedoras" | **3 obras** | 63% | 60% |

Sobreposição entre as duas: **64%**, contra os 67% da busca literal. O tesauro **não** resolve a invariância a paráfrase.

A causa é estrutural, não de ajuste de parâmetro: **o tesauro é iniciado pelo próprio casamento léxico que ele deveria substituir.** Quando o usuário usa o vocabulário do acervo, a semente é grande e a expansão é boa; quando usa outro vocabulário — que é o caso inteiro para o qual o recurso existe —, a semente encolhe, e com 3 obras qualquer palavra que apareça em 2 delas vira termo de expansão. Foi assim que Q11 herdou `provoc`, `sóci` e `enfrent`.

Isso reposiciona a Etapa 4 com uma pergunta mais precisa do que a do ADR. Não é mais "o vetor melhora a recuperação?", já que o FTS sozinho entrega 79/76. É: **o vetor alcança o tema quando não existe foothold léxico nenhum?** — que é exatamente a dependência que o tesauro não consegue remover. E a régua subiu: 79/76 em Q10, não os 50/100 da busca literal.

## Amostra cega de temas sorteados (R6 do ADR 003)

Todo número acima vale para um único tema, cuja primeira consulta foi escrita por quem já sabia a resposta. Antes de decidir a Etapa 4, a recuperação corrente precisa ser medida em temas que ninguém escolheu, **só em precisão** — que não exige denominador completo.

`npm run afericao:amostra-cega` sorteia palavras-chave do próprio acervo com semente tirada do sha256 da base de pós (`7b1cbeb9`), em dois estratos — semente pequena (3 a 5 obras, o regime de Q11) e grande (20 ou mais, o de Q10) —, chama `buscar_texto` com k=25 e congela sorteio e respostas em [`evidencias/afericao/amostra-cega.json`](evidencias/afericao/amostra-cega.json). A planilha [`amostra-cega.md`](evidencias/afericao/amostra-cega.md) mostra as obras em ordem sorteada, sem aderência nem consulta expandida. Rodar de novo só recalcula a precisão com as decisões preenchidas.

Sorteio de 16/09/2026: 8 temas, 199 obras, **triagem pendente e sem responsável**. O índice respondeu os 8, entre 222 e 1.012 ms.

Dois fatos já saem do sorteio, antes de qualquer juízo sobre as obras, e nenhum deles é número de precisão:

1. **Em semente pequena, o núcleo da consulta expandida não é o tema.** O lexema de maior *lift* é obrigatório em `consulta_expandida`, e nos quatro temas do estrato ele veio de fora da pergunta em três: "avaliacao educacional (ensino superior)" virou `'sair' & (…)`, "metodos quantitativos" virou `'previsã' & (…)` e "migracao de povos" virou `'exploitation' & (…)`, lexema de resumo em inglês. É a falha de Q11 reproduzida em temas que ninguém escolheu, e pior: em Q11 o núcleo continuava sendo o tema.
2. **Tema amplo não chega a responder.** Fora da amostra, na sondagem que a precedeu, `consulta_expandida('educação')` estourou o tempo do papel anônimo (erro 57014, cerca de 3 s), e `buscar_texto('gestão do conhecimento')` — o tema do próprio EGC — oscilou entre 2,5 s e o mesmo estouro. A semente de milhares de obras torna o `unnest` do tesauro caro. Nenhum tema desse porte caiu no sorteio, porque o estrato grande começa em 20 obras e não distingue 20 de 900.

A precisão só existe quando a triagem estiver assinada. Nenhuma correção do tesauro deve entrar antes dela: mudar a função agora trocaria o sistema medido no meio da medição.

## A busca por significado, medida (fase B do ADR 004)

O ADR 003 reposicionou a pergunta do vetor — *ele alcança o tema quando não existe apoio léxico?* — e subiu a régua para 79% de revocação e 76% de precisão (R2). Com os 85.567 vetores carregados (`gemini-embedding-2`, 768 dimensões, cerca de US$ 8 de custo único), `npm run afericao:vetor` mede os três métodos contra a mesma triagem assinada, com k = 25:

| Método | Q10 "empreendedorismo feminino" | Q11 "mulheres empreendedoras" | Sobreposição Q10 × Q11 |
| --- | --- | --- | --- |
| Texto (`buscar_texto`, R3) | 79% / 76% | 63% / 83% | 64% |
| **Vetor** | 79% / **95%** | **79% / 100%** | **96%** |
| Híbrido (RRF) | **83%** / 87% | 75% / 82% | 80% |

Revocação / precisão; precisão sobre as obras recuperadas que foram triadas, como em `afericao-executar`.

1. **O vetor passa a porta onde o tesauro falhava.** Em Q11 a revocação sobe de 63% para 79% sem perder precisão, e as duas paráfrases passam a devolver quase o mesmo recorte (96%, contra 64%). Era o defeito que o ADR 001 descreveu e que o FTS com tesauro não removia.
2. **O híbrido é o que vai para a tela**, e não o vetor puro, por D2: similaridade não tem total. `panorama_tematico` conta só o que casou com os termos e usa a fusão para escolher a amostra, com a origem de cada obra declarada.
3. **Limite declarado, o mesmo de R6.** É um único tema com gabarito humano, e o top 25 do vetor tem 5 ou 6 obras que a triagem nunca viu — a precisão delas não está medida. A amostra cega continua sendo o teste de generalização.

A escala de similaridade é comprimida: as obras que pertencem a Q10 ficaram entre 0,70 e 0,81, e um tema sem nada no acervo ("bolo de chocolate") não passa de 0,66, mas "blockchain quântico" acha criptografia pós-quântica a 0,74. O limiar de 0,70 corta ruído e não prova ausência — por isso amostra achada só por significado vai ao modelo marcada como aproximação, e sem nenhuma contagem.

## O que falta para fechar a Etapa 0

- **Triagem de Q12 e Q13** (psicologia positiva): 82 obras pendentes, sem responsável. Adiada por decisão de 16/09/2026 para seguir com Q10 e Q11 primeiro. Enquanto não for feita, psicologia positiva não tem gabarito pontuável e **Q15 fica sem denominador** — o que também adia a evidência empírica que sustenta a necessidade da Etapa 3.
- A planilha sai de `npm run afericao:triagem`, em [`evidencias/afericao/triagem-*.md`](evidencias/afericao/), com candidatos da varredura, candidatos de vocabulário vizinho e resumo completo; as decisões ficam em `evidencias/afericao/triagem-decisoes.json`, com sugestões de modelo separadas da decisão humana.
- Rodar o script novamente na véspera de cada aferição e guardar o JSON junto do resultado da rodada.
