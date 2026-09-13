# JSON como fonte atual; Neo4j legado e versionamento

## Decisão implementada localmente

A aplicação web continua usando arquivos JSON por coleção, com hashes, IDs e cálculos locais existentes. Nenhum fluxo em `ecograd-web/src` chama `neo4j-query` ou importa o driver. Não foi iniciada migração para Supabase; essa alternativa fica para um escopo futuro, se houver necessidade de persistência compartilhada.

O endpoint legado `neo4j-query` agora responde **410 Gone / NEO4J_DISABLED**, sem interpretar corpo, ler credenciais ou tentar conectar ao banco. Manter essa resposta evita que uma rota antiga vire HTML do fallback SPA. O driver e suas entradas exclusivas foram removidos do package/lockfile da aplicação web; a configuração Netlify não externaliza mais o driver. O exemplo de ambiente e o README deixam de exigir credenciais Neo4j.

O backend Python histórico não foi modificado. Seu uso anterior de Neo4j e os arquivos de dados permanecem preservados. Nenhuma instância, credencial remota, banco ou dado foi removido. A nova resposta 410 só chegará à produção após outro deploy autorizado; por enquanto a versão publicada ainda contém o endpoint antigo.

## Investigação da conexão

O ping do deploy atual e do anterior retornou 502 com falha de descoberta de servidores de roteamento. Esses resultados já estão registrados em [produção](PUBLICACAO.md) e [comparação anterior](evidencias/publicacao/neo4j-anterior.json). Isso identifica a etapa da falha, mas não prova se a causa é instância pausada, URI obsoleta, rede ou configuração.

Nesta rodada, tentou-se obter somente a URI no contexto production/escopo functions, capturando a saída da CLI em memória. Não foi obtido valor utilizável. Portanto, DNS/TCP/TLS não foram testados, usuário/senha não foram consultados e a causa de infraestrutura permanece **não determinada**. [Diagnóstico sem host/credenciais](evidencias/sem-neo4j/diagnostico.json). Não seria correto declarar senha incorreta ou instância excluída com essa evidência.

Como a integração não faz parte do produto atual, a correção é desligar a dependência web, em vez de exigir a restauração de um banco desnecessário. Não foi removida configuração remota, o que também preserva a possibilidade de retorno à versão anterior.

## Testes

[Suíte completa](evidencias/sem-neo4j/testes.txt) e [build](evidencias/sem-neo4j/build.txt). Os testes novos verificam HTTP 410 para métodos e corpos distintos, ausência de rede e não propagação de conteúdo enviado pelo cliente. Testes existentes continuam cobrindo identidade, curadoria, fontes, sessão e recuperação. Os arquivos científicos não foram alterados.

## Preparação de versionamento

A revisão inclui as alterações da aplicação publicadas nos blocos anteriores, sua documentação/evidências e a correção local de desativação. O histórico de produção continua identificado pelo deploy, não por um commit novo. A lista exata para staging e a varredura estão em [seleção de arquivos](evidencias/sem-neo4j/versionamento.json).

Não incluir `.DS_Store`, `.env`, `.netlify`, build/dist, caches ou `node_modules`. O repositório já contém milhares de arquivos de dependências rastreados: este legado não foi removido em massa nesta tarefa. A alteração local de `.DS_Store` não pertence à entrega. O `.gitignore` foi reforçado; isso não remove arquivos já rastreados.

Antes de publicar novamente: conferir o diff preparado, criar o commit local e escolher o fluxo de revisão/merge. Um push pode disparar deploy automático: só fazê-lo com autorização para esse efeito. Para deploy, usar o build integrado do Netlify e confirmar metadados de streaming; não enviar ZIPs avulsos como ocorrido no incidente documentado.

## Próximo prompt

> Revise o diff preparado, crie o commit das alterações do EcoGrad com JSON e Neo4j desativado e apresente o resumo. Não faça push nem deploy ainda. Preserve as pendências de homologação e indique o comando e os cuidados para a próxima publicação.
