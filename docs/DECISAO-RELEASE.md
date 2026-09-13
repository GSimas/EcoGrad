# Decisão de prontidão de release

> **Atualização posterior:** publicação autorizada e concluída. [Estado de produção, incidente resolvido e pendências](PUBLICACAO.md). Os estados sem autorização abaixo são históricos.

**NÃO PRONTA PARA PUBLICAÇÃO. Pronta para revisão técnica local.** Nenhuma publicação ou alteração remota realizada.

A solicitação recebida contém os marcadores literais `[ID]` para site/deploy e `[caminhos]` para evidências. Eles não foram tratados como valores reais. Nenhuma evidência humana nova foi localizada no repositório em comparação ao manifesto do bloco 17.

## Conferência executada

- Checksum externo e hashes internos do pacote do bloco 17 conferidos: íntegros.
- Fontes, configuração e evidências existentes idênticas às do pacote anterior.
- Permanecem válidos os registros de 138 testes aprovados, build Node 24.14.1, cinco bundles `nodejs24.x`, smoke offline e paridade documentada. Não são testes executados novamente nesta rodada.
- Sem mudanças de código, não houve correção adicional nem repetição da suíte. Esta rodada atualiza apenas o registro de decisão e o pacote de revisão.
- Pacote anterior preservado. Nova cópia: `/tmp/EcoGrad-release-revisao.tar`, com esta decisão e manifesto atualizado. [Manifesto](evidencias/release/manifesto.json), [checksum](evidencias/release/pacote.sha256), [verificação](evidencias/release/pacote-verificado.json).

## Bloqueios ao aceite

| Item | Evidência disponível | Falta para fechar |
| --- | --- | --- |
| Site e ambiente | Não identificado | ID real do site e ambiente pretendido |
| Rollback | Plano documentado | Deploy anterior estável, responsável e ensaio no destino |
| Runtime e configuração remotos | Validação local Node 24 | Conferir runtime efetivo, variáveis por escopo e serviços no site |
| Participantes | Roteiros preparados | Fichas anonimizadas com tarefas, resultados, dificuldades e retestes |
| Leitores de tela | Inspeção local de teclado/árvore acessível | Registros com leitores reais, versões, anúncios e bloqueios |
| Celulares e rede | Transferência HTTP local limitada | Medições em aparelhos físicos e perfil de rede efetivo |
| Curadoria | Revisão textual preliminar das extrações reais | Aceite/correção/rejeição por especialista com justificativa e evidência |

Não é possível incorporar resultados ausentes, atribuir aceite a participantes não observados ou presumir rollback operacional. Não houve conexão ao destino usando os marcadores fornecidos.

## Ações finais do responsável

1. Informar ID real do site Netlify, ambiente e ID do deploy anterior conhecido como estável. Se não houver deploy anterior, declarar que se trata da primeira publicação, para ajustar o plano de reversão.
2. Indicar caminhos reais das fichas anonimizadas e decisões do curador. Se os testes não ocorreram, organizar sua execução conforme [plano de homologação](HOMOLOGACAO.md).
3. Após incorporação e reteste de achados, revisar o pacote/hash e os portões. A publicação exige autorização explícita posterior; esta revisão não concede esse aceite.

Referência técnica e plano de rollback: [revisão final do bloco 17](REVISAO-FINAL-BLOCO17.md).

Próximo prompt, preenchido com os valores reais:

> O site Netlify é …, o ambiente é …, e o deploy anterior estável é … (ou esta será a primeira publicação). As evidências humanas e decisões do curador estão em …. Finalize os portões de docs/DECISAO-RELEASE.md, corrija e reteste os achados e atualize a decisão de prontidão, sem publicar.
