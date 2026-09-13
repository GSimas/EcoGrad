# Revisão local do PR #5

PR em rascunho: https://github.com/GSimas/EcoGrad/pull/5. Head revisado `70343a5d5f2252bcea735b8ca57a104aac4f5e38`; base `c57c40a2abbe97405dc3f5c45e6c5ec43192f3a3`. Na consulta, não havia comentários, revisões ou threads de revisão. A API informou que o PR era mergeável; isso não representa aprovação.

## Bloqueios encontrados e corrigidos localmente

1. **P1 — fonte ambígua na retomada.** Criar um lote excluía IDs duplicados, mas retomar usava o primeiro documento encontrado. Dois registros com a mesma identidade podiam enviar um resumo arbitrário à IA. A retomada agora exige identidade única antes do envio e registra erro no item sem chamada de rede.
2. **P1 — perda da revisão ao retomar outra versão.** Quando a versão do lote diferia da base atual, a ação de retomada caía na criação de um lote novo, substituindo propostas anteriores. Retomadas sem lote válido, já aplicado ou de outra versão agora preservam o estado e não iniciam chamadas.
3. **P1 — sobrescrita durante indexação assíncrona.** Uma revisão alterada enquanto os IDs eram calculados podia ser substituída pelo lote preparado a partir do estado antigo. Agora análise, documentos, versão e referência do lote são revalidados antes de iniciar a extração.

As mudanças estão em `ecograd-web/src/services/ia.ts`; três regressões foram adicionadas a `ecograd-web/tests/ia.test.ts`. O algoritmo dos IDs, fontes originais, curadoria e formato de recuperação permanecem os mesmos.

## Evidências

Os três testes novos falharam contra a implementação anterior: [regressão antes](evidencias/revisao-pr5/regressao-antes.txt). Após corrigir: **143 testes aprovados, zero falhas**, incluindo curadoria, fonte literal, identidade, recuperação, Neo4j desativado e reconstituição das coleções. [Suíte completa](evidencias/revisao-pr5/testes.txt), [build](evidencias/revisao-pr5/build.txt), [resultado e hashes](evidencias/revisao-pr5/resultado.json). `git diff --check` aprovado.

As regressões usam respostas simuladas para reproduzir ambiguidade, mudança de versão e concorrência; comprovam que nenhuma chamada à IA ocorre nesses casos. Não foi executada nova chamada ao provedor real nesta revisão. Evidências reais anteriores continuam válidas somente para os cenários e versões já registrados.

## Estado e limites da revisão

A inspeção concentrou-se nos fluxos de extração/retomada, curadoria/aplicação, identidade/importação, recuperação e entrega JSON, complementada pela suíte completa e build. Não é certificação exaustiva de todos os 251 arquivos do PR.

Na etapa de revisão anterior ao commit, o Netlify foi consultado em modo de leitura: `stop_builds=true`, produção no deploy `6aa5ee23875c3a0006f75f26`. Não foram alteradas configurações remotas, publicados comentários, criados commits, feitos pushes, merge ou deploy. Naquela etapa, as correções e este relatório estavam apenas no diretório de trabalho; o PR remoto ainda contém a versão anterior e precisa receber as correções antes de aprovação final. `.DS_Store` e os documentos locais de preparação anteriores não foram incluídos em commit.

Continuam pendentes as evidências humanas de participantes, leitores de tela, celulares físicos e curadoria científica. O fluxo de build Git também deverá ser validado quando houver autorização específica, pois os builds permanecem interrompidos.

## Versionamento local

O diff foi revisado para o commit solicitado. Código e testes conferem com os hashes da execução de 143 testes e build aprovados; não houve mudança de implementação após os testes. A consulta [antes do commit](evidencias/revisao-pr5/antes-commit.json) confirma builds interrompidos e o mesmo deploy publicado. O commit reúne apenas implementação, regressões, este relatório e evidências da revisão PR #5. Os documentos de preparação da branch e `.DS_Store` ficam fora. Nenhum envio remoto está autorizado nesta etapa.

## Próximo prompt

> Confira o commit local das correções do PR #5 e confirme que os builds do Netlify continuam interrompidos. Se o bloqueio estiver confirmado, autorizo enviar somente esse commit para atualizar o PR em rascunho. Não faça merge, reative builds nem publique.
