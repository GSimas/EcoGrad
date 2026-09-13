# Curadoria de coleções e códigos CAPES

Verificação inicial: **11/09/2026** (horário de Brasília). Este registro documenta evidências, lacunas e decisões de atribuição. Não é uma tabela completa de correspondência de todos os acervos.

## Regra de atribuição

A identidade do repositório (`setSpec`/handle) e o código de programa da CAPES são identificadores de sistemas diferentes. Igualdade de nomes, remoção de acentos, prefixos ou qualificadores e semelhança textual **não comprovam** uma relação entre eles.

Para publicar um vínculo, registrar a coleção exata, a instituição, o código de programa, a modalidade, as URLs das fontes, a data da verificação e uma justificativa documental. Exigir uma fonte institucional que relacione explicitamente o programa à coleção e uma fonte oficial que identifique seu código. Renomeações ou sucessões exigem atos/documentos específicos. Não estender um vínculo a coleções irmãs nem a acervos históricos.

O registro executável está em `ecograd-web/src/data/vinculos-capes.json`. A ficha consulta o código e confere instituição, nome oficial e modalidade. Ausência do código ou divergência exige revisão; não procura um substituto por similaridade. O Panorama institucional permanece independente dessa curadoria. Notas e situações não são congeladas no registro de vínculos.

## Vínculo documentado nesta entrega

| Chave exata no catálogo local | Identificador do repositório | Código de programa CAPES | Modalidade |
| --- | --- | --- | --- |
| Programa de Pós-Graduação em Odontologia (ID: 74720) | col_123456789_74720 / 123456789/74720 | 41001010008P0 | Acadêmico |

Evidências e cadeia de identificação:

1. A página [Repositório dissertações e teses do PPGO/UFSC](https://ppgo.ufsc.br/repositorio-dissertacoes-e-teses/) aponta explicitamente para o handle `123456789/74720`, identificando-o como o acervo de dissertações e teses do programa. A página identifica o PPGO e a UFSC nos contatos.
2. O [Edital conjunto FAPESC/CAPES 06/2023, Anexo I, página 21](https://fapesc.sc.gov.br/wp-content/uploads/2023/07/edital-de-cahamada-publica_06_2023_bolsas_fapesc_capes.pdf) relaciona Odontologia, UFSC e código `41001010008P0`. É evidência histórica da identidade; não é a fonte da nota atual.
3. O [catálogo oficial CAPES da IES 4362](https://apigw-proxy.capes.gov.br/observatorio/data/observatorio/ppg?query=id-ies%3A%284362%29&size=100), consultado pelo proxy local com TLS validado em `2026-09-12T00:04:58.323Z` (11/09 às 21:04 em Brasília), confirmou nome ODONTOLOGIA, código e modalidade ACADÊMICO. O campo `Código` identifica programa, não o identificador de curso/nível.
4. O arquivo local `programas_ufsc.json` relaciona esse setSpec à chave com sufixo **(ID: 74720)**. O nome sem sufixo aponta para **outra coleção** (`214138`), portanto não recebe este vínculo.

O catálogo local contém quatro acervos com o nome-base Odontologia. Na versão `6c9b93b97aa1…`, têm 35 registros (`214138`), 771 (`74720`), 1 (`7843`) e 1 (`7844`). Apenas `74720` está documentado acima. Os registros não foram fundidos ou deduplicados pelo EcoGrad.

## Pendências explícitas

| Coleção ou conjunto | Situação | O que falta para atribuir |
| --- | --- | --- |
| Odontologia: 214138, 7843 e 7844 | Não verificado | Documento institucional relacionando cada acervo ao código; não herdam o vínculo de 74720 |
| Ecologia: 93354 | Não verificado | Evidência documental da ligação da coleção exata ao programa; nome único ECOLOGIA e código 41001010071P4 no catálogo CAPES não bastam |
| Direito: 74708 e Direito (Mestrado Profissional): 193245 | Não verificado | Evidência institucional da coleção exata e da modalidade. A CAPES tem DIREITO acadêmico 41001010011P1 e profissional 41001010158P2; os nomes não resolvem a atribuição |
| Outras coleções de pós-graduação | Não verificadas nesta entrega | Repetir a cadeia documental, inclusive para renomeações e acervos históricos |
| Catálogo TCC (inclui especializações) | Sem atribuição CAPES | Não atribuir nota de um programa stricto sensu à coleção de TCCs |

Cobertura inicial da curadoria: **1 das 129 entradas** do catálogo de pós-graduação. “Não verificado” não significa “não existe na CAPES”. Sugestões por nome podem aparecer para conferência, separadas da ficha e sem transferência de nota. Falha de rede não pode ser apresentada como ausência de programa.

## Como ampliar ou revisar

1. Localizar a coleção pelo setSpec/handle, mantendo a chave original do catálogo local.
2. Encontrar documento institucional explícito que a relacione ao programa e fonte oficial que informe seu código/IES/modalidade. Guardar página/seção e data; não inferir continuidade pelo nome.
3. Acrescentar o registro de evidências e o vínculo exato ao JSON, ou retirar/revisar um vínculo contestado. Nunca gerar esse arquivo por pontuação de similaridade.
4. Conferir o código na consulta atual da CAPES. Rodar `npm run test:colecoes` e `npm run test:capes`; verificar a prévia e a ficha no navegador, inclusive as coleções irmãs que devem permanecer sem atribuição.

## Cobertura local antes do carregamento

`npm run sync:data` gera `public/data/colecoes-cobertura.json` a partir dos quatro arquivos da base. A prévia atual tem 264 entradas (129 pós-graduação e 135 TCC) e cerca de 75 KiB. Não baixa documentos para mostrar metadados. Cada entrada conta registros com o **mesmo nome de origem exato** usado pelo carregador, preserva os tipos originais, informa mínimo/máximo dos anos interpretados pelo carregador e a presença de campos. Não recalcula indicadores científicos.

O intervalo não garante continuidade anual, atualidade ou validade de cada data. Presença de resumo, palavras-chave, orientador e URL não verifica qualidade, autoria ou acesso ao texto completo. Níveis como “Outros” e classificações inconsistentes são exibidos sem correção inferida. Links repetidos são contados após normalizar somente a variante `/xmlui/handle/`; não há deduplicação de documentos nem estimativa de sobreposição entre coleções.

A versão da prévia deve coincidir com o manifesto; a versão é conferida antes e depois da consulta. Arquivos de origem ausentes, prévia incompatível ou erro de consulta deixam a cobertura indisponível, nunca artificialmente zero. A data de coleta não existe nos arquivos e não foi substituída pela data do build. Ao selecionar coleções, a interface informa o volume dos arquivos comprimidos que serão baixados antes do filtro, e bloqueia cargas quando todas as coleções escolhidas têm zero registros confirmado.
