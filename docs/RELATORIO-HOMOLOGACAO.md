# Homologação — execução disponível em 12/09/2026

> **Estado atual — bloco 17:** [revisão final e rollback](REVISAO-FINAL-BLOCO17.md). Pacote atual `/tmp/EcoGrad-bloco17-revisao.tar`; Node 24, 138 testes e cinco bundles validados localmente. As configurações Node 20 e pacotes abaixo são históricos. Homologação humana e destino remoto continuam pendentes. Nada publicado.

> Bloco 16: [homologação disponível](HOMOLOGACAO-BLOCO16.md) executada, com duas correções de interface, 138 testes, paridade e build aprovados. Não há resultados humanos/físicos recebidos; aceite segue pendente. Pacotes anteriores não incluem as mudanças atuais. Sem publicação.

> Bloco 15: [curadoria por termo](CURADORIA-POR-TERMO.md) implementada localmente; 138 testes e build aprovados. Evidências atuais no relatório vinculado. Pacotes anteriores são históricos e não incluem esta alteração. Aceite científico, avaliação humana/assistiva/móvel e runtime de destino continuam pendentes. Nenhuma publicação realizada.

> Bloco 14: [IA rastreável](IA-RASTREAVEL.md) corrige H02/H03 e registra retestes reais, inclusive falhas. Aceite do curador ainda pendente; os resultados e pacotes descritos originalmente abaixo são históricos.

> Atualização posterior: [bloco 13 — entrega por coleção](ENTREGA-POR-COLECAO.md) implementado e testado. Este documento registra a rodada anterior; seu pacote/hashes de release não representam o código atual. H01 foi mitigado tecnicamente, mas segue pendente de medição física. H02–H05 continuam pendentes.

**Resultado: verificações locais aprovadas; homologação humana e aceite de publicação pendentes.** Nenhum deploy, convite, commit ou push executado. [Plano e fichas](HOMOLOGACAO.md) · [Revisão da publicação](REVISAO-PUBLICACAO.md).

## Evidências novas (não confundir com parte 12)

| Verificação | Resultado desta execução | Evidência e limite |
| --- | --- | --- |
| Suíte completa | 114 testes em 13 arquivos, zero falhas | [testes.txt](evidencias/homologacao/testes.txt); endpoints da suíte são simulados. |
| Python × TypeScript | Comparador aprovado, incluindo as 95 identidades de QL | [paridade.txt](evidencias/homologacao/paridade.txt); recortes e tolerâncias existentes, Louvain estocástico sem igualdade garantida. Avisos Streamlit sem runtime são do harness. |
| Produção | TypeScript e Vite aprovados | [build.txt](evidencias/homologacao/build.txt); Node local v24.14.1, configuração Netlify pede Node 20: falta repetir no runtime de destino. |
| Bundles | 642.985 bytes JS inicial, 197.307 bytes gzip calculado | [build.json](evidencias/homologacao/build.json); desenhos adiados, não Web Vitals. |
| Funções | Cinco ZIPs construídos: capes-proxy, gemini-chat, gemini-synthesize, gemini-ontology, neo4j-query | [funcoes-build.txt](evidencias/homologacao/funcoes-build.txt); construção local, não valida execução na CDN nem acesso Neo4j. |
| Segredos nos artefatos | Nenhum valor local de KEY/PASSWORD/TOKEN encontrado em dist/ZIPs | [manifest-revisao.json](evidencias/homologacao/manifest-revisao.json); comparação de valores do .env sem registrar valores, não auditoria universal. .env e dist ignorados pelo Git. |
| Teclado em IAB local | Tab inicial focou estado da sessão; foco sólido 3 px. Tab até Aparência + Enter abriu diálogo; foco no fechar, quatro Tabs completaram ciclo interno; Escape devolveu foco a Aparência com contorno 3 px. | Observação via CUA/árvore de acessibilidade, origem localhost:8888, rota início, tema escuro. Não é sessão com VoiceOver nem auditoria das oito tarefas. Não houve captura de fala. |
| Rede limitada | HTTP 206; 1.048.576 bytes em 8,194356 s, 127.963 bytes/s | [rede-limitada.json](evidencias/homologacao/rede-limitada.json); curl, range 0–1048575, limite 125.000 bytes/s, origem local. Sem latência artificial, download parcial, sem navegador/processamento/memória física. |
| Revisão de whitespace | `git diff --check` sem erro | Revisão do conjunto já modificado no workspace; nenhuma mudança científica nesta rodada. |

A configuração de 1 Mbps equivale a 125.000 bytes/s; a variação da amostra vem do limitador/tempo do curl. Os 41.721.699 bytes PPG exigiriam ~334 s; PPG + TCC (64.877.098 bytes), ~519 s de transferência ideal, **estimativa**, não carga completa medida. TCC isolado ~185 s. A seleção pequena ainda baixa a base inteira de sua categoria. Não se mediram LCP, INP, CLS, pico de memória ou sessões humanas nesta rodada.

## IA real: amostra pública, sem aplicação

[ia-real.json](evidencias/homologacao/ia-real.json) preserva título, ID estável, fonte, resumo público e respostas. Documento: “Analise economica da valorização energetica da madeira”, fonte do repositório UFSC, coleção de Engenharia de Produção. Não é a amostra científica de regressão PPGEGC nem o recorte misto de 322 documentos. O script prefere Ecologia por nome exato e recorre a outro registro completo quando não encontra esse nome; a amostra efetiva está sempre no log.

Executado contra funções reais já disponíveis em localhost:8888, sem ler ou copiar a chave no harness. Código configura Chat `gemini-2.5-flash` com fallback `gemini-2.0-flash`; síntese `gemini-2.5-flash-lite`; ontologia também admite `gemini-3.1-flash-lite`. A resposta da aplicação não informa qual fallback foi usado, tokens nem custo: esses campos continuam não medidos.

| Fluxo | Resultado técnico | Revisão preliminar |
| --- | --- | --- |
| Chat | HTTP 200, texto NDJSON e evento `fim`; primeiro chunk 5.784 ms, total 8.264 ms | Título/link coincidem com a entrada. Explica amostra de um registro e não garante disponibilidade atual. Entretanto descreve “0 orientadores” como nenhum orientador ativo identificado: inferência indevida. O harness enviou agregados docentes vazios intencionalmente como contexto incompleto; repetir com dossiê completo da UI antes de atribuir esse efeito ao fluxo usual. |
| Síntese | HTTP 200, 969 ms | Não explicita a amostra de um documento; generaliza “a pesquisa concentra-se” e acrescenta sustentabilidade/eficiência sem sustentação explícita no título/palavras-chave enviados. Requer revisão e ajuste antes de aceite semântico. |
| Ontologia | HTTP 200, 855 ms, uma identidade devolvida sem erro | “análise econômica” tem suporte no resumo; “valorização energética da madeira” parece objeto/tema, não método específico. Curador deve decidir rejeição/categoria, sem aceitação automática. |
| Chat cancelado | HTTP 200, primeiro texto em 7.879 ms, abort local aos 7.881 ms, parcial registrado | Valida corte da leitura HTTP local. Não comprova que o Google interrompeu processamento/cobrança nem que a UI persistiu o parcial real. |

Antes da rodada concluída, a escolha inicial de registro sem orientador foi rejeitada pela validação local (HTTP 400, contexto inválido), e o harness foi corrigido para selecionar metadados completos. Houve também tentativa inicial sem amostra na base PPGEGC. Essas tentativas não geraram resposta do provedor. O log final contém somente a rodada concluída; nenhuma extração foi incorporada à base científica.

## Registro de pendências

| ID | Severidade / estado | Ação e responsável | Critério de fechamento |
| --- | --- | --- | --- |
| H01 | Bloqueio do aceite móvel amplo; aberto | Produto + desenvolvimento: decidir entrega por coleção ou escopo explicitamente restrito; medir aparelhos | Orçamento aprovado e medições físicas sem travamento/perda, ou restrição documentada aceita. |
| H02 | Erro semântico recuperável; aberto | Curador + desenvolvimento: revisar síntese e generalizações | Rodada com amostra explícita e nenhuma afirmação sem suporte; reteste real. |
| H03 | Erro semântico recuperável; aberto | Curador: avaliar tema classificado como método e Chat com agregados ausentes | Rótulos sustentados por trecho e nenhuma inferência de vínculo ativo; repetir dossiê normal da UI. |
| H04 | Portão não executado | Responsável: recrutar participantes e leitores habituais | Fichas T1–T8, severidades consolidadas e retestes de bloqueios. |
| H05 | Portão não executado | Responsável técnico: futuro ambiente de homologação, runtime/variáveis/rollback | Frontend, funções e dados da mesma versão; smoke completo e retorno verificado. |

Não há aprovação humana ou certificação de acessibilidade implícita nos testes automatizados. A autorização para publicar deve ser solicitada separadamente após resolver/aceitar os limites e preencher a decisão de aceite.
