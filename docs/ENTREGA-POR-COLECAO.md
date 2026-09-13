# Bloco 13 — download por coleção

Concluído localmente em 12/09/2026. Nenhum deploy, commit ou push. Este bloco trata a causa técnica H01 da [homologação](HOMOLOGACAO.md); o aceite em aparelhos físicos permanece pendente.

## Comportamento entregue

O worker baixa somente as coleções selecionadas. A prévia informa a soma dos arquivos comprimidos, além dos catálogos; o progresso identifica cada coleção. Seleções repetidas não geram download/registro duplicado, nomes semelhantes não se equivalem, e registros repetidos existentes na base permanecem intactos.

`sync:data` gera arquivos `colecao-<SHA256>.json.gz` e um índice no manifesto (`collections.schema = 1`). Cada arquivo contém os registros brutos e suas posições na base original. A versão científica permanece o hash das quatro fontes originais; o novo transporte não muda a identidade documental nem invalida checkpoints equivalentes. A prévia de cobertura usa schema 2, com `downloadBytes` por coleção. Não foram alterados modelos científicos, vínculos CAPES, deduplicação ou formatos de exportação.

Os downloads são sequenciais para limitar memória temporária. O leitor verifica caminho, digest do JSON descomprimido, contagem, nome exato da coleção e posições antes de normalizar com a mesma função existente. Reconstitui a ordem original PPG e depois TCC, independentemente da ordem dos controles. A versão do manifesto é conferida novamente ao terminar. Falha, arquivo truncado, hash incorreto ou atualização de base impedem a aplicação da seleção inteira; o estado anterior continua disponível. Cancelamento encerra o worker conforme o mecanismo já existente.

Não há retorno silencioso ao download de 64,9 MB se o índice/arquivo falhar. A mensagem pede atualização ou nova tentativa. Arquivos com hash revalidam o cache HTTP (`no-cache`) para permitir recuperação de entrada corrompida; uma resposta válida pode reutilizar o corpo em cache. Não é implementação de modo offline.

## Resultado do recorte de referência

| Recorte | Registros | Dados comprimidos antes | Dados comprimidos agora |
| --- | ---: | ---: | ---: |
| Programa de Pós-Graduação em Ecologia | 264 | 41.721.699 bytes | 324.638 bytes |
| TCC Administração Pública EAD | 58 | 23.155.399 bytes | 39.013 bytes |
| Seleção combinada | 322 | 64.877.098 bytes | 363.651 bytes |

Redução de **99,44% no volume dos documentos** para a seleção combinada. O manifesto atual ocupa 68.434 bytes; catálogos, prévia, JavaScript, CSS e requisições de outros serviços não entram nessa redução. Selecionar todo o acervo ainda pode exigir dezenas de MB e muita memória; não generalizar o ganho deste recorte para todas as seleções.

## Verificação executada

- **123 testes, zero falhas, 16 arquivos**: [testes.txt](evidencias/colecoes/testes.txt). Novos casos cobrem nomes exatos, ordem intercalada, duplicatas originais, coleção vazia, seleção repetida, descompressão HTTP, integridade, download incompleto, 503 após sucesso parcial, cancelamento e mudança de versão no worker real.
- O teste de geração compara **todos os registros das duas bases reais** com a reconstrução a partir das coleções, incluindo ordem e valores brutos. Hashes e contagens de todos os arquivos são conferidos. Não é apenas comparação de uma amostra ou de títulos.
- TypeScript e build de produção aprovados: [build.txt](evidencias/colecoes/build.txt), [build.json](evidencias/colecoes/build.json). Paridade Python × TS aprovada nos recortes científicos existentes: [paridade.txt](evidencias/colecoes/paridade.txt). Louvain continua estocástico.
- Versão e quatro hashes das fontes são idênticos aos de `evidencias/parte12/manifest-base.json`.
- IAB, servidor completo localhost:8888: seleção exibiu 0,35 MiB; Dashboard carregou 322 documentos (72 teses, 192 dissertações, 58 outros), 322 resumos/fontes. Após reload, “Sessão recuperada” e mesmas contagens.
- IAB, build estático de produção em 127.0.0.1:8894: mesmo resultado e recuperação. [http-local.txt](evidencias/colecoes/http-local.txt) registra somente dois GETs de arquivos de coleção e nenhum GET de base completa; reload verificou manifesto sem baixar novamente os documentos. Esse servidor estático não executa funções: os 404 de CAPES nele são esperados e não foram tratados como teste do serviço CAPES. No ambiente completo, CAPES permaneceu disponível.
- Transferência completa dos dois arquivos via curl: [transferencia.json](evidencias/colecoes/transferencia.json). Limite solicitado de 125.000 bytes/s; Ecologia 2,1604 s, TCC 0,006782 s. O limitador permite rajada inicial, visível no arquivo pequeno: **estes tempos não comprovam rede sustentada de 1 Mbps**, nem tempo de uso no celular. O volume baixado foi confirmado; a experiência física continua na matriz de homologação.

## Build, implantação futura e limites

As bases originais continuam versionadas na raiz e copiadas para `public/data` por compatibilidade e regressão; elas também permanecem em dist, mas o novo fluxo não as solicita. Portanto, o pacote estático não ficou menor: ganhou arquivos derivados. Os arquivos por coleção são gerados, ignorados pelo padrão `*.json.gz` e não devem ser adicionados manualmente ao Git. Fontes ausentes agora interrompem o build antes de publicar metadados novos, evitando releases parciais.

O manifesto é gravado por substituição ao final da geração; arquivos derivados antigos do gerador são removidos do diretório gerado. Não executar sync-data contra um diretório estático servido como produção: construir isoladamente e promover o conjunto completo. Durante atualização local, uma aba antiga pode receber erro e precisar repetir a carga.

Implantar frontend, manifesto, prévia e arquivos juntos. Os nomes com hash já se enquadram no header `/data/*.json.gz` do `netlify.toml`. Ainda testar cache, MIME, revalidação, compressão e funções no runtime remoto. O pacote `/tmp/EcoGrad-homologacao-20260912.tar` da rodada anterior é **histórico e desatualizado**; precisa ser reconstruído antes de qualquer promoção. Nenhuma publicação foi autorizada.

Permanecem pendentes: leituras de tela/participantes, celulares físicos com rede condicionada e memória, Node/runtime de destino e problemas semânticos H02/H03 da IA. O código deste bloco não tenta resolver essas questões por aproximação.

## Próximo bloco sugerido

> Continue pelo bloco 14: corrija as pendências semânticas H02 e H03 da IA em docs/RELATORIO-HOMOLOGACAO.md. Faça a síntese explicitar o recorte, impeça inferências de vínculo docente atual a partir de dados ausentes e torne a extração de métodos rastreável ao resumo, preservando IDs, revisão humana e recuperação. Execute testes e uma pequena amostra de IA real; atualize as evidências e a preparação de publicação sem publicar. Ao concluir, sugira o próximo prompt e as ações que dependem de mim.

Ação paralela do responsável: recrutar participantes e disponibilizar Android/iPhone com usuários habituais de leitores de tela conforme `HOMOLOGACAO.md`. Essas tarefas não impedem o próximo bloco de desenvolvimento.
