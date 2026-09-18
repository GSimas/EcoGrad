# ADR 004 — O UFSCão sobre o acervo inteiro, com índice enriquecido

**Status:** aceito. Revisa o [ADR 001](ADR-001-CHAT-SEMANTICO.md) e o [ADR 003](ADR-003-O-QUE-A-MEDICAO-MUDOU.md) no objetivo, na ordem das etapas e no que bloqueia cada uma. Onde divergirem, vale este.

**Data:** 16/09/2026 · **Decisor:** Gustavo Simas (produto e operação).

## Contexto

O objetivo de produto ficou mais preciso do que o do ADR 001: a conversa da tela inicial **é o próprio UFSCão**, que responde sobre qualquer tema investigando o acervo inteiro e cita os trabalhos com links para o Motor de Busca — como o UFSCão do botão flutuante já faz sobre as coleções carregadas.

Hoje as duas superfícies não fazem isso. O UFSCão lê até 120 trabalhos, só com título e metadados, e só do recorte carregado. A conversa da tela inicial lê o índice, mas devolve uma lista de títulos, sem síntese, porque a síntese precisa dos resumos no navegador.

O ADR 001 já tinha as peças certas — índice derivado, contagem só em SQL, 15 a 25 resumos por pergunta, citação obrigatória —, mas colocava o vetor atrás de uma triagem humana assinada e punha ontologia e unificação de pessoas no caminho. Isso atrasa o que importa sem proteger nada que as regras abaixo não protejam.

## Decisão

**E1 — Uma conversa só.** O "Conversar" da tela inicial vira o UFSCão, sobre o acervo inteiro pelo índice. O botão flutuante fica só para coleções carregadas. Mesma persona, mesma configuração de provedor, mesma forma de citar.

**E2 — Amostra representativa, não os k mais parecidos.** Cada pergunta temática faz: busca ampla de candidatos; panorama exato em SQL sobre eles (quantos, anos, coleções, níveis, macrotemas); e uma amostra de 15 a 20 obras espalhada por coleção e década, que é o que vai ao modelo com um trecho do resumo. Ordem de grandeza: 5 mil tokens de entrada por pergunta.

**E3 — Embeddings Gemini por função Netlify, com a chave do projeto.** O vetor da pergunta é calculado por uma função Netlify com `GEMINI_API_KEY` do servidor, com limite por origem. É exceção declarada à D10 do ADR 001, restrita a embedding: **a escrita da resposta continua BYOK**, na chave do usuário.

**E4 — O índice guarda o que o EcoGrad calcula (fase A0).** Perfis de pessoa, coleção e palavra-chave, pares de orientação e métricas de rede passam a ser tabelas do índice, com a unidade no nome de cada coluna (`obras_*` × `registros_*`) e comentário em cada tabela. É o que permite ao modelo consultar por SQL sem montar junção — e o que o protege de contar registro como obra.

**E5 — Unificação automática conservadora agora, curadoria humana depois.** Funde só grafias iguais após normalização e abreviações com **uma única** forma longa compatível e coleção em comum (`unificacaoConservadora`, em `unificacao.ts`). Cada fusão fica em `pessoa_fusao` com o método, para revisão. A Etapa 5 deixa de bloquear perfis de pessoa.

**E6 — Métricas de rede no acervo inteiro e por coleção.** Calculadas em Node pelo mesmo `sna-engine.ts` do app, com escopo em coluna própria. A mesma pessoa tem intermediação diferente em cada escopo, e a resposta precisa dizer qual usou.

**E7 — Medição vira regressão, não porta.** As conferências automáticas e a amostra cega rodam a cada fase; nenhuma fase espera triagem assinada.

**E9 — Cortesia de 10 perguntas por IP, vitalícia.** Quem chega sem chave conversa com o UFSCão dez vezes, pela função `ia-cortesia`, com `DEEPSEEK_API_KEY` do projeto no `deepseek-flash`; depois disso, traz a própria chave. É a segunda exceção declarada à D10 do ADR 001, e a primeira que escreve texto. Três travas, porque protegem coisas diferentes: a cota por IP dá justiça, o **teto global do projeto** (`CORTESIA_TETO_PERGUNTAS`) é o que garante o orçamento, e os caps de etapa, tamanho e saída limitam o estrago de quem usar o endpoint como proxy de LLM. IP não é identidade — NAT de campus e CGNAT põem muita gente num IP só, e trocar de IP leva trinta segundos —, por isso a conta do mês nunca depende dele. Aprofundar fica fora: lê até 400 resumos, dezenas de perguntas em custo, e continua na chave de quem pede. O thinking mode do `deepseek-flash`, ligado por padrão, é desligado no corpo do pedido: o raciocínio é cobrado como saída.

**E8 — Fora do caminho crítico:** extração ontológica do acervo (Etapa 3) e curadoria humana das fusões. Continuam valendo, sem bloquear.

## Fases

| Fase | Entrega | Depende de |
| --- | --- | --- |
| **A0** *(feita)* | Unificação conservadora, perfis, orientações, métricas de rede; views comentadas e função `consultar` somente leitura para NL2SQL | carga do índice |
| **A** *(feita)* | UFSCão na tela inicial: reescrita da consulta pelo modelo, candidatos por FTS, panorama SQL, amostra representativa, citações para o Motor de Busca | A0 |
| **B** | pgvector com embeddings Gemini e fusão RRF na amostra *(feita em 16/09/2026: vetor 79/100 em Q11 contra 63/83 do texto; ver [aferição](AFERICAO-ETAPA-0.md#a-busca-por-significado-medida-fase-b-do-adr-004). MMR não entrou: a cota por coleção já espalha a amostra)* | A |
| **C** | "Aprofundar" sobre o índice: `obras_do_tema` lista o conjunto léxico do tema, `resumos_das_obras` lê os resumos em páginas, e o modelo do usuário lê todos em lotes — com chamadas, tokens e tempo na tela antes de gastar a chave dele *(feita em 17/09/2026: as duas funções conferidas contra o acervo, com paridade exata de contagem em sete recortes; ver [aferição](AFERICAO-ETAPA-0.md#aprofundar-sobre-o-índice-medido-fase-c-do-adr-004))* | A |

## Continua valendo

D1 (índice derivado e reconstruível), D2 (contagem só em SQL, nunca por similaridade), D3 (a obra deduplicada é a unidade), D7 (recorte verificável antes da síntese, citação obrigatória), D8 (leitura padrão de 15 a 25 resumos), D9 (ações dentro do app) e a D10 para a escrita da resposta.

## Consequências

**A favor.** O que o usuário queria sai em fases de dias, cada uma utilizável. O modelo recebe panorama e amostra em vez de 120 títulos sem resumo, e gasta menos. Perguntas de quem, quanto e quando deixam de depender de uma ferramenta escrita para cada uma.

**Contra, e assumido.**
- Unificação automática erra. O critério é estreito de propósito, e toda fusão é rastreável e reversível em `pessoa_fusao`; até a curadoria, a resposta declara que a pessoa foi unificada automaticamente.
- Embedding com chave do projeto é custo e superfície de abuso novos. Limite por origem e teto de orçamento são pré-requisito da fase B, não melhoria posterior.
- NL2SQL erra em silêncio. Só views preparadas, SQL e resultado visíveis na resposta, e os gabaritos exatos da Etapa 2 como teste antes de ir para a tela.
- O índice cresce: rede e perfis somam centenas de milhares de linhas, e o disco do projeto passa a ser restrição a acompanhar.
- A cortesia (E9) põe custo variável do projeto numa tela pública. Medido no prompt real: ~9.600 tokens de entrada e ~470 de saída por pergunta, em duas chamadas — cerca de US$ 0,001 fora do pico da DeepSeek, que no horário de Brasília é madrugada, e US$ 0,0034 no pico. Com US$ 10 no mês, dá de 3 mil a 10 mil perguntas, ou de 300 a mil pessoas usando a cota inteira. O teto em perguntas é a calibragem: sobe ou desce conforme o gasto real no painel, sem novo deploy. Sem Netlify Blobs a contagem não se sustenta entre instâncias, e a cortesia prefere não abrir a virar cheque em branco.
- Aprofundar (fase C) é uma ordem de grandeza mais caro que a leitura padrão, e o teto de 400 obras é escolha de produto, não limite do banco: é onde a conta deixa de ser razoável para quem paga. Tema maior que isso é lido só nas obras de maior aderência, e a resposta declara que a leitura não foi do tema inteiro. Só o conjunto léxico entra: dizer "li todas as obras do tema" sobre um conjunto que inclui vizinhos por similaridade seria falso, pela D2.
