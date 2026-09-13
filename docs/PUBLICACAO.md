# Publicação do EcoGrad

Publicação em produção autorizada explicitamente pelo responsável nesta conversa e concluída em **13/09/2026 00:31:44 UTC (12/09, 21:31:44 em Brasília)**.

- Site: `e2e5db90-ff63-4958-8451-a1aeaae70f6e` — ecograd.
- Endereços: https://ecograd.netlify.app e https://ecograd.gustavosimas.com.
- Deploy final: `6aa5ee23875c3a0006f75f26`, estado `ready`.
- [Console do deploy](https://app.netlify.com/projects/ecograd/deploys/6aa5ee23875c3a0006f75f26).
- Referência anterior: `6a947f736239ed000876648d`.

## Incidente durante a publicação e resolução

O primeiro envio de ZIPs avulsos com `--no-build` publicou `6aa5ecf2018fd6375ba4044d` sem os metadados de streaming. As funções retornaram 502. O smoke detectou o erro e a produção foi restaurada ao deploy anterior às 00:25:44 UTC. Um candidato sem build, `6aa5eda5d68ee8805b175337`, também apresentou o problema e não foi promovido.

Após vincular explicitamente o workspace ao site correto, foi executado o **build integrado do Netlify**. O candidato `6aa5ee23875c3a0006f75f26` preservou `invocationMode=stream`, `runtimeAPIVersion=2` e `nodejs24.x` em todas as cinco funções. Ele foi validado antes de ser promovido. Nenhuma mudança nos algoritmos, IDs ou fontes da aplicação foi necessária para resolver o incidente.

**Não promover os ZIPs dos pacotes de revisão anteriores isoladamente com `--functions`.** Eles servem para inspeção. Para futuros deploys, usar o pipeline integrado com manifesto de funções e confirmar os metadados no destino antes de promoção. O rollback do site foi exercitado; isso não comprova compatibilidade retroativa de todas as sessões ou restauração de variáveis.

A revisão automática bloqueou uma tentativa por dúvida sobre o destino. A vinculação local ao ID autorizado foi comprovada, a tentativa seguinte foi autorizada e concluída. Não restou bloqueio de aprovação.

## Verificações

- Referência anterior e integridade inicial: [antes](evidencias/publicacao/antes.json).
- Falha inicial preservada: [smoke](evidencias/publicacao/smoke.json).
- Restauração executada: [rollback](evidencias/publicacao/rollback.json).
- Build integrado: [deploy](evidencias/publicacao/deploy-integrado.json).
- Candidato final: [smoke](evidencias/publicacao/smoke-integrado.json) — página/assets, manifesto, coleção/hash, rotas, CAPES e extração real do boletim aprovados. A extração não foi aplicada à base.
- Produção final: [estado/runtime](evidencias/publicacao/final.json), [domínios/assets/API](evidencias/publicacao/dominios-finais.json).

Nos dois domínios, os quatro assets iniciais retornaram 200 e hashes iguais ao build; a API Gemini respondeu 405 ao GET, conforme o contrato. O HTML de `ecograd.netlify.app` não foi byte a byte idêntico ao local; os assets referenciados são os esperados. O domínio principal entregou HTML idêntico ao build. O registro separa identidade de assets de identidade de HTML, sem afirmar checksum integral onde houve diferença.

O build local já tinha 138 testes aprovados e paridade científica documentada; a publicação acrescentou testes remotos e build integrado. Não houve nova avaliação com participantes ou aparelhos físicos.

## Pendências explícitas

1. **Neo4j indisponível:** ping retorna 502, com falha de descoberta de servidores. A mesma falha foi reproduzida no deploy anterior: [comparação](evidencias/publicacao/neo4j-anterior.json). Não é regressão identificada desta release. O frontend atual não chama esse endpoint. Conferir disponibilidade/URI/configuração do serviço sem expor credenciais.
2. **Homologação humana:** participantes, leitores reais, celulares e aceite do curador ainda não entregues. A autorização de publicação não foi registrada como se fosse evidência desses testes.
3. **Versionamento:** o deploy foi realizado a partir do workspace local; não houve commit ou push. Antes de outra publicação automática pelo Git, versionar/revisar o código atual para evitar substituir esta release por uma revisão antiga. Não executar `git add .` indiscriminadamente.

Os relatórios “sem publicar” anteriores documentam estados históricos. Esta publicação foi uma autorização posterior e não altera os resultados históricos.

## Próximo prompt

> Investigue a indisponibilidade do Neo4j em produção sem expor credenciais nem alterar dados. Prepare também o versionamento das alterações publicadas, revisando os arquivos a incluir e evitando caches e segredos. Incorpore as evidências humanas que eu fornecer, teste as correções e apresente o resultado antes de novo deploy.
