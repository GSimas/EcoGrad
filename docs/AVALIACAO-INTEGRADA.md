# EcoGrad — avaliação integrada e entrega das partes 1–12

Data: 12/09/2026. Estado: implementação e avaliação técnica concluídas; homologação com pessoas, provedor de IA real e dispositivos físicos pendente. Não houve publicação, commit ou push nesta etapa.

## Escopo e ambiente

Avaliação do build de produção em navegador IAB local, com CAPES real encaminhado ao ambiente completo em `http://localhost:8888`. IA exercitada em servidor de respostas simuladas (`tests/manual-ia-server.mjs`), em origem separada da análise do usuário. As extrações artificiais servem apenas à validação e não devem ser incorporadas a uma base científica publicada.

Seleção integrada: **322 documentos**, sendo **264 de Ecologia e 58 de TCC de Administração Pública EAD**. A regressão científica usa separadamente `base_ppgegc.json` (811 registros), com referência no `backend.py`. Não se deve confundir essas duas bases ou generalizar as medições para o acervo completo.

## Correções desta etapa

| Achado | Correção e evidência |
| --- | --- |
| Bibliotecas pesadas de gráficos e redes participavam da entrada inicial | Importação adiada de ECharts/wordcloud e ForceGraph; chunks compartilhados de React separados. JS inicial caiu de 1.895.110 para 642.985 bytes, aproximadamente 66%. `build-antes.json` e `build.json`. |
| Adiar o desenho introduzia risco de uma falha de download derrubar a página | Limite de erro restrito ao canvas, com mensagem de recuperação; tabelas e exportações permanecem fora desse limite. Teste local com resposta 503 ao chunk ECharts permitiu abrir a tabela do CAPES. |
| Câmera recuperada podia ser aplicada antes da montagem do canvas adiado | Restauração também ao anexar a referência da rede. Reload e voltar/avançar recuperaram o zoom de 98%, com canvas presente e resultado concluído. |
| Nomes semelhantes podiam continuar truncados em controles compartilhados | Nomes completos quebram linha nas opções e seleções; altura mínima de 44 px nas opções. Identificadores e comparação não foram alterados. |
| Ajuda dos ajustes de aparência fazia parte de rótulos longos | Rótulos curtos associados por `htmlFor`; explicação separada com `aria-describedby`. Foco de 3 px verificado. |
| Comparador científico de QL limitava os dois resultados a 40 linhas e comparava apenas a interseção | O teste exige todas as 95 identidades não vazias antes de comparar valores. Rejeita números não finitos; ausência de entidade agora falha. Não houve alteração do cálculo. |
| Documentação sugeria equivalência demonstrada de Louvain | Modularidade e número de comunidades agora são explicitamente informativos; partições estocásticas não têm igualdade assegurada pelo teste. |

Os workers científicos continuam `data.worker-DgMjf3G2.js` e `sna.worker-DKGMnjLJ.js`. Nesta parte não foram modificados algoritmos, base documental, vínculos CAPES, critérios de identidade de importação, formatos de exportação ou contratos de persistência e IA. Arquivos modificados nas partes anteriores continuam no workspace; a entrega abrange esse conjunto, não apenas o último ajuste.

## Tarefas do plano: execução técnica

| Tarefa | Cenário e resultado observado | O que ainda exige pessoas |
| --- | --- | --- |
| Escolher coleção entre nomes parecidos | Administração `74711` mostrou 648 registros e período 1974–2019, distinguível de `214239`, com 833 registros. Seleção editada antes do carregamento. O fluxo principal carregou as duas coleções PPG/TCC acima. | Acerto, tempo e dúvidas com participantes que desconhecem os identificadores. |
| Encontrar orientador por tema | Dashboard → biodiversidade → perfil de Floeter, com dois registros relacionados no recorte consultado. Perfil explica limites de afinidade e não promete disponibilidade ou vínculo atual. | Se a justificativa é compreendida e suficiente para decidir o próximo passo. |
| Localizar resumo e fonte | Aberto “Efeitos do uso do solo e da altitude sobre a estrutura da comunidade de peixes em riachos de cabeceira”. Resumo e link `https://repositorio.ufsc.br/handle/123456789/271904` presentes. | Tempo, cliques desnecessários, compreensão de que a fonte externa pode ter outras condições de acesso. |
| Investigar termo no Radar | Tabela filtrada por biodiversidade → exportação JSON → dossiê → voltar restaurou filtro. Tecla Home na janela recente mudou 3 para 1 ano; UI passou a informar passado até 2025 (320 registros) e recente 2026 (2). Busca sem linha mostrou orientação para restaurar. | Entendimento dos eixos, limites dos cortes, período e incerteza; não inferir previsão garantida. |
| Alterar filtros CAPES | Resposta oficial: 90 programas, 84 ativos nesta consulta. Nenhuma nota → zero; restauração → 84. Busca Odontologia → código exato `41001010008P0`, nota 5, acadêmico, mestrado/doutorado. JSON exportado preserva fonte, consulta e filtros. | Expectativa do usuário sobre “ativo”, modalidades e efeito de filtros combinados. Números podem mudar em consultas futuras. |
| Navegar e retornar à origem | Termo → orientador/trabalho → voltar; Radar → dossiê → voltar; navegador voltar/avançar entre Memética e Chat. Filtros, zoom e rascunho mantidos. URLs observadas contêm somente a página. | Facilidade para reconhecer a origem e usar o percurso em exploração longa. |
| Interromper e retomar | Chat cancelado pelo controle global após navegar; parcial preservado. Lote com falha retomado, interrompido e recuperado após reload: quatro concluídos e um pendente; retomada processou apenas a pendência, chegando a cinco. Rede calculou enquanto se navegava ao Dashboard. | Se mensagens e estados deixam claro o que continua, o que foi salvo e o que precisa reiniciar. |
| Repetir em celular e teclado | Matriz de 40 combinações de páginas/temas/larguras; controles ativados por Enter, sliders por Home, checkbox por teclado, diálogos por Escape e foco visível. Tabelas mantêm rolagem local. | Uso real com teclado exclusivamente, leitor de tela e celular físico, sem os atalhos de localização da automação. |

Não foram medidos tempos de tarefa ou taxas de sucesso com participantes. A inspeção técnica não substitui esse estudo.

## IA, importação, exportação e recuperação

| Fluxo | Evidência |
| --- | --- |
| Consultor | Primeira resposta parcial com erro do provedor simulado; repetição sem duplicar pergunta, mantendo o parcial anterior. Outra resposta lenta interrompida pelo controle global após navegar. Conversa e parcial recuperados após reload. Rascunho “Rascunho final de validação — não enviar” permaneceu após tema, diálogo, reload e voltar/avançar; não foi enviado. |
| Síntese | UI explicitou 25 de 264 documentos, salto 10 e 5.061 caracteres, somente títulos/palavras-chave. Após sucesso, segunda tentativa simulada com 503 manteve a última síntese concluída. TCC não foi apresentado como programa com nota CAPES. |
| Ontologia | Cinco identidades no lote, falha individual e retomada seletiva; quatro concluídas sobreviveram à interrupção e reload. Cinco resultados aplicados explicitamente. Resultado por documento acessível em tabela e exportação. |
| Importação nativa | CSV selecionado pelo diálogo de arquivos do navegador. Prévia com uma substituição possível e duas linhas bloqueadas: versão incompatível e identidade inexistente. Só após marcar substituição e aplicar houve atualização. Exportação posterior manteve cinco IDs únicos e exatamente uma substituição. Esta rodada resolveu a pendência do seletor nativo registrada nas partes anteriores. |
| Identidade | Arquivo de teste contém IDs estáveis e versão; título semelhante não resgata a linha inválida. Correspondências conservadoras cobertas também pelos testes unitários. |
| Exportações | CAPES e Radar JSON baixados e conferidos com contexto. CSV de ontologia exportado, reimportado com prévia e novamente exportado; vírgula interna em lista JSON foi preservada. Testes cobrem proteção de CSV, contexto e ausência de conteúdo privado em exportações de visualizações. |
| Sessão | Rede concluída, zoom 98%, prévia aplicada com duas linhas bloqueadas, revisão de lote, conversa, parcial, parâmetros, filtros e percurso mantidos após recarregar. Recuperação não disparou nova chamada de IA nem novo cálculo. Limites e invalidação por versão cobertos pela suíte de sessão. |

Os testes de endpoint usam respostas controladas; não houve nova chamada ao Gemini real nesta etapa. Não se avaliou qualidade semântica, custo, quota, latência externa ou comportamento do streaming no ambiente publicado.

## Acessibilidade, temas e responsividade

`responsividade.json` registra as 40 medições: Dashboard, Busca/dossiê, Foresight, Memética e Consultor × claro/escuro × 320/390/768/1440 px. A largura real do viewport foi conferida em cada registro; não houve overflow do conteúdo principal nos cenários registrados. Tabelas extensas têm rolagem própria e não devem ser confundidas com overflow da página.

Aparência e CAPES também foram abertos nas quatro larguras e nos dois temas. CAPES ocupou 304/374/752/1152 px dentro de viewports 320/390/768/1440 px; altura limitada a 828 px no viewport de 900 px, com rolagem interna. Aparência ocupou 304/374/512/512 px. Ao atravessar o breakpoint móvel com um diálogo aninhado no menu, ele fecha junto com o menu; a abertura pelo controle desktop foi conferida em seguida.

Prévia da importação aplicada em 320 px: 218 px de largura interna, nomes completos e rolagem local da tabela. Nos dois temas foi medida também em 390/768/1440 px (288/634/1002 px). A extensão vertical é grande no celular: sua adequação à leitura precisa de observação humana.

Enter abriu menu/diálogos e acionou tabelas; Escape fechou aparência e devolveu foco ao botão de origem; foco computado sólido de 3 px. A suíte verifica contraste dos tokens, prioridade de movimento reduzido e validação das preferências. Rede permaneceu pausada com redução de movimento, e câmera continuou operável. Console do build principal sem erros ou avisos na checagem após a recuperação final; a falha 503 de canvas foi produzida deliberadamente em outra origem de teste.

Isso não é certificação WCAG: contraste de todos os pixels, nomes anunciados por leitores de tela, ordem completa de Tab, foco sob zoom, cores forçadas e operação em dispositivos físicos ainda precisam de auditoria dedicada.

## Regressão funcional e científica

- **114 testes, zero falhas**, em 13 arquivos de teste: aparência, CAPES, coleções/metadados, interpretação, IA/endpoints simulados, navegação, resultados, seleção, sessão, visualização e workers. Registro integral: `evidencias/parte12/testes.txt`.
- Build de produção e TypeScript aprovados; `report:build` impede que ECharts/ForceGraph voltem à lista inicial do HTML. ECharts ainda tem aproximadamente 1,07 MB bruto: ele foi adiado, não eliminado. O limite de aviso configurado no projeto é 1.600 kB, portanto o build não emite alerta para esse chunk.
- Python × TypeScript: topologia em 150 documentos/400 nós amostrados, métricas complexas, rede densa de coocorrência, maturidade, 43 termos de Radar, 89 linhas de backtest, memética, 95 linhas de QL e Jaccard passaram nos critérios do comparador. Registro: `paridade.txt`.
- Louvain permanece estocástico; nesta rodada Python produziu 29 comunidades, TS 26. Valores são informativos, sem igualdade assertada. A paridade dos casos testados não prova todas as combinações, bases, bootstrap, sementes ou configurações futuras.
- Não foram alterados os algoritmos científicos nesta parte. O fortalecimento da comparação de QL corrige uma lacuna do teste, sem reinterpretar dados ausentes.

## Desempenho e limites

JS inicial bruto: **1.895.110 → 642.985 bytes**, redução de **66,1%**. Gzip calculado do resultado atual: **197.307 bytes**; não é medição de tráfego nem Web Vitals. Não se compara percentual gzip porque a referência foi calculada com outro nível de compressão. ECharts (~1,07 MB bruto) e ForceGraph (~187 kB) carregam quando o desenho é solicitado. Falha de chunk deixa as alternativas textuais disponíveis.

As bases compactadas continuam com **41.721.699 bytes (PPG)** e **23.155.399 bytes (TCC)**. Uma análise mista pode precisar de aproximadamente **64,9 MB** só nesses dois arquivos, antes de descompactação e processamento. Esse é o principal limite remanescente para conexão lenta e memória móvel. Dividir entrega por coleção exige trabalho próprio, preservando versão, IDs, deduplicação, resultados e recuperação.

Uma execução isolada do harness JavaScript na base PPGEGC levou **0,75 s de tempo real**, 0,87 s de CPU de usuário e 0,04 s de sistema, neste computador. Não é mediana, não inclui download/renderização e não representa celular. Não foram obtidos LCP, INP, CLS, pico de memória ou teste de rede limitada; não há promessa de desempenho para o acervo inteiro.

## Evidências e reprodução

Arquivos em [evidencias/parte12](evidencias/parte12): logs de testes/build/paridade, matrizes de viewport, relatório de bundles antes/depois, exportações CAPES/Radar, resultado da importação e CSV artificial. O CSV contém propostas simuladas: **não usar como catálogo curado**.

Na pasta `ecograd-web`:

```bash
npm run test:all
npm run verify:parity
npm run build
npm run report:build
npm run netlify:dev
```

O venv Python é necessário para paridade. O ambiente completo usa `http://localhost:8888`; Vite isolado não executa as funções. As credenciais devem ficar no ambiente, nunca na documentação ou nos artefatos.

Para repetir a simulação em terminal separado, a partir da raiz, após gerar o build:

```bash
node ecograd-web/tests/manual-ia-server.mjs
```

Abrir `http://127.0.0.1:8891`. Reiniciar o servidor reinicia os contadores de falha; usar uma nova análise de teste para repetir a sequência. A primeira resposta do Chat termina com erro parcial, a segunda síntese falha e o segundo documento de ontologia falha. Pergunta contendo “lenta” demora 15 segundos. Para falha de desenho:

```bash
ECO_FIXTURE_PORT=8892 ECO_FIXTURE_FAIL_CHART=1 node ecograd-web/tests/manual-ia-server.mjs
```

Abrir `http://127.0.0.1:8892`, chegar ao CAPES e usar a alternativa em tabela após o erro. Esses servidores são exclusivos para teste local; não publicar nem configurar como backend de produção.

## Pendências humanas e próximos passos

| Prioridade | Ação | Critério de saída |
| --- | --- | --- |
| Antes de homologar IA | Rodar uma pequena amostra pública no Gemini real e revisar títulos, vínculos e extrações; testar streaming/cancelamento em ambiente de homologação com frontend e funções da mesma versão. | Respostas rastreáveis às fontes; falhas e interrupções recuperáveis; nenhuma proposta aceita automaticamente como verdade. |
| Antes de anunciar acessibilidade | Percorrer as oito tarefas só por teclado e com VoiceOver/NVDA; celular físico iOS/Android; zoom 200%, texto ampliado e cores forçadas. | Sem bloqueio de tarefa; foco/ordem/nome/estado anunciados corretamente; problemas registrados com reprodução. |
| Antes de prometer uso móvel amplo | Medir conexão lenta, memória, carga fria/quente e interação em aparelho intermediário com seleções pequena e grande. | Orçamentos de desempenho definidos a partir do público; ausência de travamento/perda de sessão; decisão documentada sobre entrega de dados por coleção. |
| Homologação de UX | Convidar 5–8 pessoas de perfis distintos, incluindo uso de tecnologia assistiva. Repetir as oito tarefas sem instruir qual botão usar. | Registrar conclusão independente/com ajuda/falha, tempo, desvios, dúvidas, compreensão e severidade; corrigir bloqueios e repetir. A amostra é formativa, não estatística. |
| Curadoria contínua | Revisar os vínculos em `VINCULOS-CAPES.md` com documentação verificável; monitorar mudanças de base e serviço. | Código atribuído apenas quando sustentado por fonte; coleções sem vínculo continuam sem nota atribuída. |
| Preparação de publicação | Revisar o conjunto das partes 1–12, conferir arquivos de dados gerados/ignorados, variáveis, build e funções em homologação, com possibilidade de retorno à versão anterior. | Aceite humano e rodada real dos fluxos críticos antes da publicação solicitada separadamente. |

### Ficha para cada sessão humana

Registrar perfil e experiência sem dados pessoais desnecessários; dispositivo, navegador, tema, tecnologia assistiva, conexão e coleção. Para cada tarefa: início/fim, resultado (independente/com ajuda/falha), caminho seguido, dúvida verbalizada, interpretação dos dados e problema de interface. Não registrar conversas privadas nem credenciais. Consolidar por severidade (bloqueio, erro recuperável, esforço, acabamento), responsável e evidência. Não preencher resultados antecipadamente.

### Próximo prompt sugerido

> Prepare a homologação do EcoGrad a partir de docs/AVALIACAO-INTEGRADA.md: organize o roteiro para participantes, a auditoria com teclado e leitores de tela, o teste controlado da IA real e as medições em celular e conexão lenta. Execute as verificações disponíveis, registre as que dependem de mim e corrija bloqueios preservando algoritmos, identidades exatas e recuperação. Prepare a publicação para revisão, sem publicar ainda.

## Preparação da homologação — continuidade em 12/09/2026

Roteiros, recrutamento, fichas, matriz assistiva, IA real e celulares: [HOMOLOGACAO.md](HOMOLOGACAO.md). A rodada disponível repetiu testes/paridade/build, empacotou funções e exercitou endpoints Gemini reais; resultados e pendências semânticas em [RELATORIO-HOMOLOGACAO.md](RELATORIO-HOMOLOGACAO.md). Artefatos e portões de release em [REVISAO-PUBLICACAO.md](REVISAO-PUBLICACAO.md). Nenhuma publicação foi feita; as afirmações históricas acima se referem à parte 12, antes desta nova rodada.
