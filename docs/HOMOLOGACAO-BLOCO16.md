# Bloco 16 — homologação disponível e pendências de campo

Rodada de 12/09/2026. **Verificações locais concluídas; homologação humana e física ainda pendente. Sem publicação, deploy, commit ou push.** Nenhum registro preenchido de participante, leitor de tela ou celular foi localizado nos documentos de homologação, nem recebido nesta rodada. Não há taxas de sucesso ou tempos humanos a consolidar.

## Correções e retestes

| Achado | Correção | Evidência |
| --- | --- | --- |
| H16-01 — tutorial ainda dizia que baixava bases completas | Passo inicial descreve arquivos das coleções escolhidas e volume informado; passo de conceitos explica decisões e aplicação somente de aprovações salvas | Texto atualizado conferido no diálogo da aplicação |
| H16-02 — botão do catálogo era identificado por “Explorar 1988” | Tabela aceita rótulo de abertura explícito; catálogo usa o título completo, preservando índice/ID e navegação | Árvore acessível apresenta o título; Enter abre o documento e URL corretos |

O teste do catálogo usou somente o CSV artificial do bloco 15 em aba isolada. Não houve promoção das propostas reais à base científica. Nenhum algoritmo, ID ou contrato de persistência alterado.

## Execuções disponíveis

- **138 testes aprovados**, zero falhas: [log](evidencias/bloco16/testes.txt). Incluem curadoria, fontes, retomada, cancelamento, sessão, IDs e falhas de carregamento.
- **Paridade científica aprovada nos recortes e tolerâncias do verificador:** [log](evidencias/bloco16/paridade.txt).
- **Build/TypeScript aprovados:** [build](evidencias/bloco16/build.txt), [volume do build](evidencias/bloco16/build-report.txt).
- **UI desktop IAB, 1280 × 720:** Escape retorna ao gatilho; Shift+Tab/Tab circulam entre extremidades do tutorial; Enter abre trabalho com fonte exata; Voltar retorna ao catálogo. Reload preserva rascunho CSV e catálogo aplicado. CSV reexportado igual ao original do teste, inclusive ID: [registro](evidencias/bloco16/interface.json), [CSV recuperado artificial](evidencias/bloco16/catalogo-recuperado-simulado.csv).
- **Transferência HTTP local limitada pelo curl a 125.000 bytes/s:** três repetições de Ecologia + TCC Administração Pública EAD, 363.651 bytes de documentos, HTTP 200 e hashes do JSON descompactado válidos. Tempos somados: 2,428 / 2,437 / 2,291 s; mediana 2,428 s. [Dados e limites](evidencias/bloco16/transferencia-limitada.json), [script](evidencias/bloco16/medir-transferencia.py).

O curl permite rajadas para arquivos pequenos; estes números não representam perfil móvel de 1 Mbps sustentado com RTT de 300 ms, nem incluem UI, catálogos, cálculo ou renderização. Não medem cache frio/quente de navegador, LCP/INP/CLS ou memória. Um erro inicial no script de conferência comparava o hash do gzip com o hash do JSON; o script foi corrigido para seguir o contrato do carregador. Não era falha da aplicação.

A árvore acessível e o teclado verificam somente os cenários descritos. Não equivalem a ouvir anúncios no NVDA/VoiceOver/TalkBack ou avaliar toque e legibilidade em aparelho físico.

## Revisão das extrações reais

Revisados os arquivos originais do bloco 14, sem nova chamada ao Gemini, sem alterar as respostas e sem aplicar resultados. [Revisão por ID, trechos, hashes e julgamentos](evidencias/bloco16/revisao-extracoes-reais.json). [Script reproduzível](evidencias/bloco16/revisar-extracoes.py), executável da raiz com Python 3. A validação textual confere cinco registros, incluindo uma falha histórica, e preserva a variação entre rodadas.

| Caso real | Julgamento preliminar do agente | Ação do curador |
| --- | --- | --- |
| Madeira — “análise econômica” no harness | Apoio amplo no objetivo de examinar custos/viabilidade; não especifica procedimento detalhado | Decidir nomenclatura e granularidade; não converter automaticamente em método específico |
| Madeira — “análise de custos” na UI | Apoio direto na frase do objetivo; proposta diferente da outra rodada | Conferir trecho e aceitar/corrigir com justificativa |
| Aveia — análise de variância e teste Tukey | Ambos explicitamente descritos como utilizados; hashes e trechos corretos | Confirmar classificação e registrar aceite |
| Aveia — desenho em blocos completos casualizados | Está no resumo e não foi extraído na rodada final | Registrar omissão; não tratar o catálogo como exaustivo ou adicionar termo silenciosamente |
| Boletim — listas vazias | Abstenção coerente com resumo informativo | Confirmar limite da avaliação ao resumo |
| Aveia — falha anterior de evidência | Resposta sem ontologia, bloqueada pelo contrato | Manter falha no histórico; não contar como extração válida |

Esses julgamentos são revisão textual pelo agente, **não assinatura de um especialista**. O produto permite curar propostas existentes; inclusão de conceitos omitidos não foi implementada nem presumida como requisito deste bloco. H02/H03 permanecem com correções técnicas verificadas e aceite científico pendente.

## Portões que continuam abertos

| Portão | Estado | Ação necessária |
| --- | --- | --- |
| Participantes P01–P08 / T1–T8 | Não executado | Responsável organiza as sessões e fornece fichas anonimizadas |
| NVDA/Firefox, VoiceOver/Safari, TalkBack/Chrome | Não executado com leitores reais | Usuários habituais registram anúncios, foco, erro e conclusão |
| Android/iPhone e rede condicionada | Não executado em aparelhos físicos | Registrar modelo/SO/navegador, rede medida e 3 rodadas frias/quentes conforme plano |
| Curadoria científica dos resultados reais | Revisão preliminar pronta | Curador confirma/rejeita/corrige por termo com evidência e justificativa |
| Runtime e pacote final | Próximo bloco | Confirmar destino, versão anterior/rollback; reconstruir artefatos com fontes atuais |

Use a [ficha de homologação](HOMOLOGACAO.md), incluindo a tarefa adicional de curadoria abaixo. Não armazenar nomes, contatos ou gravações no repositório. Participações não executadas ficam sem métricas; não são aprovação implícita. Não foram enviados convites nem criados agendamentos.

## Próximo passo

Resta **um bloco técnico previsto (17)**, além do fechamento das pendências humanas deste bloco. A construção local não equivale a produto homologado. O pacote do bloco 14 é histórico e não inclui as correções dos blocos 15/16; o novo [manifesto local](evidencias/bloco16/manifesto.json) identifica fontes/build para revisão, não é artefato de deploy.

> Continue pelo bloco 17: valide o runtime e a configuração do ambiente de destino com as verificações disponíveis, revise as alterações e prepare um novo pacote local de publicação com manifesto e plano de rollback. Incorpore as fichas de homologação e decisões do curador que eu fornecer; mantenha explicitamente pendentes os portões sem evidência. Preserve IDs, recuperação e algoritmos, execute os retestes necessários e apresente o resultado para revisão sem publicar. Sugira o próximo prompt ou as ações finais.
