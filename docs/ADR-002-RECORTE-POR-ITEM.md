# ADR 002 — A análise é do item buscado, não da coleção que o contém

**Status:** implementado. Sem infraestrutura nova, sem custo de API, sem mudança no formato das bases publicadas.

**Data:** 15/09/2026 · **Decisor:** Gustavo Simas (produto e operação).

## Contexto

A busca da apresentação encontra itens de todo o acervo — um documento, uma pessoa, uma palavra-chave, um macrotema — a partir de um catálogo leve, sem baixar nada. Mas a unidade de download é a **coleção**: os fragmentos `.json.gz` existem por programa e por curso, e não por item. Alcançar a palavra-chave "empreendedorismo feminino" significava baixar as três coleções em que ela aparece.

Até aqui, essas coleções inteiras viravam a análise. Quem pesquisou uma palavra-chave com 5 registros recebia um Dashboard de 4.711 documentos, um Radar de Foresight das coleções inteiras e uma rede memética de 6.802 termos. Nada disso é falso — é a produção das coleções —, mas responde uma pergunta que o usuário não fez. O risco é de leitura: números grandes na tela depois de uma busca específica são lidos como se descrevessem o item buscado.

## Decisão

A escolha da busca passa a definir um **recorte**: a base ativa contém apenas os documentos dos itens escolhidos. Tudo que o EcoGrad deriva — indicadores, pessoas, temas, redes, tendências, dossiês — descreve esse recorte, porque tudo deriva de `docs`.

- O recorte é aplicado **no worker de ingestão** (`recortarDocs`, em `src/lib/recorte.ts`): a coleção inteira é baixada e descomprimida, mas só os documentos correspondentes atravessam a fronteira do worker e ocupam memória na página.
- Cada item recorta pelo seu próprio campo: documento por título, `Pessoa` pelos três papéis, um papel específico só no campo dele, palavra-chave e macrotema pelos seus. Vários itens **somam** (união, não interseção).
- Uma coleção escolhida de propósito entra inteira, ao lado dos itens. Uma escolha só de coleções não recorta nada — ali o recorte é a coleção.
- Grafias unificadas entram juntas: os documentos gravados sob o nome antigo são da mesma pessoa.
- Duas superfícies declaram o recorte e oferecem a volta em um clique — o cartão "Análise recortada" no Dashboard e a badge "Análise ativa" na Sidebar. "Analisar N coleções inteiras" recarrega as mesmas coleções sem recorte.

## Consequências

**A favor.** O que está na tela corresponde ao que foi pedido. A base ativa fica ordens de grandeza menor, o que barateia SNA, foresight e memética. O checkpoint de sessão cabe com folga no limite de 64 MiB.

**Contra, e assumido.** Indicadores comparativos passam a comparar o recorte com ele mesmo: a similaridade de um documento sozinho não tem com quem se comparar, e o Foresight de 7 documentos não descreve tendência nenhuma. É o preço de responder a pergunta feita, e por isso o caminho de volta é explícito, nomeia quantas coleções serão carregadas e está nas duas superfícies.

**Custo de rede inalterado.** O download continua sendo por coleção. O recorte economiza memória e cálculo, não banda.

## Alternativas descartadas

- **Manter as coleções inteiras e apenas destacar o item.** É o comportamento anterior; o destaque não impede a leitura errada dos números agregados.
- **Expandir o recorte de um documento para as pessoas e temas dele.** Devolveria contexto comparativo, mas inventa uma pergunta intermediária que ninguém fez, e sem regra defensável para onde parar.
- **Fragmentar as bases por item.** Multiplicaria os arquivos publicados e o tempo de `sync-data`, para resolver no servidor algo que o worker resolve em memória.

## Limites

O catálogo da busca cobre o acervo inteiro; o recorte local vive nas coleções baixadas. Se o catálogo estiver à frente da base, o carregamento falha com mensagem explícita em vez de entregar uma análise vazia. A correspondência é por nome normalizado (sem acento nem caixa): homônimos continuam colapsando num nome só, como no restante do EcoGrad.
