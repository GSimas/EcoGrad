# Importação e identidade do catálogo ontológico

O catálogo aceita enriquecimentos revisáveis para os documentos da análise atual. Importar não cria documentos e não altera títulos, autoria, fonte ou correspondências CAPES. A prévia separa linhas válidas e bloqueadas; somente linhas válidas escolhidas são aplicadas. Substituir uma ontologia existente exige habilitar essa opção. Cálculos em andamento bloqueiam a aplicação; aplicar invalida resultados dependentes dos documentos.

## Formato atual

Use **Exportar CSV para reimportação** no catálogo como modelo. O formato é `ecograd-ontologia-v1`, distinto dos CSV/JSON contextualizados das tabelas, que servem para leitura e análise.

| Coluna | Contrato |
| --- | --- |
| Formato | `ecograd-ontologia-v1` |
| Versão da base | Deve ser exatamente a versão da análise aberta |
| ID do documento | `doc-v1-` seguido do hash SHA-256 de identidade; deve identificar um único registro |
| Título | Igual ao título do documento identificado |
| Coleção | Igual a `programa_origem` do documento identificado |
| URL | Exportada como fonte original; quando a coluna está presente, deve coincidir exatamente |
| Ano | Metadado exportado para revisão; não substitui a identidade |
| Teorias e Modelos | Array JSON de textos |
| Ferramentas e Artefatos | Array JSON de textos |
| Métodos e Técnicas | Array JSON de textos |

As listas usam JSON, por exemplo `["Teoria, com vírgula", "Outro modelo"]`. As aspas da célula devem ser escapadas conforme CSV; o arquivo exportado já faz isso. Cada categoria aceita até 100 textos não vazios de até 500 caracteres. `[]` é uma lista vazia válida; campo vazio, objeto ou lista de números não é válido. Preserve a codificação UTF-8 e os cabeçalhos.

Limites: arquivo de até **2 MiB e 2.000 linhas de dados**; texto colado de até **50.000 caracteres**, sujeito ao mesmo parser e validação. Cabeçalhos obrigatórios ausentes ou duplicados e CSV malformado impedem a prévia. Problemas por documento bloqueiam a linha e deixam as demais disponíveis para revisão.

## Identidade exata

O identificador é o SHA-256 da serialização JSON de:

- Documento com URL: `['fonte', programa_origem, url]`.
- Documento sem URL: `['metadados', programa_origem, titulo, ano, autores, orientador, co_orientadores]`.

São usados os valores exatos da base carregada. Posição no vetor, ontologia e versão da base não entram no hash. Portanto, reordenar documentos ou aplicar enriquecimentos não muda a identidade. Alterar a coleção/fonte muda a identidade; sem URL, mudar os metadados bibliográficos também muda. A ordem original das listas é significativa. Não há normalização aproximada de URLs, nomes ou acentos.

A versão da base é verificada separadamente, mesmo quando o ID permanece igual. Um CSV de outra versão é bloqueado para evitar aplicação silenciosa de enriquecimentos desatualizados. Não há migração automática entre versões. Reexporte a base atual e revise os dados antes de preparar um novo arquivo.

Identidade repetida na base significa ambiguidade: nenhuma dessas linhas recebe enriquecimento. Repetir um documento no arquivo bloqueia todas as ocorrências desse documento. ID desconhecido não cai em uma busca alternativa por título. Título/coleção/URL divergentes do registro identificado também bloqueiam a linha. A identidade é verificada novamente na aplicação; uma análise alterada enquanto o arquivo era validado não recebe os resultados antigos.

## Compatibilidade com CSV anterior

Arquivos sem a coluna `ID do documento` são identificados como formato antigo. Precisam conter `Título` e as três categorias. A correspondência só ocorre quando o título é **exatamente igual e único** na análise. Caixa, acentos e espaços não são aproximados. Títulos duplicados exigem reexportar no formato atual.

As categorias antigas são separadas por vírgulas; não é possível distinguir uma vírgula interna de um separador. A prévia avisa essa limitação. O formato antigo não comprova versão nem fonte; revise a coleção e o documento identificados antes de aplicar. Exporte o resultado no formato atual para preservar listas e identidade nas próximas importações.

## Extração e recuperação

Os pedidos de extração enviam ao Gemini título, resumo integral e ID opaco. Um lote novo ignora documentos sem resumo, já enriquecidos ou com identidade ambígua. Cada resposta deve devolver o mesmo ID e as três listas válidas. O ID evita atribuir a resposta a outro documento por título ou posição; ele não garante que os conceitos extraídos sejam corretos.

Resultados concluídos ficam em revisão, separados da base. Retomar reenvia somente pendências e falhas. Cancelar mantém resultados concluídos e não aplica automaticamente os demais. Navegar conserva a execução; recarregar exige retomada manual. A sessão guarda lote, prévia, textos e resultados dentro dos limites existentes (checkpoint de 64 MiB, validade de 24 horas, invalidação por versão). Aguarde **Sessão salva** antes do reload.

Revise os conceitos e o documento de origem antes da aplicação: a validação é estrutural e de identidade, não uma avaliação científica dos artefatos. Nenhuma importação cria um vínculo entre coleção e código CAPES.


### Revisão rastreável de IA (bloco 14)

O botão **Exportar revisão com fontes e evidências** gera `ecograd-revisao-ia-v1`, contendo propostas, IDs, trechos, resumo enviado e hash. É um arquivo de auditoria, não de reimportação. O CSV deste documento permanece inalterado e não carrega automaticamente essas evidências. Guarde ambos para preservar a curadoria; consulte [IA rastreável](IA-RASTREAVEL.md).
