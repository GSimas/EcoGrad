# Bloco 17 — revisão final local e plano de publicação

> **Atualização posterior:** publicação autorizada e concluída. [Estado de produção, incidente resolvido e pendências](PUBLICACAO.md). Os estados sem autorização abaixo são históricos.

**Pacote preparado para revisão; não publicado.** Nenhum deploy de preview, vinculação de site, alteração remota, commit ou push. As evidências humanas solicitadas não foram fornecidas nesta rodada; os portões do bloco 16 continuam abertos.

## Runtime e configuração

A configuração antiga fixava Node 20. A linha está EOL segundo o [calendário oficial do Node.js](https://nodejs.org/en/about/previous-releases). O projeto agora fixa a linha **24** em `netlify.toml` e `.nvmrc`; `package.json` e lockfile declaram `>=24 <25`. Testes e build executados no **Node 24.14.1** local (macOS). Nenhuma dependência foi atualizada; somente o requisito de Node foi alinhado.

O [Netlify documenta Node 24 nas funções](https://docs.netlify.com/build/functions/configuration/). Os cinco bundles locais indicam `nodejs24.x` no manifesto. No destino, verificar se há `AWS_LAMBDA_JS_RUNTIME` sobrescrevendo a escolha: essa variável deve ser conferida na UI/CLI/API do provedor, não presumida a partir do TOML. As [variáveis de funções](https://docs.netlify.com/build/functions/environment-variables/) precisam do escopo correto no provedor; não colocar segredos no arquivo de configuração nem em variáveis `VITE_*`.

Não foi encontrado `siteId` nos estados locais da CLI e o responsável não informou o site/deploy anterior. Logo, **não houve validação remota do site, variáveis, serviços ou runtime efetivo**. Build macOS e importação de bundle não equivalem à execução Linux/AWS.

Configuração local conferida: base `ecograd-web`, comando `npm run build`, publish `dist`, cinco funções em `netlify/functions`, `/api/*` antes do fallback SPA. Arquivos de coleções com hash e assets continuam immutable. Manifestos/catálogos JSON e bases completas legadas com nomes fixos agora exigem revalidação, evitando a política anterior de um dia/um ano para nomes reutilizados. MIME gzip e codificação identity mantidos. Cabeçalhos reais de CDN exigem smoke futuro.

[Validação reproduzível da configuração](evidencias/bloco17/validar-config.py), [resultado](evidencias/bloco17/config.json). Rodar da raiz com Python 3.11+.

## Revisão das alterações acumuladas

A entrega abrange os blocos anteriores presentes no workspace, não apenas a alteração de runtime/cache. Revisão dirigida aos limites de aplicação por ID, concorrência, recuperação/versionamento, proveniência de IA, transporte por coleção e integração de funções. As alterações de apresentação e navegação ficam cobertas pelos testes e observações documentados; não se declara auditoria independente/exaustiva de todas as linhas.

- Aplicação usa identidade exata e guardas após operações assíncronas; curadoria conserva proposta original e só projeta decisões aprovadas.
- Resumos e hashes vinculam propostas às fontes; falhas não são aplicadas como ontologias vazias. Aceite semântico continua humano.
- Checkpoints conservam schema 1 e versão da base; campos de curadoria são aditivos. O rollback para versões anteriores pode ignorar recursos novos: exportações são necessárias, sem promessa de compatibilidade retroativa.
- Carregamento verifica hash/ordem e não recorre silenciosamente à base inteira. A paridade científica foi aprovada no bloco 16; código científico não foi alterado neste bloco.
- Configuração não embute credenciais. Os testes artificiais não são dados científicos nem backend de produção.
- Workspace contém muitas alterações anteriores, arquivos novos e legado de `node_modules` rastreado. Não foi usado `git add .`. `.DS_Store`, credenciais, caches e dependências de desenvolvimento não entram no pacote.

## Verificações desta rodada

| Verificação | Resultado |
| --- | --- |
| Suíte completa no Node 24.14.1 | 138 testes aprovados: [log](evidencias/bloco17/testes.txt) |
| TypeScript e Vite | Aprovados: [build](evidencias/bloco17/build.txt), [volume](evidencias/bloco17/build.json) |
| Empacotamento Netlify | Cinco funções: [log](evidencias/bloco17/funcoes.txt), [manifesto](evidencias/bloco17/manifesto-funcoes.json) |
| Importação dos bundles e entradas inválidas | 5/5, offline: [smoke](evidencias/bloco17/smoke-bundles.json) |
| Paridade científica | Resultado do bloco 16 preservado: [log](evidencias/bloco16/paridade.txt); nenhum algoritmo modificado nesta rodada |
| Configuração, lockfile e cache | Conferidos estaticamente; não é teste da CDN |
| Pacote | Caminhos seguros, lista explícita, hashes de todos os membros e inspeção de exclusões; [resultado](evidencias/bloco17/pacote-verificado.json) |

A primeira tentativa da CLI encontrou restrição de escrita em preferências locais; a repetição autorizada empacotou as funções. Nenhum deploy foi executado. Não houve nova chamada Gemini ou Neo4j; os resultados reais anteriores permanecem nos relatórios de IA.

## Pacote local

Arquivo: `/tmp/EcoGrad-bloco17-revisao.tar`. É pacote de inspeção, não comando de deploy nem backup da versão anterior. Contém frontend em `ecograd-web/dist`, cinco ZIPs em `functions`, configuração, fontes frontend/funções/scripts/testes e arquivos de build explicitamente selecionados, além deste plano. O manifesto registra hashes do workspace e de cada membro. O pacote não é checkout Git completo; as bases de entrada estão em dist e não são duplicadas na raiz. Para reconstrução completa, usar o workspace registrado e os lockfiles, com `npm ci` no runtime escolhido.

Integridade externa: [pacote.sha256](evidencias/bloco17/pacote.sha256). Manifesto interno e cópia para revisão: [manifesto](evidencias/bloco17/manifesto.json). Qualquer mudança posterior exige reconstrução, novos hashes e retestes pertinentes. `/tmp` pode ser limpo pelo sistema; conservar o artefato em local aprovado antes da revisão final.

Título proposto para revisão: **“Concluir fluxos de análise, recuperação e curadoria rastreável do EcoGrad; preparar runtime Node 24”**.

Descrição proposta: “Entrega seleção por identidade, download por coleção, navegação e recuperação de contexto, revisão de IA com fontes e curadoria por termo. Alinha build/funções ao Node 24 e revalidação de dados com nomes fixos. Testes, paridade documentada, build e bundles locais aprovados. Publicação depende de homologação humana/assistiva/móvel, aceite científico e smoke/rollback no destino identificado.”

## Plano de rollback — preparado, ainda não executável

Antes de autorizar qualquer publicação, preencher:

| Campo | Situação |
| --- | --- |
| Site/ID e ambiente | Pendente do responsável |
| Deploy anterior conhecido bom | Pendente; não inventar ID ou usar um pacote de teste como versão anterior |
| Responsável pela promoção e restauração | Pendente |
| Manifesto/hashes do deploy anterior e versão dos dados | Pendente |
| Referência segura às configurações/variáveis anteriores | Pendente; somente nomes/referências no relatório |
| Exportações das análises afetadas | Fazer antes do ensaio, sem limpar armazenamento pessoal |

1. Antes da mudança, registrar o deploy anterior, confirmar que pode ser restaurado no provedor e conservar sua configuração. Separar o ensaio da produção e das sessões pessoais.
2. Gatilhos de retorno: identidade incorreta, perda de dados/sessão, mistura de versões, falha essencial de funções, bloqueio assistivo ou interpretação científica indevida sem mitigação. Suspender a promoção e registrar ocorrência.
3. Restaurar o **deploy completo anterior** pelo mecanismo de publicação de deploy existente do Netlify, após autorização, incluindo frontend/funções/dados. Conferir separadamente variáveis e configuração: um retorno de deploy não deve ser presumido como restauração automática delas. Não editar os dados para simular sucesso.
4. Em perfil isolado, conferir index/assets/worker, manifesto, hash de coleção, rotas `/api/*`, cache, seleção, documento por ID, retorno, exportação e recuperação. Conferir CAPES e serviços habilitados. Alterações de base/schema podem impedir recuperação de sessão nova em versão antiga; manter exportações e não apagar checkpoints para ocultar incompatibilidade.
5. Registrar horários, deploy anterior/restaurado, hashes, resultado de cada smoke e decisão do responsável. Sem site e ensaio real, classificar rollback como **não validado operacionalmente**.

Nenhum comando de restauração foi executado nesta rodada.

## Portões para decisão final

- **Aprovados localmente:** configuração revisada, 138 testes, build, cinco bundles Node 24, smoke offline e integridade do pacote.
- **Pendentes:** fichas de participantes; NVDA/VoiceOver/TalkBack reais; Android/iPhone com rede condicionada; curador de IA/CAPES; confirmação de site, variáveis, runtime efetivo e serviços; build limpo no ambiente de destino; teste de CDN e rollback.
- **Não autorizada:** disponibilização remota, mesmo preview. Não abrir PR/push que possa disparar deploy automático sem instrução correspondente.

O responsável deve fornecer o site e deploy anterior, as fichas anonimizadas e o aceite do curador. Depois desses portões, revisar pacote/hash e decidir explicitamente se autoriza homologação remota ou publicação. Não há novo bloco funcional obrigatório previsto; faltam fechamento das validações e decisão de release, podendo haver correções a partir dos achados.

## Próximo prompt sugerido

> Finalize a revisão de release usando docs/REVISAO-FINAL-BLOCO17.md. O site/ambiente é [ID], o deploy anterior estável é [ID] e as evidências humanas/decisões do curador estão em [caminhos]. Incorpore os resultados, corrija os bloqueios e reteste o necessário. Atualize o pacote e apresente os portões aprovados e pendentes, sem publicar até minha autorização explícita.
