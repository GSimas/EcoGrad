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

## O que falta para fechar a Etapa 0

- **Triagem humana dos conjuntos candidatos** de Q10 a Q13: revisar os 31 e os 26 registros um a um, marcando pertence/não pertence com justificativa, e acrescentar trabalho que a varredura léxica não alcançou. Sem isso, as metas de revocação e precisão não têm denominador.
- **Definir quem assina a triagem**, já que a operação declarada é ninguém. Gabarito temático sem responsável não é gabarito.
- Rodar o script novamente na véspera de cada aferição e guardar o JSON junto do resultado da rodada.
