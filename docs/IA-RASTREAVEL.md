# Bloco 14 — sínteses delimitadas e extrações rastreáveis

Concluído localmente em 12/09/2026. **129 testes aprovados; nenhuma publicação, commit, push ou aplicação das extrações de teste à base científica.** Este bloco trata H02/H03 da [homologação](RELATORIO-HOMOLOGACAO.md). As correções técnicas não substituem aceite do curador ou avaliação com participantes.

## Comportamento entregue

A síntese passa a conter um enunciado de escopo montado pelo servidor, independentemente da resposta do modelo: quantidade amostrada, total da seleção, títulos/palavras-chave e eventual corte de texto. O método de amostragem e o limite de 20.000 caracteres foram preservados. Clientes sem contagens recebem uma declaração explícita de cobertura não informada. Os números são os metadados enviados pelo cliente, não uma contagem inferida pelo modelo ou uma auditoria externa do acervo.

O prompt pede descrição somente dos assuntos presentes na amostra e proíbe acrescentar benefícios ou caracterizar o programa inteiro. Em caso de falha, o texto anterior agora conserva **a amostra, os programas e o escopo que o geraram**. A tentativa nova não pode sobrescrever a proveniência do último sucesso. Exportação e checkpoint mantêm esses campos juntos.

No Chat, zero perfis agregados significa ausência dessa informação no contexto. Não é contagem de docentes ativos nem evidência sobre vínculo, credenciamento ou vagas. O prompt e o texto do dossiê distinguem orientação histórica de disponibilidade atual.

A extração envia ao Gemini **somente o resumo**. Título e ID continuam no contrato entre frontend e função para associar a resposta, mas não entram no prompt de extração. Cada termo proposto exige categoria, nome idêntico ao da lista e um trecho literal contínuo do resumo. Os prompts orientam a extrair uso efetivo no estudo, não temas, recomendações ou métodos usuais presumidos.

Servidor e cliente validam correspondência de todos os termos, categoria, trechos de 10–1.000 caracteres, ausência de duplicações e hash SHA-256 do resumo. O hash atesta qual texto foi enviado, não a veracidade do documento. Uma citação ausente, extração sem evidência ou resumo divergente deixa o documento em falha retomável; nenhuma ontologia parcial é aplicada. Listas vazias válidas precisam vir com evidências vazias.

A revisão do lote mostra trechos, fonte externa e resumo enviado. O botão **Exportar revisão com fontes e evidências** gera `ecograd-revisao-ia-v1`, com IDs, baseVersion, propostas, trechos e cópia do resumo com hash. Os resultados continuam exigindo aplicação explícita. Títulos/fontes vêm da análise, não são inventados pela resposta do modelo.

## Compatibilidade e recuperação

- IDs documentais, versão das bases, motores científicos e as três listas de `OntologiaIA` permanecem iguais. Não foram alterados os algoritmos.
- `ItemExtracao` recebe campos opcionais `evidencias` e `fonte`; síntese recebe `escopo` opcional. O envelope de sessão permanece schema 1 porque a ampliação é opcional e compatível com os estados anteriores.
- Lotes antigos concluídos são recuperados sem novo envio e exibem “Resultado legado sem evidências registradas”. Não recebem evidências fabricadas retroativamente. Antes de reaplicá-los, o usuário ainda precisa conferir as fontes.
- Novas respostas sem o contrato de evidências são recusadas. Frontend e funções precisam ser implantados juntos; um frontend novo não aceitará uma função antiga como se estivesse validada.
- A fonte é uma cópia do resumo usado na chamada. O link externo pode mudar depois; a revisão permite identificar o texto efetivamente utilizado. Cópias/trechos aumentam o checkpoint e continuam submetidos aos limites de armazenamento existentes.
- O CSV científico de reimportação permanece inalterado. O JSON de revisão **não é um novo formato de importação** e não acompanha automaticamente um CSV. Conserve ambos quando precisar transportar curadoria e rastreabilidade. Encerrar o lote remove a revisão local conforme o aviso existente; exporte antes.

## Testes e observação da interface

[testes.txt](evidencias/ia-semantica/testes.txt): **129 testes, zero falhas, 17 arquivos**. Incluem rejeição de citação inventada, termo sem evidência, categoria/termo divergente, resumo com hash errado mesmo com ID correto, contagens inválidas da síntese, ausência de título/ID no prompt de extração, preservação de proveniência após erro e serialização/recuperação de evidências e legados. As suítes existentes de identidade, retomada seletiva, cancelamento, importação, workers e sessão continuam passando.

Build/TypeScript: [build.txt](evidencias/ia-semantica/build.txt), [build.json](evidencias/ia-semantica/build.json). Cinco funções finais empacotadas localmente: [funcoes-build.txt](evidencias/ia-semantica/funcoes-build.txt). O runtime remoto não foi exercitado nesta etapa; o computador usa Node 24 e o projeto configura Node 20 no destino.

Na UI real, em aba isolada de localhost:8888, foi carregada a coleção de um registro de Engenharia de Produção. Síntese exibiu “até 1 de 1 registros” e somente assuntos da amostra. A extração propôs “análise de custos” com a frase do resumo que descreve os custos analisados. A fonte correspondia ao ID do documento. O catálogo aplicado permaneceu vazio; o botão de aplicação não foi acionado.

Após “Sessão salva”, o lote foi exportado, a página recarregada e a revisão exportada novamente. [revisao-ui.json](evidencias/ia-semantica/revisao-ui.json) e [revisao-ui-recuperada.json](evidencias/ia-semantica/revisao-ui-recuperada.json) são iguais como objetos JSON. Fonte, ID, proposta, hash e trecho foram conferidos. A UI mostrou “Sessão recuperada” e um resultado concluído. Essa inspeção foi em IAB desktop; não equivale a leitor de tela ou celular físico.

## Rodada de IA real e avaliação preliminar

A rodada usou somente documentos públicos, sem prompts privados. Os registros preservam inclusive falhas, para não ocultar a variabilidade do modelo. Contagem deste bloco: seis pedidos do harness, três retestes HTTP isolados do documento de métodos, uma invocação diagnóstica direta da função com captura da resposta pública do provedor e dois pedidos pela UI. Isso não equivale a contagem faturada do Google; fallback, retries internos, tokens e custo total não foram auditados.

| Caso | Resultado observado | Avaliação |
| --- | --- | --- |
| Chat com perfis agregados vazios | Título/link exatos; distingue orientação histórica de disponibilidade atual | A inferência de “nenhum docente ativo identificado” da rodada anterior não ocorreu. Uma amostra, não garantia universal. |
| Síntese de um documento | Prefixo determinístico “até 1 de 1”, seguido dos assuntos citados | Não acrescentou sustentabilidade/eficiência como na rodada anterior. Resultado do harness e da UI coerentes com o recorte. |
| Madeira e análise econômica | Propôs análise econômica com trecho; na UI, análise de custos com trecho | O tema “valorização energética da madeira” deixou de ser listado como método. A nomenclatura varia e exige curadoria. |
| Boletim sem método explícito | Três listas vazias e evidências vazias | Abstenção válida, não ausência de produção ou prova de inexistência de conceitos. |
| Aveia e análise experimental | Tentativas iniciais rejeitadas; diagnóstico mostrou uma evidência copiada do título | A validação bloqueou a proposta. Remover título do prompt eliminou essa fonte de contaminação. |
| Aveia após correção final | Análise de variância e teste Tukey com trecho literal de uso | Ambos têm apoio explícito. Omissão de desenho em blocos completos casualizados mostra que a extração ainda não é exaustiva. |
| Cancelamento de Chat | Leitura local encerrada após primeiro texto | Não comprova interrupção/cobrança no provedor; recuperação em UI da resposta parcial já tem cobertura controlada. |

Evidências: [ia-real.json](evidencias/ia-semantica/ia-real.json), [retentativa-metodo.json](evidencias/ia-semantica/retentativa-metodo.json), [diagnostico-metodo.json](evidencias/ia-semantica/diagnostico-metodo.json), [metodo-somente-resumo.json](evidencias/ia-semantica/metodo-somente-resumo.json) e [metodo-final.json](evidencias/ia-semantica/metodo-final.json). A etapa intermediária somente-resumo ainda incluiu “planejamento forrageiro”, recomendação contextual; o prompt final passou a exigir uso realizado e a rodada final omitiu esse item.

A comparação textual prova que a citação existe, mas não que justifica cientificamente a categoria ou que todos os métodos foram encontrados. **H02/H03 receberam correções e retestes; o aceite semântico do curador continua pendente.** Não promover esses resultados de teste automaticamente a catálogo curado.

Reprodução a partir da raiz, com as funções locais iniciadas e credencial no ambiente:

```bash
node ecograd-web/scripts/homologar-ia-real.mjs --executar --bloco14
```

Esse comando faz até seis pedidos de aplicação, sujeitos a retries/fallback do servidor, e sobrescreve somente `evidencias/ia-semantica/ia-real.json`. Arquive a rodada anterior antes de repetir. Os retestes/diagnóstico documentam a investigação e não são chamados automaticamente pelo harness. As fixtures em `tests/manual-ia-server.mjs` continuam artificiais e exclusivas para testes locais; sua correspondência de trechos não as torna cientificamente válidas.

## Revisão de publicação e próximo bloco

O pacote anterior à divisão por coleção permanece histórico. Pacote local final: `/tmp/EcoGrad-bloco14-revisao.tar`, com dist, configuração, cinco funções empacotadas e este relatório. Integridade: [manifest-final.json](evidencias/ia-semantica/manifest-final.json) e [pacote.sha256](evidencias/ia-semantica/pacote.sha256). O pacote é para inspeção, não contém .env nem publica o site; /tmp pode ser limpo pelo sistema. O workspace continua sem commit e alterações exigem novo build/manifesto. Não executar deploy enquanto faltarem revisão humana, dispositivos físicos, runtime/variáveis de destino e teste de rollback conforme [REVISAO-PUBLICACAO.md](REVISAO-PUBLICACAO.md).

Próximo prompt sugerido:

> Continue pelo bloco 15: implemente curadoria por termo na revisão da ontologia, permitindo aceitar, rejeitar e corrigir propostas com justificativa e evidência, sem alterar IDs ou perder a proposta original. Aplique somente os termos aprovados, preserve revisão e recuperação, teste o fluxo e atualize as evidências sem publicar. Ao concluir, sugira o próximo prompt e as ações que dependem de mim.

Ação do responsável: designar um curador para avaliar os três documentos públicos desta rodada e organizar os participantes/aparelhos do plano de homologação. Critérios técnicos aprovados não substituem esse aceite.
