# Implementação da experiência EcoGrad

Plano iniciado em 11/09/2026. Entregas locais e incrementais, cada uma com critérios de aceite, verificação e prompt de continuação. O plano completo ainda está em execução.

## Referência e critérios

A auditoria encontrou perda de identidade no catálogo CAPES (90 registros viravam 86; 84 ativos viravam 81), filtros vazios interpretados como todos, navegação estreita, perda de rascunhos ao trocar de página e risco de cálculos presos ao desmontar componentes. Essas observações orientam a prioridade; números do catálogo são exemplos da consulta, não constantes do produto.

Cenários recorrentes: um PPG, múltiplos PPGs, TCC, homônimos, registros incompletos, base sem ontologia, serviço indisponível, cancelamento, navegação durante cálculo, recarregamento e uso por teclado/celular. Algoritmos científicos existentes devem permanecer equivalentes; alterações metodológicas precisam de validação própria.

## Entrega 1 — identidade, correspondência e filtros CAPES

Implementada localmente.

- Catálogo versão 2 com programas indexados pelo código oficial; homônimos não se sobrescrevem.
- Paginação completa; registros sem identidade e códigos conflitantes geram erro recuperável, sem catálogo parcial. Repetições idênticas do mesmo código não duplicam contagens.
- Fonte, instituição, horário da consulta e total explícitos. Data da consulta diferenciada da atualização pela CAPES.
- Cliente valida a estrutura; versão da consulta evita reaproveitar o contrato anterior em caches.
- Correspondência por código ou nome normalizado único. Homônimos ficam ambíguos; similaridade oferece apenas sugestões, nunca atribui nota.
- A ficha informa o critério utilizado. Correspondência pelo nome não é apresentada como vínculo verificado por código da coleção.
- Falha de consulta diferenciada de ausência de correspondência. Se a atualização falhar, dados anteriores permanecem identificados pela data, com aviso.
- Panorama exige situação explicitamente ativa. Todos/nenhum/parcial são distintos, há restauração e contagem anunciada por status. Mestrado e doutorado no mesmo programa contam uma única vez.
- MultiSelect ganhou rótulos associados, estado selecionado acessível e alvos de remoção maiores; ações todas/nenhuma são opcionais e habilitadas no Panorama.

Validação: 20 testes automatizados e build aprovados. Consulta real: 90 registros, 84 em funcionamento, ambos os códigos de Direito preservados. Navegador: nenhuma opção de nível = 0; restauração por Enter = 84; somente modalidade profissional = 16. A coleção de Direito (1.710 documentos) mostrou os dois códigos candidatos e nenhuma nota atribuída, conforme esperado.

Limites desta entrega: ainda não existe um cadastro curado de relações entre identificadores das coleções UFSC e códigos CAPES. Nomes antigos, sufixos e homônimos exigem conferência documental; nenhuma relação foi inventada para aumentar cobertura. A curadoria será incorporada à seleção de coleções. O restante da acessibilidade, navegação e persistência permanece nas próximas entregas.

## Entrega 2 — ciclo de vida dos cálculos

Implementada localmente. O serviço de atividades pertence à sessão da aplicação, não ao componente da página.

- Rede global, maturidade, bootstrap, Grid Search, rede memética e carregamento de coleções têm estados independentes: fila, execução, conclusão, cancelamento e erro.
- Até duas atividades executam simultaneamente. As demais aguardam em fila, também cancelável.
- Navegar não encerra workers. O painel de atividades permite cancelar e reiniciar fora da página de origem; resultados concluídos permanecem em memória.
- Cancelar termina efetivamente o worker. Mensagens tardias, falhas nativas, falhas na transferência e respostas incompatíveis não deixam uma atividade presa nem reaplicam resultado antigo.
- Reiniciar usa os parâmetros capturados e começa a atividade desde o início. Não há retomada de uma iteração intermediária. Um resultado concluído anterior é preservado se o recálculo falhar ou for cancelado; a rede global pronta é preservada se a maturidade for interrompida.
- Bootstrap e Grid Search mostram porcentagem de reamostragens/combinações realizadas. Rede, maturidade e ingestão mostram etapas sem porcentagem artificial. O backtest final do Grid Search é identificado como etapa separada.
- Trocar a base ou aplicar ontologia invalida cálculos e resultados da versão anterior. Os resultados do Foresight são separados por tipo; a rede memética registra fonte e coocorrência. Parâmetros divergentes ocultam o resultado antigo e oferecem restauração explícita.
- Durante a ingestão, a seleção fica desabilitada; cancelar a libera. Uma seleção vazia na base retorna erro recuperável.
- Os algoritmos em `sna-engine.ts`, `foresight-math.ts`, `memetic-network.ts` e `data-loader.ts` não foram alterados.

Validação automatizada: 12 testes de ciclo de vida cobrem assinatura/desmontagem, concorrência, fila, cancelamento/reinício, mensagens atrasadas, troca de base, falhas nativas/de transferência, duplo clique, preservação de etapas e invalidação durante a conclusão. Os 20 testes CAPES também passaram.

Validação no navegador: carregar/cancelar/reiniciar Ecologia (264 documentos); navegar ao Dashboard durante Grid Search e recuperar o resultado ao voltar (MCC 0,508, F1 0,615, 29 termos); cancelar recálculo do bootstrap por Enter, preservar o resultado anterior e reiniciar pelo painel no Dashboard; construir rede memética, sair para o Dashboard, recuperar 313 nós/861 conexões, alterar coocorrência e restaurar os parâmetros após nova navegação. Nenhum erro no console da aba de teste. Build aprovado.

Limites: resultados e atividades ainda são voláteis após recarregar/fechar a aba. Persistência após reload pertence à parte 4. Extração de ontologia e respostas de IA serão tratadas na parte 10. Cálculos síncronos menores permanecem nos componentes; esta entrega cobre as atividades executadas nos workers e a ingestão.

## Entrega 3 — navegação responsiva e seleção segura

Implementada localmente.

- Abaixo de 1024 px, cabeçalho compacto e menu sobreposto deixam toda a largura para o conteúdo. No desktop, o painel continua recolhível.
- Menu com título acessível, foco contido, fechamento por Escape e retorno ao acionador. Ao navegar, fecha e posiciona o foco no conteúdo principal. Link “Pular para o conteúdo” e indicadores de foco visíveis.
- Ajuda/tutorial e Panorama CAPES permanecem disponíveis antes e depois de carregar a base, no menu e no cabeçalho móvel. Os diálogos não desmontam a página de análise nem encerram workers.
- “Editar seleção” usa rascunho separado das coleções ativas. Fechar sem aplicar mantém a base. Aplicar uma seleção idêntica não recalcula. Ao aplicar uma seleção diferente, a base atual permanece até o carregamento terminar; nomes e documentos são substituídos atomicamente.
- No celular, aplicar a nova seleção fecha editor/menu e devolve o foco ao conteúdo. Falha/cancelamento da ingestão não substitui a base ativa.
- “Nova análise” explica que encerra atividades e descarta resultados. “Manter análise atual” fecha a explicação sem reset; a ação explícita de encerramento limpa a seleção e volta à escolha de coleções.
- Tutorial com rodapé que se reorganiza no celular, alvos maiores e conteúdo rolável. Chat com campo e botão Enviar empilhados em telas estreitas, evitando compressão do botão.

Validação: 35 testes aprovados (3 de seleção, 12 de workers, 20 CAPES) e build aprovado. Conferidas as cinco páginas principais em 320, 390, 768 e 1440 px sem transbordamento horizontal no conteúdo principal; gráficos/tabelas mantêm a própria área de rolagem quando necessária. Seleção e diálogo CAPES também foram medidos nas quatro larguras. Em 320 px, testados tutorial por Enter, Tab/Shift+Tab, contenção de foco do menu, Escape e retorno ao acionador; navegação pelo menu leva o foco ao conteúdo.

Fluxos reais: abrir/fechar edição durante bootstrap preserva execução; remover Ecologia no rascunho e fechar sem aplicar preserva 264 documentos; aplicar Direito pelo menu em 390 px troca a base para 1.710 documentos e fecha os dois diálogos; nova análise retorna à seleção desmarcada. Os algoritmos científicos permanecem inalterados.

Limites: o rascunho do editor é descartado ao fechar sem aplicar, conforme informado na interface. A persistência ampliada de rascunhos/conversas e a recuperação após reload serão tratadas na parte 4. Histórico e URLs recuperáveis seguem na parte 5. Esta entrega não representa uma auditoria completa de acessibilidade com leitor de tela nem teste em hardware móvel físico.

## Parte 4 — sessão e recuperação após recarregar

Implementada a recuperação da aba antes da montagem das páginas, evitando que a inicialização apague resultados ou dispare novos cálculos enquanto o checkpoint é lido.

- Rascunhos do consultor, histórico, respostas parciais, pesquisa ainda não confirmada, edição de coleções, filtros CAPES, parâmetros de Foresight/memética/órbita/dossiês, tamanho de lote e abas ficam no estado da sessão. Fechar o editor conserva seu rascunho; há uma ação explícita para descartá-lo.
- A conversa e a extração ontológica não pertencem mais ao ciclo de vida da página. Navegar não interrompe respostas ou lotes. A extração aplica cada resposta recebida à base para que os lotes já concluídos entrem no checkpoint. Trocar a análise interrompe requisições antigas e impede aplicação tardia à nova seleção.
- Após reload, documentos selecionados (incluindo ontologias), SNA, maturidade, bootstrap, Grid Search, rede memética, métricas complexas e sínteses concluídas são recuperados quando o checkpoint e a versão conferem. Documentos não são duplicados em cada pedido de cálculo.
- Workers em execução/fila voltam como interrompidos. O usuário decide reiniciar; parâmetros capturados e último resultado concluído permanecem associados. Um registro pequeno e síncrono das execuções cobre a recarga imediata antes da gravação do checkpoint grande. Respostas da IA não são reenviadas automaticamente.
- Uma conversa de outra análise fica disponível para leitura com aviso e bloqueio de envio com o contexto antigo. Iniciar outra conversa limpa o histórico e preserva o texto ainda não enviado. “Nova análise” avisa que descarta também rascunhos/conversa.

Armazenamento e invalidação:

| Camada | Limite e política |
| --- | --- |
| Textos e preferências | `sessionStorage`, até 1 MiB (contagem UTF-16). Em excesso, o conteúdo integral permanece em memória e a interface informa a limitação; tenta salvar somente metadados mínimos para recuperar a análise. Não há truncamento silencioso de mensagens. |
| Análise | IndexedDB, até 64 MiB por checkpoint serializado. Gravações sequenciais e substituição atômica; nunca corta documentos ou métricas para caber. |
| Total do navegador | Até 128 MiB e 4 checkpoints; expirados e mais antigos são removidos primeiro. Cada inicialização usa um novo identificador, evitando que uma aba duplicada sobrescreva a original. |
| Validade | 24 horas desde o último salvamento de cada camada. O navegador também pode remover dados por política própria. |
| Versão | SHA-256 do conteúdo das quatro bases/catálogos, gerado por `sync:data`; a cópia também compara conteúdo, corrigindo a detecção baseada apenas em tamanho. Um manifesto é conferido antes de restaurar e antes/depois da carga. A versão do formato/resultados é explícita em `SESSION_SCHEMA`. |
| Mudança de base ou versão | Checkpoints de outra análise/versão não fornecem resultados à análise atual. Textos e preferências compatíveis permanecem; é solicitado recarregar as coleções. Sem conseguir verificar a versão, os resultados não são restaurados. |

O painel “Recuperação da sessão” mostra o estado da gravação, limites, avisos e “Salvar sessão agora”. Aguardar “Sessão salva” antes de recarregar garante o último checkpoint concluído; fechar/encerrar abruptamente o navegador durante uma gravação pode perder alterações posteriores ao checkpoint. Arquivos selecionados no controle de upload e requisições HTTP não são retomados automaticamente. A API pode concluir uma requisição já recebida mesmo após o cancelamento no navegador.

Validação realizada: 47 testes aprovados (20 CAPES, 15 workers, 3 seleção e 9 sessão), build aprovado e sem erros no console da aba de teste. Testes de serialização (inclusive valores não finitos), versão/esquema/expiração, limites de textos e análise, bloqueio/quota do navegador, descarte por idade/espaço, intenções de execução, interrupção/recuperação/reinício e respostas parciais. No navegador: Ecologia com 264 documentos; conversa concluída e rascunho recuperados; janela recente de 4 anos; Grid Search recuperado com MCC 0,508, F1 0,615 e N 29; pesquisa parcial e rascunho Ecologia + Direito preservados; recarga imediata do bootstrap mantém o resultado anterior e oferece reinício manual. Uma alteração temporária do manifesto confirmou que a interface invalida resultados e retorna à seleção; o manifesto original foi restaurado em seguida. Encerrar a análise e recarregar imediatamente retornou à seleção vazia, sem ressuscitar os resultados descartados.

Os algoritmos científicos não foram alterados. Histórico, URLs e recuperação do percurso entre entidades continuam na parte 5; melhorias de conteúdo/contexto da IA e prévia de importação permanecem na parte 10.

## Parte 5 — rotas, histórico e retorno ao contexto

Rotas públicas implementadas: `#/inicio`, `#/selecao`, `#/dashboard`, `#/busca`, `#/foresight`, `#/memetica` e `#/chat`. Usam a History API com fragmentos, compatíveis com a hospedagem atual sem regras novas de servidor. Endereços desconhecidos recebem uma página de recuperação; links diretos de análise sem base carregada apresentam a seleção e continuam para a página solicitada ao concluir a carga.

- Voltar/avançar nativos, botões acessíveis e seletor “Histórico desta análise” percorrem páginas e entidades. A origem aparece por nome e tipo de entidade. Cliques repetidos na mesma página/entidade e atualizações de progresso não acrescentam entradas.
- Cada visita conserva filtros, tipo/termo confirmado da busca, parâmetros científicos de visualização, aba, seções expansíveis, posição de leitura e acionador de origem. Ao voltar de um trabalho ao orientador, a lista de trabalhos pode ser reaberta e o foco retorna ao botão que abriu o trabalho. Quando o controle não existe mais, o foco volta ao conteúdo principal.
- Restaurar uma visita não substitui documentos/coleções, resultados, atividades, conversa, rascunho de edição ou estado da extração ontológica. Esses itens continuam pertencendo à sessão atual. Campos do histórico são explicitamente permitidos; conteúdo inesperado não pode substituir ações ou estado da aplicação.
- O histórico local usa uma chave própria no sessionStorage: até 60 visitas e 256 KiB adicionais, com validade de 24 horas desde a gravação. O estado nativo do navegador guarda somente um identificador aleatório por entrada. A URL contém exclusivamente o nome da página: não inclui entidades, filtros, seleção de coleções, consultas, mensagens ou respostas.
- Recarregar recupera o ponto atual e o caminho adiante quando a sessão ainda corresponde à análise e à versão da base. Trocar/encerrar a análise invalida o percurso anterior. Voltar nativamente a uma entrada antiga não recarrega coleções nem ressuscita resultados: apresenta a página disponível na análise atual com um aviso de contexto indisponível.
- Uma nova navegação depois de voltar substitui o ramo adiante, seguindo o comportamento do navegador. Limites, expiração ou bloqueio do armazenamento podem tornar entradas antigas indisponíveis; a navegação corrente continua funcionando e a interface informa a limitação.

Validação: 11 testes novos de navegação (58 no total com CAPES, workers, seleção e sessão) e build. No navegador, testados orientador → trabalho → voltar/avançar com seção aberta, foco e rolagem recuperados; aba Evolução Histórica e opção cumulativa após reload; rascunho privado do consultor ao avançar; parâmetro de 4 anos e resultado de bootstrap após voltar/avançar; rota inexistente e retorno; link direto sem base; encerramento seguido de Back sem reativar a análise antiga. Botões de percurso acionados por Enter. Controle de histórico conferido em 320, 390, 768 e 1440 px, sem transbordamento horizontal no conteúdo. Nenhum erro/aviso de console na aba de validação.

Limites intencionais: copiar um endereço compartilha a página, não a entidade nem o estado privado da sessão. Menus e diálogos transitórios não são entradas do percurso; o link de pular para o conteúdo não altera a rota. O histórico não funciona como arquivo de análises encerradas. Os algoritmos científicos permanecem inalterados.

## Parte 6 — entrada por objetivos e cobertura antes da carga

A apresentação e o tutorial foram reorganizados em torno de tarefas: encontrar trabalhos, investigar pesquisadores por tema, conhecer a produção, investigar mudanças e explorar conceitos/métodos. A seleção permite ajustar esse objetivo e abre a ferramenta correspondente ao concluir o carregamento. O objetivo é capturado no pedido da atividade e conservado no reinício; um link direto pendente mantém prioridade. Atalhos da apresentação usam a análise ativa quando já existe uma base, preservando seu contexto.

A seleção agora exibe nomes completos, identificadores, contagem de registros e período; cada coleção oferece tipos originais, preenchimento de resumo/palavras-chave/orientador/fonte, ausência de ano, repetições de links e fontes externas antes de ser marcada. Há busca por nome ou identificador, aviso de nomes semelhantes, filtro de selecionadas e revisão do recorte antes da carga. Coleções vazias têm estado explícito; selecionar apenas coleções vazias confirmadas não inicia um download sem resultado. TCCs incluem graduação e especialização, sem transformar classificações “Outros” em tipos acadêmicos inferidos.

O índice leve de cobertura é gerado pelas mesmas quatro fontes locais, ligado ao manifesto por versão e conferido antes/depois da consulta. São 264 entradas em aproximadamente 75 KiB, sem baixar as bases completas para mostrar a prévia. A interface informa o volume comprimido a baixar para cada seleção, deixa claro que o filtro ocorre depois do download e distingue registros de trabalhos únicos. Falhas de consulta ou incompatibilidade de versão não são interpretadas como zero. A data de coleta da base não está disponível e não é substituída pela data de geração da prévia.

A curadoria inicial está em [VINCULOS-CAPES.md](VINCULOS-CAPES.md) e no JSON executável de vínculos. Um vínculo está documentado: **Odontologia, coleção 74720 → 41001010008P0**. As outras três coleções com nome-base Odontologia não herdam esse vínculo. Ecologia, Direito acadêmico/profissional e os demais acervos continuam não verificados. A ficha deixa de atribuir nota por nome, mesmo único, e exige vínculo exato mais conferência de código, instituição, nome e modalidade no catálogo CAPES. O Panorama continua disponível independentemente da seleção.

Objetivo, filtros de catálogo, rascunho da seleção e etapa do tutorial usam a persistência da sessão. Abrir/fechar a edição ou a ajuda não altera a base nem encerra atividades. O histórico mantém suas regras da parte 5 e as URLs continuam contendo somente a página. O tutorial conserva a etapa ao ser reaberto, tem controles nomeados e explica retorno ao contexto, cancelamento, recuperação e limites dos indicadores/IA.

Validação: **69 testes aprovados e build concluído**. Testes de geração do índice contra os dois arquivos reais, identidade exata versus nomes semelhantes, duplicatas de fonte, estados vazios, versão/esquema inválidos, atualização durante a consulta, ausência de download das bases na prévia, destino por objetivo, prioridade de links diretos e preservação de contexto. Regressões CAPES, workers, seleção, sessão e navegação mantidas. No navegador: nomes semelhantes de Odontologia e suas coberturas, vínculo exclusivo de 74720 na prévia/ficha, seleção e tutorial após reload, objetivo abrindo Palavra-chave no Motor de Busca, edição sem aplicar e rascunho do consultor. Teclado: expansão da cobertura por Enter, seleção por Espaço, etapas por Enter e Escape com retorno de foco. A seleção foi conferida em 320, 390, 768 e 1440 px sem transbordamento horizontal. A carga exclusiva de TCC Administração Pública EAD abriu Documento com 58 registros; TCC Administração EAD, vazio, bloqueou a carga. O bootstrap de Odontologia continuou durante a edição e concluiu com 701 termos; resultado, rascunho de Direito e histórico foram recuperados após reload. Nenhum erro ou aviso de console nas duas abas de teste.

Os algoritmos científicos e as bases de documentos não foram alterados. A expansão da curadoria depende de fontes específicas por coleção, conforme a fila de pendências documentada; não há atribuição por aproximação.

## Parte 7 — resultados, trabalhos e comparação antes dos métodos

O Dashboard começa pelo recorte carregado, cobertura dos metadados e atalhos para trabalhos, temas e orientadores. A lista de trabalhos tem busca por título, autoria, orientador, palavra-chave ou resumo, filtro de coleção e presença de resumo, paginação de seis registros e ordenação por ano. Títulos completos abrem o registro; cada cartão traz uma prévia do resumo e acesso à fonte original. A busca da lista não muda os documentos nem os parâmetros dos cálculos. Indicadores topológicos e análises detalhadas ficam em seções opcionais, carregadas ao abrir; os resultados básicos não aguardam o término do SNA.

Os dossiês de documentos apresentam ano, tipo original, coleção, fonte e **resumo integral aberto**, antes das análises. Autoria, orientação, coorientação, palavras-chave e macrotema permitem continuar a exploração. Dossiês de pessoas e temas apresentam primeiro a justificativa da relação, registros associados, cobertura e trabalhos. A classificação da base é distinguida da palavra-chave autoral; relações por nome não comprovam identidade, vínculo atual ou disponibilidade para orientar. Frequências contam a presença de cada nome uma vez por registro, sem modificar os metadados ou as contagens científicas existentes.

A comparação usa nomes completos, catálogo de origem, registros incluídos/carregados, período observado, anos com registros, ausência de ano e preenchimento de resumo/palavras-chave/orientador/fonte. Uma seção complementar mostra tipos originais, nomes distintos e repetições de fonte. É possível comparar o período integral ou a interseção dos intervalos observados de todas as coleções selecionadas. A janela comum exclui registros sem ano somente dessa tabela; intervalos sobrepostos não garantem registros em todos os anos. Coleções vazias permanecem visíveis e impedem uma janela comum sem evidência. Volumes não representam qualidade, produção institucional completa, notas CAPES ou total de trabalhos únicos. A tabela mantém rolagem horizontal própria, acessível por teclado.

TCCs recebem identificação de catálogo de graduação/especialização, preservando classificações como “Outros”. Somente coleções selecionadas do catálogo de pós-graduação entram na ficha institucional/síntese de programas; TCCs não recebem notas CAPES. O registro e os critérios de [vínculos documentados](VINCULOS-CAPES.md) permanecem inalterados. A data da coleta continua explicitamente indisponível.

Títulos repetidos deixam de escolher silenciosamente um registro no dossiê. A abertura pela lista conserva índice e metadados de identidade; a busca apenas por título pede escolher coleção, ano, autoria e fonte quando há ambiguidade. O histórico distingue esses registros e preserva filtros/paginação da lista, período da comparação, abas, rolagem e foco. Referências exatas ficam no contexto local da sessão, nunca na URL; a identidade só vale dentro da mesma análise/base. **Limite mantido:** a rede científica ainda identifica documentos por título e pode agregar homônimos; a interface informa esse limite nas métricas, sem alterar o algoritmo nesta parte.

Validação: **77 testes aprovados e build concluído**, incluindo sete testes novos de cobertura, janela temporal, filtros, relações, identidade exata e links, mais um teste de histórico com títulos duplicados. Regressões de CAPES, seleção, coleções, sessão, navegação e workers mantidas. Os novos helpers verificam ausência de mutação dos documentos. No navegador:

- Ecologia + TCC Administração Pública EAD: 322 registros. Janela comum 2019–2022 mostra 81/264 e 58/58, mantendo 322 documentos na análise.
- Lista filtrada por TCC na página 2 → resumo/fonte → orientador → voltar recuperou janela, coleção, paginação e foco no acionador. Palavra-chave e macrotema abriram justificativas e trabalhos correspondentes.
- Resumo integral e fonte de um TCC disponíveis com os métodos fechados; abertura por Enter e aba Evolução Histórica recuperadas pelo histórico após reload.
- Bootstrap concluiu durante navegação/pesquisa no Dashboard, com 550 termos. Resultado, rascunho não enviado do consultor e contexto do dossiê foram recuperados após recarga.
- Seleção exclusiva de TCC: 58 registros, tipos “Outros” preservados e nenhuma ficha de programa CAPES. Busca sem resultados e limpeza por Enter recuperaram a lista completa.
- Dashboard e dossiê conferidos em 320, 390, 768 e 1440 px, sem transbordamento horizontal do conteúdo. Paginação, ações de entidades e abertura das análises acionadas por Enter; tabela rolada por teclado com foco visível.
- Nenhum erro ou aviso de console nas duas abas. Os links de fonte foram conferidos no DOM; disponibilidade remota do texto completo não foi auditada. Testes com títulos duplicados usam casos controlados; o recorte de TCC usado na interface não contém títulos idênticos.

Os algoritmos científicos, bases e vínculos curados não foram modificados nesta parte. A validação funcional não substitui avaliação com participantes; controles e alternativas de gráficos/tabelas continuam na parte 8.

## Parte 8 — leitura, exploração e exportação das visualizações

Todos os gráficos ECharts oferecem a alternativa **Ver dados em tabela**, com a mesma série representada, descrição em português, unidades e significado de cor/tamanho. Rankings preservam os nomes completos nos dados, tooltips e tabela; a abreviação permanece apenas onde necessária no desenho. Radar e longevidade adaptam os eixos à largura; rankings largos mantêm rolagem local e alternativa textual. Legendas identificam as categorias sem ocultar séries silenciosamente, mantendo equivalência com a tabela. Percentuais dos setores são apresentados no gráfico; as contagens absolutas ficam na tabela. A nuvem explicita que cores e rotação são decorativas.

O componente compartilhado de tabelas tem busca sem distinção de acentos/caixa, ordenação ascendente/descendente por cabeçalho, `aria-sort`, restauração da ordem original, paginação de 25 linhas e regiões de rolagem focáveis. A busca opera antes da paginação, inclusive em campos longos. Ordenação numérica usa valores originais, conserva empates e deixa ausências ao final; valores muito pequenos não são arredondados para zero. Nomes não ficam escondidos por reticências. Listas extensas de títulos associados podem ser expandidas dentro da célula. A centralidade memética deixou de cortar as primeiras 500 linhas; sua tabela contém a rede completa. Rankings explicitamente Top 10/20 mantêm seus recortes, informados no contexto.

CSV e JSON exportam **todas as linhas filtradas e ordenadas**, não somente a página visível. Incluem títulos completos, colunas/unidades, versão e cobertura da base, coleções, entidade atual quando pertinente, filtros, parâmetros do resultado, limites e data da exportação. JSON mantém a estrutura e precisão dos valores; valores não finitos são representados por texto explícito. CSV inclui contexto em colunas adicionais, escapa caracteres e neutraliza fórmulas em textos, sem converter números negativos em texto. Conversas, rascunhos, credenciais e preferências não relacionadas ficam fora da lista permitida para exportação. O Panorama CAPES substitui o contexto local por fonte, instituição, data de consulta e filtros oficiais; não transfere notas para coleções. O CSV ontológico para reimportação conserva o contrato existente e é identificado separadamente.

As duas redes compartilham controles por teclado para ampliar/reduzir, enquadrar, mover a câmera e pausar/retomar o movimento. O layout começa pausado, após posicionamento inicial, e o zoom aparece em texto. Tabelas pesquisáveis de nós e conexões representam o recorte visual; a tabela de nós oferece os nomes completos e a ação de explorar. São usados clones para impedir que o motor de desenho altere os resultados científicos. Câmera, vista, pausa, buscas, ordenações e páginas são recuperados pela sessão/histórico. O salvamento da câmera ocorre após o desenho, com cancelamento de callbacks ao sair da vista. Um recorte temporal vazio mantém o controle de ano acessível e desabilita ações de câmera sem efeito.

Rankings, Radar, QL, itens semelhantes, catálogo ontológico e nós da órbita permitem abrir entidades por teclado. Tokens de títulos e artefatos de IA recebem uma lista de trabalhos correspondentes, com resumo/fonte acessíveis. A navegação reutiliza **o extrator exato de cada análise**: rede memética, propagação e Foresight têm regras diferentes de acentuação/maiúsculas. A única alteração no módulo de cálculo da rede é exportar a função já existente `memesDoDocumento`; seu corpo e todos os algoritmos permanecem inalterados. As tabelas de leitura não refazem nem substituem resultados científicos.

Validação: **84 testes aprovados e build concluído**. Seis testes novos de visualização verificam busca, ordenação, empates/ausências, precisão, exportação integral com contexto, escape de CSV, privacidade e correspondência exata entre extratores; um teste adicional de navegação cobre tabela, vista e câmera sem reverter atividades/conversa. As suítes anteriores de CAPES, coleções, resultados, seleção, sessão e workers passaram. No navegador:

- Base mista de Ecologia e TCC Administração Pública EAD: 322 registros. Busca/ordenação da comparação, exportação JSON de uma linha filtrada e verificação do arquivo gerado.
- Ranking → orientador → nós da órbita → trabalho → voltar: título completo, resumo, busca e foco recuperados. Zoom, movimento, enquadramento e recorte vazio em 2010; retorno a 2026 recuperou os 31 nós e 30 conexões. Câmera anterior recuperada pelo histórico.
- Radar → tabela → biodiversidade → dossiê → voltar: busca, ordenação e foco conservados. CSV real conferido com valores originais, cortes, janela e consulta da tabela.
- Rede memética concluída durante navegação: 1.827 termos na rede completa, 330 nós e 889 arestas no recorte visual com coocorrência mínima 3. O nó “Influencia” abriu 16 trabalhos pelo extrator correspondente.
- Exportação JSON da centralidade na página 2 incluiu todas as 1.827 linhas, parâmetros e precisão numérica, sem o rascunho do consultor. Reload recuperou resultado concluído, página 2 de 74, busca dos nós, termo explorado e rascunho não enviado.
- Panorama: 84 programas em funcionamento de 90 registros oficiais. Busca por Odontologia mostrou código 41001010008P0; exportação JSON conferida com fonte/data da CAPES e sem atribuir coleção/versão local.
- Dashboard/comparação, Radar, Memética, órbita e diálogo CAPES conferidos em 320, 390, 768 e 1440 px sem transbordamento horizontal do conteúdo; tabelas e rankings largos têm rolagem própria. Os controles temporais estreitos e os nomes dos eixos foram ajustados após inspeção visual. Ações de navegação, ordenação, paginação, câmera, vistas e recorte temporal foram acionadas por teclado.
- Um aviso React sobre atualização durante o desenho da câmera foi encontrado e corrigido. A repetição posterior de navegação, redimensionamento e zoom não produziu novos avisos/erros.

Limites preservados: a órbita tem teto de 600 nós; a rede memética visual, 400 nós, mantendo métricas da rede completa. Títulos e nomes podem ser agregados pelo algoritmo original. As coordenadas do layout são visuais e podem ser regeneradas ao remontar a rede; a câmera e os controles são preservados, não uma fotografia da disposição dos nós. Exportações contextualizadas são para leitura/análise, não importações de sessão. Esta validação funcional não substitui testes com participantes ou uma auditoria completa com leitores de tela. A revisão de rótulos normativos e configuração progressiva fica na parte 9.

## Parte 9 — Foresight e Memética por níveis de uso

Implementada em 11/09/2026. A análise comum mostra primeiro fonte/dimensão, cobertura e resultados; segmentação, reamostragem, avaliação histórica, indicadores estruturais e preparação do catálogo ficam em seções avançadas. Os estados de abertura continuam na sessão e no histórico. Recolher uma seção não desmonta nem cancela os fluxos existentes.

- **Radar:** janela relativa ao último ano observado, contagens em cada período, exclusão de registros sem ano, cobertura da dimensão e cortes de frequência explícitos. A interface identifica o método efetivo: com menos de quatro termos, o K-Means existente usa percentil 65; sem termos, nenhum corte é anunciado como aplicado. As medianas dos centroides são referências visuais, não fronteiras exatas. A comparação estrita do percentil e os empates do K-Means estão documentados.
- **Interpretação:** os quatro grupos têm descrições neutras de momentum/novidade. O vínculo com as categorias originais permanece na ajuda e no contexto exportado. Novidade estrutural não é originalidade ou qualidade, e betweenness ausente pode resultar em zero. Bootstrap exibe 100 reamostragens de 85%, mediana e dispersão interquartil, sem afirmar intervalo de confiança.
- **Avaliação histórica:** opcional, disponível inclusive quando o Radar está vazio. Explica os cortes 2017–2020, os intervalos T1/T2 e a grade independente dos ajustes do Radar. Maior MCC significa melhor resultado na grade interna, sem validação externa. Os vereditos exibem os limiares efetivamente verificados, mantendo os valores originais nas exportações. Cancelar/reiniciar permanece acessível fora do expander.
- **Memética:** período e cobertura da fonte precedem contagens por títulos distintos. “Em um título” substitui mortalidade; “intervalo mediano observado” substitui meia-vida na leitura principal. Não se infere extinção, sobrevivência ou importância. Títulos iguais são agregados pelo algoritmo existente. O caso excepcional de termos sem título, incluídos no grupo complementar pelo cálculo original, é identificado sem reclassificar os resultados. Ausência de intervalos difere de intervalos válidos de zero anos.
- **Rede:** desenho e tabela precedem indicadores avançados. O corte de coocorrência é explicitamente visual, com resumo sempre visível; a restauração de parâmetros anteriores foi mantida. Foram removidos diagnósticos de saúde, monopólio, endogamia e inovação deduzidos de índices isolados. A interpretação registra falta de intervalos/testes, normalização e fallbacks quando aplicável.
- **Próximos passos:** mensagens distinguem falta de datas, dimensão sem termos, períodos inseparáveis e exclusão por frequência. Memética oferece retorno à fonte tradicional e acesso ao catálogo com foco no expander. O filtro de títulos mantém valores anteriores sem deixar o slider fora da faixa; oferece restauração para dois títulos quando o filtro esvazia os pontos. A preparação da IA é opcional e não inicia solicitações ao abrir a seção.

Preservação: nenhum algoritmo científico, worker, regra de correspondência CAPES ou mecanismo de persistência/histórico foi modificado nesta parte. Os bundles científicos continuam `data.worker-DgMjf3G2.js` e `sna.worker-DKGMnjLJ.js`. Exportações mantêm suas chaves e resultados; o contexto ganha períodos, método efetivo e correspondência entre rótulos de apresentação e nomes originais. O CSV próprio para reimportação do catálogo continua separado das exportações para leitura.

Validação realizada:

- 88 testes aprovados (84 anteriores + 4 de interpretação), build de produção e `git diff --check`. Os novos testes verificam fronteira temporal inclusiva, exclusão de anos inválidos, causas de vazio, fallback real de K-Means, categorias/vereditos compatíveis e casos de títulos repetidos/ausentes e intervalos nulos/zero. As verificações do catálogo foram executadas pelo script `test:colecoes`, no diretório esperado por suas fixtures.
- Navegador em 320, 390, 768 e 1440 px: Foresight com opções abertas e Memética com rede, indicadores e recorte abertos, sem overflow da página ou dos controles; tabelas largas conservam rolagem local. Inspeção visual em 320 px confirmou eixos/legenda do Radar e foco/legibilidade dos indicadores.
- Teclado: Enter em opções, menus, expanders, exportação e abertura de termo; Home/setas na janela e no corte; Tab da seção histórica chega ao botão de execução. Alterar o corte e restaurar parâmetros recuperou a rede anterior.
- Coleção Ecologia (264 registros, 2010–2026): janela de três anos dividiu 230 registros até 2023 e 34 em 2024–2026. Janela de um ano exibiu o fallback de percentil para um termo. Dimensão IA sem artefatos exibiu orientação; o acesso ao catálogo transferiu foco para sua seção.
- Rede concluída: 1.472 termos globais, 313 nós/861 conexões no recorte padrão. Bootstrap concluiu após navegar e voltar. Grid Search concluiu, foi reexecutado e cancelado com seção fechada, mantendo o resultado anterior e reinício manual acessível.
- Exportação JSON do Radar filtrada por “peixes” conferida: uma linha, nomes/campos originais, cobertura, segmentação efetiva e contexto; rascunho do chat ausente do arquivo. Abrir o dossiê e voltar recuperou o filtro. Recarregar recuperou filtro, parâmetros, seções, resultados e rascunho do consultor. Console sem erros ou avisos no fluxo final.

Limites: testes funcionais do agente não substituem avaliação com participantes e leitores de tela. Não foram disparados novos pedidos à IA externa. A revisão de amostragem, falhas/lotes e prévia de importação pertence à parte 10; os serviços existentes foram preservados.

## Parte 10 — contexto e recuperação da IA, importação revisável

Implementada em 12/09/2026. Consultor, sínteses e extração têm escopo explícito e execução independente da página. O painel de atividades mantém acesso e interrupção durante a navegação. Nenhum novo pedido de IA é disparado apenas por abrir a ficha ou recuperar a sessão.

- **Consultor:** informa os primeiros 1.500 registros do catálogo, até quatro palavras-chave por registro, perfis de orientadores e rankings enviados. Esse recorte segue a ordem da base e não é amostra aleatória. Resumos integrais, rascunhos não enviados e dados CAPES não entram nesse contexto. O histórico enviado tem até 20 mensagens/24.000 caracteres, incluindo a pergunta atual (máximo 8.000 caracteres); a conversa local não é truncada por esse limite. O corpo completo é limitado a 1,5 MB. Centralidade não comprova qualidade, vínculo atual ou disponibilidade para orientar.
- **Respostas parciais:** o fluxo exige confirmação explícita de término. Queda da conexão, bloqueio e limite de geração deixam uma resposta parcial identificada, nunca um falso sucesso. Repetir conserva a última pergunta e o contexto capturado para a tentativa, sem duplicar a pergunta nem perder o rascunho. Parciais anteriores podem ser consultadas e exportadas. Cancelar interrompe a espera local; o provedor pode terminar um pedido já recebido.
- **Sínteses:** geração explícita a partir de até 25 títulos/palavras-chave, com o espaçamento original e teto de 20.000 caracteres. A prévia mostra a amostra efetiva, cobertura e eventual corte. O texto anterior permanece visível quando a nova tentativa falha ou é interrompida. A exportação inclui amostra e versão da base. Sínteses válidas anteriormente salvas no cache são recuperadas sem nova chamada.
- **Extração:** lote de 5 a 1.000 documentos, em ordem da base, enviando título, resumo integral e identificador opaco de um documento por pedido, com pausa cancelável de quatro segundos. Documentos sem resumo, já enriquecidos ou com identidade ambígua não entram em um lote novo. Cada resultado concluído fica disponível para revisão; falhas são identificadas por documento. A retomada envia somente pendências e falhas. Os artefatos só passam à análise após aplicar os resultados revisados.
- **Importação:** arquivo CSV até 2 MiB/2.000 linhas, ou texto colado até 50.000 caracteres, com o mesmo parser/validador e prévia focada após a leitura. O formato atual usa identidade SHA-256 estável, versão exata da base e listas JSON. Identidades desconhecidas/ambíguas, versões incompatíveis, metadados divergentes, duplicatas e listas inválidas ficam bloqueadas. O formato antigo só aceita título exatamente igual e único. Substituições exigem marcar a opção correspondente. Não há correspondência por semelhança de nomes. Contrato e limites em [Importação de ontologia](IMPORTACAO-ONTOLOGIA.md).
- **Preservação:** navegar mantém pedidos ativos; recarregar conserva resultados/rascunhos e marca execuções como interrompidas, com retomada manual. Os novos dados usam os limites e a invalidação por base já existentes na sessão. Aguarde “Sessão salva” para recuperar o último checkpoint completo. Aplicar ontologia invalida resultados científicos dependentes dos documentos; a aplicação fica bloqueada durante cálculos, com uma segunda verificação imediatamente antes da escrita para evitar corrida. Exportações para leitura continuam separadas do CSV para reimportação.

Nenhum algoritmo científico, vínculo CAPES documentado ou formato contextualizado das visualizações mudou nesta parte. Os bundles dos workers continuam `data.worker-DgMjf3G2.js` e `sna.worker-DKGMnjLJ.js`. Mudanças nos prompts restringem afirmações ao contexto recebido; não validam automaticamente a correção semântica do texto ou dos artefatos produzidos.

Validação:

- **109 testes aprovados**, build de produção e `git diff --check`. A suíte completa agora roda com `npm run test:all`. Os 21 novos testes cobrem identidade/ambiguidade, round-trip CSV com vírgulas e quebras de linha, versão/metadados, limites, substituição, proteção durante atividade, amostragem, histórico, protocolo de streaming, cancelamento, respostas tardias, repetição, lotes, síntese anterior e recuperação. Endpoints são testados com respostas simuladas, sem chamadas à IA externa.
- No navegador, Consultor teve resposta parcial, falha, repetição sem duplicar pergunta, preservação do rascunho e cancelamento a partir de outra página. Síntese teve sucesso, falha e interrupção, mantendo o texto anterior. Navegação e reload conservaram os estados pertinentes.
- Lote de cinco documentos: quatro concluídos e uma falha; retomada cancelada, reload e nova retomada recuperaram os quatro resultados e enviaram somente a pendência. A aplicação gerou cinco registros exportáveis com identidade estável.
- CSV colado a partir da exportação: uma substituição válida, uma versão incompatível e um ID desconhecido. As duas últimas linhas permaneceram bloqueadas. A aplicação exigiu marcar substituições, ficou desabilitada durante cálculo e, ao concluir, alterou somente o documento válido. O CSV exportado confirmou cinco registros e a alteração isolada. Rascunho CSV, prévia aplicada e lote foram recuperados após reload.
- Teclado e larguras **320, 390, 768 e 1440 px**: envio, interrupção, repetição, expanders, revisão, validação, substituição, aplicação e tabelas. Página e controles sem transbordamento horizontal; tabelas extensas conservam rolagem local. Inspeção visual em 320 px confirmou título completo e foco da prévia. Console sem erros/avisos no fluxo final.

Limites da validação: as respostas de IA do navegador foram simuladas por um servidor de teste local; qualidade e disponibilidade reais do Gemini não foram avaliadas. O Mac bloqueado impediu operar o seletor nativo de arquivos. O fluxo de importação foi validado por texto colado, que usa o mesmo processamento de arquivo, incluindo prévia, aplicação e exportação. A interação com o seletor nativo permanece para conferência com o Mac desbloqueado. Avaliação com participantes e leitores de tela permanece na parte 12.

## Parte 11 — aparência, contraste e conforto de leitura

Implementada em 12/09/2026. A apresentação e o menu da análise oferecem **Aparência e conforto**, acessível também pelo menu móvel. Os ajustes são independentes dos documentos, da navegação e das atividades.

- **Temas:** escuro, claro ou acompanhar o sistema. Tokens centralizados para superfícies, textos, bordas, foco e mensagens. O âmbar continua como identidade; texto/link usa tom adequado ao fundo, separado do preenchimento dos botões principais. Textos auxiliares e placeholders ganharam contraste. Avisos, erros e sucessos mantêm a semântica nos dois temas.
- **Leitura e densidade:** opções confortável/compacta ajustam padding de cartões e linhas de tabela. Controles compartilhados têm altura mínima de 44 px e campos usam 16 px. KPIs e cabeçalhos reduzem o uso de letras maiúsculas; nomes completos quebram linha. Em tabelas estreitas, a busca passa a ocupar sua própria linha, sem comprimir o campo ao lado de “Restaurar tabela”. Tabelas extensas conservam rolagem local.
- **Estados:** foco de 3 px com afastamento, incluindo campos, sliders, resumos e regiões focáveis. Seleção nos botões compartilhados usa preenchimento, borda e traço inferior. Controles desabilitados mantêm leitura, sem herdar elevação/realce de hover. CSS inclui tratamento de cores forçadas; isso não equivale a uma auditoria completa desse modo.
- **Movimento:** respeita a preferência do sistema e permite “Reduzir sempre”. A preferência do sistema por redução tem prioridade. A redução remove animações/transições CSS, desativa animações ECharts, pausa a simulação visual das redes e impede reprodução temporal automática da órbita. Câmera e ano continuam acessíveis manualmente. Os cálculos científicos e seus indicadores textuais de progresso continuam funcionando. O hover do logotipo permanece restrito à própria imagem.
- **Gráficos:** rótulos, eixos e tooltips acompanham o tema; contornos destacam barras, pontos e nós sem mudar as categorias. Percentuais dos setores têm fundo contrastante. Rótulos dos quadrantes usam texto legível e uma amostra de cor separada; a nuvem usa cor de texto contrastante, preservando tamanho/frequência. Não há alteração de dados, cortes, classificação, formatos de exportação ou correspondências.
- **Preferências:** três valores enumerados em `localStorage`, chave `ecograd.aparencia.v1`, menos de 200 bytes, sem conteúdo da análise. Permanecem entre recargas e novas análises; não entram nas URLs, no histórico de entidades ou nas exportações científicas. Valores desconhecidos usam defaults. Falha de armazenamento mantém o ajuste em memória e informa a limitação. Não se alteram configurações do sistema operacional.

Preservação: os workers científicos permanecem `data.worker-DgMjf3G2.js` e `sna.worker-DKGMnjLJ.js`. Nenhuma função de IA, contrato de importação, vínculo CAPES ou rotina de persistência da análise foi alterada nesta parte. As preferências de aparência não disparam cálculo nem chamada ao Gemini.

Validação:

- **114 testes aprovados** (109 anteriores + 5 de aparência), build de produção e `git diff --check`. Os novos testes verificam preservação de dados/callbacks e categorias dos gráficos, ausência de mutação do store da análise, validação de preferências, prioridade do movimento reduzido do sistema e contraste dos tokens. Texto dos tokens verificados tem pelo menos 4,5:1 contra as superfícies base/painel; bordas de controles têm pelo menos 3:1. Isso não certifica todo pixel ou combinação visual como WCAG conforme.
- Diálogo em **320, 390, 768 e 1440 px**, com campos de 44 px/16 px, sem overflow. Enter abre, Tab percorre os controles e Escape fecha/restaura foco. No menu móvel, fechar o diálogo devolve o foco ao botão de aparência; fechar o menu devolve acesso à página.
- Seleção no tema claro e Dashboard, Busca, Foresight, Memética e Consultor nos dois temas, nas quatro larguras: conteúdo e controles contidos; tabelas largas com rolagem própria. Inspeções visuais no Dashboard/Radar claro e prévia de importação clara/escura em 320 px. O campo de busca estreito encontrado nessa inspeção foi corrigido e conferido novamente.
- Ecologia, 264 documentos: rascunho do Consultor preservado durante mudanças de tema e navegação; filtro “peixes” do Dashboard preservado. Rede construída após iniciar o cálculo e trocar de tema: 1.472 termos globais, 313 nós/861 conexões visíveis. Movimento reduzido manteve a rede pausada e o zoom funcionou por teclado.
- Prévia CSV por texto com título exato: uma linha válida, sem aplicação à base. Troca de tema não alterou a prévia. Recarregar recuperou rascunho CSV, prévia, rede, câmera (77%), histórico, filtro do Dashboard e rascunho do Consultor. A recuperação foi confirmada também pela árvore de acessibilidade após timeouts da automação DOM.

Limites: não houve chamadas ao Gemini nem nova importação pelo seletor nativo nesta parte. A checagem final do console por automação DOM não foi concluída devido a timeouts da ferramenta; a interface permaneceu acessível pela árvore de acessibilidade, usada para confirmar a recuperação. Preferências do sistema foram cobertas pela lógica automatizada; o sistema operacional não foi reconfigurado. Testes com leitores de tela, cores forçadas, participantes e desempenho integrado ficam para a parte 12.

## Parte 12 — avaliação integrada e entrega

Concluída tecnicamente em 12/09/2026. Relatório, cenários, limites, roteiro humano e instruções de homologação em [AVALIACAO-INTEGRADA.md](AVALIACAO-INTEGRADA.md); registros em [evidencias/parte12](evidencias/parte12).

- 114 testes sem falhas, build e comparação Python × TypeScript aprovados nos recortes cobertos. QL agora exige todas as 95 identidades não vazias antes de comparar valores. Louvain explicitamente informativo, sem igualdade assegurada.
- Gráficos/redes carregam sob demanda; JS inicial reduzido em 66,1%. Falha simulada de chunk deixa tabelas utilizáveis. Restauração da câmera adaptada à montagem adiada, verificada em 98% após reload e histórico.
- Nomes completos nos multisseletores e rótulos de aparência associados às descrições. Matriz de cinco páginas, dois temas e quatro larguras sem overflow do conteúdo principal nos cenários medidos. CAPES, aparência e prévia de importação também conferidos; Tab/Enter/Home/Escape e foco visível exercitados.
- Seleção mista com 322 documentos; navegação entre termos, orientador e trabalho; resumo/fonte; filtros e exportação CAPES reais. Chat, síntese e lote com sucesso/falha/interrupção simulados e recuperação. Importação pelo seletor nativo, aplicação de uma linha válida e bloqueio de duas incompatíveis confirmados por nova exportação.
- Nenhum algoritmo ou vínculo documental alterado nesta parte. Persistência, histórico, IA e exportações preservados. Não houve publicação. Avaliação humana, leitor de tela, IA real e desempenho em dispositivos físicos continuam como pendências explícitas de homologação.

## Sequência de construção

| Parte | Escopo e critérios de conclusão | Estado |
| --- | --- | --- |
| 1 | Identidade CAPES, correspondência conservadora, proveniência e filtros sem contradição | Implementada |
| 2 | Controlar atividades longas: progresso real/por etapas, cancelamento, estados finais e recuperação; navegar não deixa cálculo preso; resultados ligados aos parâmetros | Implementada |
| 3 | Navegação responsiva, ajuda/CAPES acessíveis, distinguir editar seleção de nova análise; validar 320/390/768/1440 px e teclado | Implementada |
| 4 | Preservar rascunhos, conversas, parâmetros e resultados durante sessão; definir restauração após reload, limites de armazenamento e invalidação por versão da base | Implementada |
| 5 | Rotas, histórico, voltar/avançar e retorno entre entidades com contexto; não incluir conversas privadas na URL | Implementada |
| 6 | Apresentação/tutorial e seleção por objetivo; metadados, duplicatas e curadoria documentada coleção→código CAPES; mostrar cobertura antes de carregar | Implementada |
| 7 | Dashboard e dossiês: resultados úteis antes dos métodos; resumo/fonte/trabalhos acessíveis; adaptar por tipo de entidade, TCC e comparação de coleções | Implementada |
| 8 | Gráficos/tabelas: unidades, legendas, alternativa textual, busca/ordenação, nomes completos, navegação, exportação com contexto e controles de rede | Implementada |
| 9 | Foresight/memética: separar uso comum e opções avançadas, períodos reais, critérios e limites, revisão de rótulos normativos e estados vazios | Implementada |
| 10 | Chat/síntese/extração: escopo e amostragem, interrupção/repetição, respostas parciais, preservação de lotes, importação com prévia e identidade estável | Implementada |
| 11 | Acabamento: tokens, contraste, tipografia, densidade, temas e movimento reduzido; semântica/foco também são corrigidos em cada parte anterior | Implementada |
| 12 | Avaliação integrada de tarefas, regressão funcional/metodológica, acessibilidade, desempenho e preparação da entrega final | Implementada; homologação humana pendente |

As partes 2–5 concretizam a infraestrutura das etapas 1–2 do plano original; as partes 6–7 correspondem à etapa 3; partes 8–9 à etapa 4; parte 10 à etapa 5; partes 11–12 às etapas 6–7. A preparação da etapa 0 é incremental, registrando a referência e os cenários antes de cada mudança.

## Avaliação com usuários

Não há tempos nem taxas de sucesso medidos com participantes ainda. Registrar referência e repetir as mesmas tarefas após as mudanças; observação do agente não substitui avaliação com usuários.

| Tarefa | Medidas |
| --- | --- |
| Selecionar coleção entre nomes parecidos | Acerto, tempo, dúvidas |
| Encontrar orientador por tema | Conclusão e entendimento da justificativa |
| Abrir trabalho e localizar resumo/fonte | Tempo, cliques e desvios |
| Investigar termo no radar | Entendimento de eixos, período e classificação |
| Alterar filtros CAPES | Correspondência entre expectativa e resultado |
| Navegar entre entidades e retornar | Recuperação do contexto |
| Interromper e retomar atividade | Preservação de texto, parâmetros e resultados |
| Repetir em celular e por teclado | Acesso, legibilidade e autonomia |

## Próximo prompt sugerido

> Prepare a homologação do EcoGrad a partir de docs/AVALIACAO-INTEGRADA.md: organize o roteiro para participantes, a auditoria com teclado e leitores de tela, o teste controlado da IA real e as medições em celular e conexão lenta. Execute as verificações disponíveis, registre as que dependem de mim e corrija bloqueios preservando algoritmos, identidades exatas e recuperação. Prepare a publicação para revisão, sem publicar ainda.

Para conferir a entrega atual, abrir http://localhost:8888, entrar na seleção, usar Todas/Nenhuma nos filtros do Panorama e restaurar. O ambiente completo é iniciado com `npm run netlify:dev` em `ecograd-web`. Verificações: `npm run test:capes` e `npm run build` no mesmo diretório.

Para validar os workers: `npm run test:workers` em `ecograd-web`. O cancelamento descarta a execução em andamento; não gera resultados científicos parciais.

Para validar a recuperação: `npm run test:session`. O build gera automaticamente `public/data/manifest.json`; mudanças no formato persistido ou no contrato dos resultados científicos exigem atualizar `SESSION_SCHEMA`.

Para validar rotas e histórico: `npm run test:navigation`. As URLs têm somente a página; o contexto do percurso permanece local à aba.

Para validar a entrada e a cobertura: `npm run test:colecoes`. O índice `public/data/colecoes-cobertura.json` é gerado em `sync:data`; alterações no formato ou nos critérios da prévia exigem atualizar `COVERAGE_SCHEMA`.

Para validar resultados e comparação: `npm run test:resultados`, complementado por `npm run test:navigation`. Filtros de apresentação não alteram a base científica.

Para validar visualizações e exportações: `npm run test:visualizacao`, `npm run test:navigation` e `npm run build`. O formato contextualizado é `ecograd-visualizacao-v1`; não contém conversas nem rascunhos.

Para validar a IA e a importação: `npm run test:ia`; para a regressão completa, incluindo endpoints simulados: `npm run test:all`.


## Bloco 13 — download por coleção

Implementado localmente, sem publicar. Transporte com arquivos verificados por hash, posições originais preservadas, aplicação atômica e mesma versão científica. Recorte misto: 64.877.098 → 363.651 bytes de documentos. 123 testes, paridade e build aprovados; carga/recuperação conferidas no navegador. [Detalhes, evidências e próximo prompt](ENTREGA-POR-COLECAO.md). Próximo bloco: corrigir H02/H03 da IA; participantes e dispositivos físicos seguem como ações do responsável.

Preferência de continuidade do projeto: ao concluir cada bloco, fornecer um prompt concreto para a etapa seguinte e identificar as ações que dependem do responsável.


## Bloco 14 — recorte e evidências de IA

Implementado localmente: escopo determinístico na síntese, texto/amostra preservados juntos em falhas, Chat sem inferência de docentes ativos por dados ausentes e extração somente do resumo com trechos e hash validados. 129 testes e build aprovados; IA real e exportação/recuperação conferidas. [Relatório e próximo prompt](IA-RASTREAVEL.md). Próximo bloco: curadoria por termo; aceite semântico e homologação humana continuam pendentes. Nenhuma publicação realizada.


## Bloco 15 — curadoria por termo

Aceite, rejeição e correção com justificativa e evidência literal; histórico e proposta original preservados, aplicação somente de aprovações salvas por ID exato. Recuperação conferida na interface, 138 testes e build aprovados. [Evidências, limites e próximo prompt](CURADORIA-POR-TERMO.md). Restam dois blocos previstos: homologação humana/assistiva/móvel e revisão final no runtime de destino. Sem publicação.


## Bloco 16 — homologação disponível

Tutorial atualizado para entrega por coleção e curadoria; abertura do catálogo identificada pelo título completo. 138 testes, paridade e build aprovados; teclado, fonte e recuperação retestados. Extrações reais arquivadas revisadas textualmente; participantes, leitores reais, aparelhos e aceite científico continuam pendentes. [Resultados, ações e próximo prompt](HOMOLOGACAO-BLOCO16.md). Nenhuma publicação.


## Bloco 17 — revisão final local

Build alinhado ao Node 24 (`.nvmrc` e engines); dados de nome fixo exigem revalidação de cache. 138 testes, build e cinco bundles Node 24 aprovados localmente. [Pacote, manifesto, plano de rollback e ações finais](REVISAO-FINAL-BLOCO17.md). Destino remoto e evidências humanas ainda pendentes; nenhuma publicação.
