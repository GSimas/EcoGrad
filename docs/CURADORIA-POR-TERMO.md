# Bloco 15 — curadoria por termo

Implementado e verificado localmente em 12/09/2026. **Nenhuma publicação, deploy de preview, commit ou push realizado.**

## Comportamento entregue

Cada proposta concluída começa pendente. O revisor pode aceitar o termo original, corrigir seu nome/categoria ou rejeitá-lo. Toda decisão exige justificativa; aprovação e correção exigem trecho literal do resumo de 10 a 1.000 caracteres. A evidência deve apoiar a interpretação humana: a validação de substring não comprova correção científica.

A proposta original, seus trechos e a fonte permanecem intactos. Decisões são acrescentadas ao histórico por documento e posição original do termo, com data local; a última decisão salva prevalece. O histórico não é assinatura digital nem identifica um curador autenticado. Limite de 50 decisões por termo, sem apagar as anteriores. Rascunhos recuperáveis são explicitamente distintos das decisões salvas.

Antes de aplicar, todos os termos dos resultados concluídos devem estar decididos. Apenas aprovações salvas entram no catálogo. Rejeições e pendências não são aplicadas; documento sem aprovação permanece sem enriquecimento. Se todos forem rejeitados, nenhuma aplicação é realizada. Resultados com falha não viram ontologias vazias. Depois de aplicar, o lote fica bloqueado para edição. A revisão pode ser exportada antes de encerrar o lote.

Aplicação usa IDs exatos e verifica unicidade, versão da base, resumo/hash/título/URL e revisão atual após operações assíncronas. Alteração concorrente impede o commit; resultados já enriquecidos não são substituídos silenciosamente. Os cálculos dependentes são invalidados pelo mecanismo existente. Nenhuma alteração nos algoritmos científicos ou nas bases originais.

## Recuperação e exportação

Campos opcionais de curadoria e identificador de revisão mantêm a compatibilidade do envelope de sessão existente. Lotes antigos ainda não aplicados começam com termos pendentes; lotes históricos já aplicados não são desfeitos. Quando falta a fonte original, a interface apresenta o resumo atual por ID exato e o vincula como fonte da **curadoria humana**, sem alegar que foi a entrada original do Gemini.

`ecograd-revisao-ia-v2` conserva proposta, fonte, histórico e estado de aplicação. O JSON serve como registro de revisão; não é um importador de decisões. O CSV científico mantém o contrato anterior, com somente o catálogo aplicado, e deve ser conservado junto ao JSON para rastreabilidade. Importação CSV continua com sua prévia e validações existentes; a curadoria por termo abrange os lotes de extração por IA.

## Evidências

- [138 testes aprovados](evidencias/curadoria/testes.txt), incluindo nove testes novos de curadoria: decisão, correção, histórico, evidência, colisões, identidades, concorrência, aplicação, recuperação e legado.
- [Build aprovado](evidencias/curadoria/build.txt), [relatório de tamanho](evidencias/curadoria/build.json) e [manifesto de fontes/build](evidencias/curadoria/manifesto.json).
- [Roteiro executado na interface](evidencias/curadoria/interface.md), [comparação das exportações](evidencias/curadoria/verificacao-exportacoes.json), [revisão recuperada](evidencias/curadoria/revisao-recuperada.json), [revisão aplicada](evidencias/curadoria/revisao-aplicada.json) e [CSV aplicado simulado](evidencias/curadoria/catalogo-simulado.csv).

A interface foi testada com fixture artificial, sem novas chamadas ao Gemini. Os testes reais do bloco 14 permanecem documentados em [IA rastreável](IA-RASTREAVEL.md); não foram repetidos porque provedor, prompt e endpoints não mudaram neste bloco. A aprovação científica dos resultados reais continua dependendo de um curador. Não houve homologação com participantes, leitores de tela reais ou aparelhos físicos.

## Quantos blocos faltam

Após esta entrega, **dois blocos previstos** para concluir a construção e preparar a decisão de publicação:

1. **Bloco 16:** homologação humana, assistiva e móvel, revisão semântica das extrações reais e correção dos achados.
2. **Bloco 17:** validação no runtime de destino, revisão final de código/artefatos e preparação da publicação para aprovação.

É uma estimativa de fechamento, não garantia: achados relevantes podem exigir rodadas adicionais. O responsável precisa disponibilizar participantes, curador de domínio, aparelhos e leitores de tela, registrar os resultados e indicar o ambiente de destino. Roteiros e critérios estão em [Homologação](HOMOLOGACAO.md). Publicação continua sendo uma decisão posterior e explícita.

## Próximo prompt

> Continue pelo bloco 16: conduza a homologação conforme docs/HOMOLOGACAO.md e docs/CURADORIA-POR-TERMO.md. Execute as verificações disponíveis, inclua a curadoria das extrações reais, incorpore os resultados que eu fornecer de participantes, leitores de tela e celulares em conexão lenta e corrija os achados. Preserve IDs, recuperação e algoritmos; atualize as evidências sem publicar. Indique as ações que dependem de mim e sugira o próximo prompt.
