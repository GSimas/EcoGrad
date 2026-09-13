# Publicação — pacote para revisão, sem publicar

> **Atualização posterior:** publicação autorizada e concluída. [Estado de produção, incidente resolvido e pendências](PUBLICACAO.md). Os estados sem autorização abaixo são históricos.

> **Estado atual — bloco 17:** [revisão final e rollback](REVISAO-FINAL-BLOCO17.md). Pacote atual `/tmp/EcoGrad-bloco17-revisao.tar`; Node 24, 138 testes e cinco bundles validados localmente. As configurações Node 20 e pacotes abaixo são históricos. Homologação humana e destino remoto continuam pendentes. Nada publicado.

> Bloco 16: [homologação disponível](HOMOLOGACAO-BLOCO16.md) executada, com duas correções de interface, 138 testes, paridade e build aprovados. Não há resultados humanos/físicos recebidos; aceite segue pendente. Pacotes anteriores não incluem as mudanças atuais. Sem publicação.

> Bloco 15: [curadoria por termo](CURADORIA-POR-TERMO.md) implementada localmente; 138 testes e build aprovados. Evidências atuais no relatório vinculado. Pacotes anteriores são históricos e não incluem esta alteração. Aceite científico, avaliação humana/assistiva/móvel e runtime de destino continuam pendentes. Nenhuma publicação realizada.

> Bloco 14: [IA rastreável](IA-RASTREAVEL.md) corrige H02/H03 e registra retestes reais, inclusive falhas. Aceite do curador ainda pendente; os resultados e pacotes descritos originalmente abaixo são históricos.

> Atualização posterior: [bloco 13 — entrega por coleção](ENTREGA-POR-COLECAO.md) implementado e testado. Este documento registra a rodada anterior; seu pacote/hashes de release não representam o código atual. H01 foi mitigado tecnicamente, mas segue pendente de medição física. H02–H05 continuam pendentes.

Estado em 12/09/2026: **artefatos locais preparados; release NÃO autorizada**. [Plano](HOMOLOGACAO.md) e [resultados/pendências](RELATORIO-HOMOLOGACAO.md). O pedido atual exclui inclusive deploy de preview: nenhum recurso remoto novo foi criado.

## Escopo para o revisor

A entrega cobre todas as alterações das partes 1–12 já presentes no workspace (muitos arquivos modificados e ainda não rastreados), não só os documentos desta rodada. Revisar identidade CAPES, coleções, recuperação, navegação, IA/importação, alternativas textuais, aparência e carregamento adiado. Esta rodada acrescenta plano/fichas, evidências, script de smoke real e pacote local; não modifica algoritmos, base ou contratos de sessão.

Título sugerido para revisão: “Preparar homologação integrada do EcoGrad e validar artefatos locais”. Descrição sugerida: “Organiza sessões formativas, auditoria assistiva, validação de IA e medições móveis. Repete 114 testes, paridade, build e empacotamento das cinco funções; smoke real encontra pendências semânticas e reforça limite de transferência das bases. Publicação permanece condicionada a homologação humana, revisão científica e runtime de destino.”

## Artefato preparado

Arquivo local: `/tmp/EcoGrad-homologacao-20260912.tar`, contendo `ecograd-web/dist`, `netlify.toml`, manifesto de revisão e os cinco ZIPs em `ecograd-homologacao-functions`. É um pacote de inspeção, não um comando/script de deploy. Não contém `.env`, `node_modules` de desenvolvimento, fixture manual ou propostas ontológicas para aplicação. Os ZIPs incluem apenas as dependências de runtime empacotadas pela CLI. `/tmp` pode ser limpo pelo sistema: conservar o pacote em armazenamento aprovado se necessário.

Integridade: [pacote.sha256](evidencias/homologacao/pacote.sha256), [manifest-revisao.json](evidencias/homologacao/manifest-revisao.json). O manifesto registra HEAD de origem, workspace sujo, hashes das fontes, dist e funções. HEAD sozinho não identifica a entrega porque as partes anteriores ainda não foram commitadas. Qualquer mudança de fonte/dados exige reconstrução e novo manifesto. Este pacote não é backup da versão anterior.

Verificar o arquivo, na raiz: `shasum -a 256 -c docs/evidencias/homologacao/pacote.sha256`. Para reproduzir artefatos, usar as fontes cujos hashes constam no manifesto:

```bash
npm --prefix ecograd-web run test:all
npm --prefix ecograd-web run verify:parity
npm --prefix ecograd-web run build
npm --prefix ecograd-web run report:build
ecograd-web/node_modules/.bin/netlify functions:build --src ecograd-web/netlify/functions --functions /tmp/ecograd-homologacao-functions
```

## Revisão de dados, runtime e configuração

- `netlify.toml` na raiz: base `ecograd-web`, publish `dist`, funções `netlify/functions`; `/api/*` antes do fallback SPA. Cinco endpoints empacotados; `_shared`/`lib` não geraram endpoint extra.
- Bases `.json.gz` e lockfiles estão rastreados na raiz/app. `sync:data` copia para `public/data` e gera manifesto/cobertura antes do build. As cópias geradas são ignoradas e estão em dist. Conferir hashes do pacote, não promover CSV/resultados artificiais de `docs/evidencias/parte12` à base.
- Runtime configurado Node 20; máquina local Node 24.14.1. Reproduzir no Node configurado e confirmar a disponibilidade desse runtime no destino antes de decidir release. Não se verificou compatibilidade na infraestrutura remota nesta rodada.
- Conferir no contexto de homologação e depois produção, apenas no servidor: `GEMINI_API_KEY`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`. Não usar prefixo VITE para segredos. Credencial Gemini local funcionou; credenciais/consulta Neo4j e variáveis remotas não foram verificadas. Ausência desses serviços deve ser explícita no aceite.
- Dados `.json.gz` têm nomes fixos e cache immutable de um ano; o carregador usa `cache: 'no-cache'`. Conferir revalidação real na CDN ao trocar base/manifesto: cache misturando versões deve bloquear release. Conferir MIME/Content-Encoding e descompressão no destino; não aplicar duas descompressões.
- Conferir a seleção dos arquivos a versionar: não incluir `.DS_Store`, `.env`, caches, dist ou `node_modules` acidentais. Não executar `git add .`; há alterações preexistentes e `node_modules` já rastreados no repositório. Revisar esse legado separadamente sem removê-lo automaticamente.

## Portões antes de disponibilizar a terceiros

| Portão | Situação | Evidência necessária |
| --- | --- | --- |
| Testes, paridade e build local | Aprovado | Logs e hashes desta rodada. |
| Build no runtime de destino | Pendente | Mesma versão de fontes/dados/funções. |
| IA semântica e UI real | Pendente H02/H03 | Revisão humana, retomada/reload e nenhuma aplicação automática. |
| Participantes e acessibilidade | Pendente H04 | Fichas, falhas corrigidas e reteste. |
| Celular/rede/memória | Pendente H01 | Medições físicas e decisão de escopo/orçamento. |
| CAPES e curadoria | Pendente revisão | Conferir `VINCULOS-CAPES.md`; nenhuma transferência por similaridade. |
| Ambiente remoto/rollback | Pendente H05 | Site escolhido, acesso, versão anterior e smoke. |
| Autorização para publicar | Não concedida | Pedido explícito posterior ao aceite. |

Após autorização separada para criar homologação remota, usar ambiente restrito de revisão e promover exatamente os artefatos aceitos. Conferir index/assets/workers/dados/manifesto, rotas diretas, CAPES, funções Gemini e Neo4j conforme escopo; seleção, cancelar, salvar/recarregar, voltar, exportar/importar por ID e recuperação após falha de chunk. Não reutilizar servidores de fixture como backend. Esta etapa futura não foi executada.

## Retorno à versão anterior

Antes de qualquer release, registrar site/ID __, deploy anterior conhecido bom __, revisão de código __, hash dos dados __, configuração/variáveis (somente nomes e referência segura) __, responsável __. Preservar artefatos anteriores e confirmar acesso para restaurá-los. Sem esse registro não há rollback preparado para execução.

Gatilhos: perda de sessão/dados, identidade equivocada, falha crítica de acessibilidade, versão mista de dados, função indisponível ou resposta científica indevida sem mitigação. Responsável interrompe promoção, restaura no provedor o deploy anterior completo (frontend/funções/dados), verifica manifesto/cache e repete smoke de seleção, sessão, CAPES e IA. Contratos incompatíveis podem invalidar checkpoints: não prometer recuperação retroativa; preservar exportações locais antes de teste de retorno. Registrar horário, motivo e evidência. Não alterar base para fazer o rollback “passar”.

Aceite de revisão: responsável __; data __; pacote/hash __; pendências aceitas justificadamente __; decisão __. Publicação só com pedido separado.


## Artefato local após bloco 14

Pacote de inspeção atualizado: `/tmp/EcoGrad-bloco14-revisao.tar`. [Manifesto](evidencias/ia-semantica/manifest-final.json), [checksum](evidencias/ia-semantica/pacote.sha256) e [resultados do bloco](IA-RASTREAVEL.md). Este é o artefato atual para revisão; os pacotes citados anteriormente são históricos. Inclui fontes por hash no manifesto, dist e cinco funções; não contém credenciais. Continua pendente o aceite semântico humano, testes físicos e validação do runtime remoto. Sem autorização de deploy.
