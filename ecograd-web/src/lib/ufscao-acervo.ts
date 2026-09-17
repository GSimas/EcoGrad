/**
 * UFSCão sobre o acervo inteiro (ADR 004, fase A): a parte pura.
 *
 * Cada pergunta passa por duas chamadas ao modelo do usuário (BYOK), com o
 * banco no meio:
 *
 * 1. **Planejar.** O modelo lê o dicionário das views e devolve JSON: SQL para
 *    quem, quanto e quando; grupos de sinônimos para tema; ou nenhum dos dois.
 *    Ele não responde nada aqui — só diz o que consultar.
 * 2. O banco apura: `consultar()` executa o SQL como papel somente leitura, e
 *    `panorama_tematico()` devolve o panorama exato e a amostra representativa.
 * 3. **Responder.** O modelo escreve sobre o que o banco devolveu, citando as
 *    obras da amostra como `[n]`. Número que não veio do banco não pode aparecer.
 *
 * Nada aqui chama rede. Importa por caminho relativo: os testes compilam sem o
 * atalho `@/`.
 */
import {
  MAX_CARACTERES_RESUMO, SEM_RELEVANCIA, planejarAprofundamento, sistemaSintese,
  type FonteResumo, type PlanoAprofundamento,
} from './chat-sintese';
import { PERSONA_UFSCAO, REGRAS_DE_SEGURANCA, cercarDadosDoAcervo } from './guardrails';
import exemplos from './consultas-exemplo.json';
import { escaparHtml } from './markdown';

export type TipoPlano = 'dados' | 'tema' | 'misto' | 'conversa' | 'fora';

export interface Plano {
  tipo: TipoPlano;
  sql?: string;
  /** Conceitos da pergunta (E), cada um com as formas como o acervo pode escrevê-lo (OU). */
  grupos?: string[][];
  colecao?: string;
  ano_min?: number;
  ano_max?: number;
  motivo?: string;
}

export interface LinhaDicionario { visao: string; coluna: string; tipo: string; descricao: string | null; descricao_visao: string | null }

export interface ObraAmostra {
  documento_id: string; titulo: string; ano: number | null; colecao: string; nivel: string | null; url: string | null;
  aderencia: number; autores: string[] | null; orientador: string | null; palavras_chave: string[] | null; trecho: string | null;
  /** Por onde a obra entrou: termos da busca, significado (vetor) ou os dois. */
  origem?: 'texto' | 'significado' | 'ambos';
  similaridade?: number | null;
}

export interface Panorama {
  consulta: string | null;
  palavras_chave_casadas?: string[] | null;
  busca_por_significado?: boolean;
  /** Obras da amostra candidata achadas só por significado: nunca entram nas contagens (D2). */
  obras_so_por_significado?: number;
  /** A contagem pelos termos estourou o tempo; a amostra veio só por significado. */
  amplo_demais?: boolean;
  obras: number;
  registros: number;
  obras_sem_resumo?: number;
  por_ano?: Array<[number, number]> | null;
  por_colecao?: Array<[string, number]> | null;
  por_nivel?: Array<[string, number]> | null;
  por_macrotema?: Array<[string, number]> | null;
  principais_orientadores?: Array<[string, number]> | null;
  amostra: ObraAmostra[] | null;
}

export interface Dados { sql: string; linhas: Record<string, unknown>[]; truncado: boolean }

/**
 * Onde a conversa da tela inicial fica na sessão. Sai daqui porque duas telas
 * a leem: a que escreve, e o painel flutuante que a herda.
 */
export const CHAVE_CONVERSA_ACERVO = 'ufscao.acervo.conversa';

/** Quantos turnos da tela inicial o painel flutuante leva ao modelo. */
export const TURNOS_HERDADOS = 3;
const MAX_CARACTERES_HERDADOS = 6000;

/**
 * Os últimos turnos da conversa da tela inicial, prontos para virar histórico
 * de outra conversa. Quando a resposta foi aprofundada, vale a aprofundada: é
 * a que o usuário pagou para ler, e a que ele tem na cabeça ao continuar.
 */
export function turnosHerdados(
  conversa: readonly { pergunta: string; texto: string; aprofundamento?: { texto: string } }[],
): Array<{ pergunta: string; resposta: string }> {
  const turnos: Array<{ pergunta: string; resposta: string }> = [];
  let caracteres = 0;
  for (const r of [...conversa].reverse()) {
    if (turnos.length >= TURNOS_HERDADOS) break;
    const resposta = (r.aprofundamento?.texto || r.texto || '').trim();
    if (!r.pergunta?.trim() || !resposta) continue;
    if (caracteres + resposta.length > MAX_CARACTERES_HERDADOS && turnos.length) break;
    turnos.unshift({ pergunta: r.pergunta.trim(), resposta: resposta.slice(0, MAX_CARACTERES_HERDADOS) });
    caracteres += resposta.length;
  }
  return turnos;
}

/** O que já foi dito na conversa, para perguntas de seguimento ("e depois de 2020?"). */
export interface Turno { pergunta: string; plano: Plano | null; resposta: string }

const TIPOS: readonly TipoPlano[] = ['dados', 'tema', 'misto', 'conversa', 'fora'];
/** Linhas do SQL que vão ao modelo na resposta: o resto fica na tela, em "Como apurei". */
export const MAX_LINHAS_CONTEXTO = 60;
const MAX_CARACTERES_DADOS = 12000;
const MAX_CARACTERES_TRECHO = 600;
const TURNOS_NO_HISTORICO = 3;

/** Dicionário das views, uma linha por coluna: é o que o modelo lê antes de escrever SQL. */
export function dicionarioCompacto(linhas: readonly LinhaDicionario[]): string {
  const porVisao = new Map<string, LinhaDicionario[]>();
  for (const l of linhas) porVisao.set(l.visao, [...(porVisao.get(l.visao) ?? []), l]);
  return [...porVisao].map(([visao, cols]) => [
    `### ${visao} — ${cols[0].descricao_visao ?? ''}`,
    ...cols.map((c) => `- ${c.coluna} (${c.tipo})${c.descricao ? `: ${c.descricao}` : ''}`),
  ].join('\n')).join('\n\n');
}

const EXEMPLOS = (exemplos as Array<{ pergunta: string; sql: string }>)
  .map((e) => `Pergunta: ${e.pergunta}\n{"tipo":"dados","sql":${JSON.stringify(e.sql)}}`).join('\n\n');

function historicoTexto(turnos: readonly Turno[]) {
  const recentes = turnos.slice(-TURNOS_NO_HISTORICO);
  if (!recentes.length) return '';
  return 'CONVERSA ATÉ AQUI (para resolver perguntas de seguimento):\n' + recentes.map((t) =>
    `- Pergunta: ${t.pergunta}\n  Plano: ${t.plano ? JSON.stringify(t.plano) : 'nenhum'}\n  Resposta (início): ${t.resposta.slice(0, 500).replace(/\s+/g, ' ')}`,
  ).join('\n') + '\n\n';
}

export function promptPlanejamento(dicionario: string, pergunta: string, turnos: readonly Turno[] = []) {
  const sistema = `Você planeja como responder perguntas sobre o acervo do EcoGrad: teses, dissertações e TCCs da UFSC, com cerca de 92 mil registros. Você NÃO responde a pergunta: decide o que consultar no banco e devolve SOMENTE um objeto JSON, sem texto antes ou depois, sem cercas de código.

Formato:
{"tipo": "dados" | "tema" | "misto" | "conversa" | "fora", "sql": "...", "grupos": [["...", "..."], ["..."]], "colecao": "...", "ano_min": 2000, "ano_max": 2026, "motivo": "..."}

Quando usar cada tipo:
- "dados": quem, quantos, quando, rankings, perfis de pessoas e coleções, quem orientou quem, séries por ano. Escreva "sql".
- "tema": como o acervo trata um assunto, o que se pesquisa sobre algo, trabalhos sobre um tema. Escreva "grupos" e, se a pergunta limitar, "colecao", "ano_min", "ano_max".
- "misto": precisa das duas coisas, como a trajetória de uma pessoa E o que se pesquisa num tema. Escreva "sql" e "grupos".
- Quem orienta, pesquisa ou mais publica SOBRE UM TEMA é "tema", não SQL: o panorama já traz os orientadores com mais obras no tema, apurados sobre todas as obras encontradas no título, resumo e palavras-chave. SQL com palavra-chave exata acha uma fração delas e dá ranking errado.
- "conversa": cumprimento, agradecimento ou pergunta sobre o próprio UFSCão. Nada a consultar.
- "fora": fora do acervo (notícia, previsão, conselho pessoal), juízo de qualidade ("melhor tese", "professor mais competente") ou dado pessoal (contato, e-mail, endereço, CPF). Explique em "motivo".

Grupos de sinônimos (tipo "tema" ou "misto"):
- Um grupo por conceito da pergunta. Os grupos se combinam com E; os termos de um grupo, com OU.
- Em cada grupo, de 2 a 8 formas como trabalhos acadêmicos em português escreveriam o conceito: singular e plural, forma técnica e forma comum, siglas conhecidas. Ex.: "empreendedorismo feminino" → [["empreendedorismo", "empreendedora", "empreendedoras", "empreender"], ["feminino", "mulher", "mulheres", "gênero"]].
- Não crie grupo para palavras genéricas: trabalho, pesquisa, estudo, tese, dissertação, UFSC, Brasil.
- Prefira poucos grupos: dois conceitos bem escolhidos acham mais do que quatro.

Regras do SQL:
- Um único SELECT (ou WITH … SELECT) sobre as views do dicionário abaixo, sem ponto e vírgula, com LIMIT de no máximo 50.
- Obra (trabalho distinto) e registro (catalogação) são unidades diferentes: para contar trabalhos use count(distinct documento_id) ou as colunas obras_*; nomeie a coluna com a unidade.
- Pessoa pelo nome, em qualquer ordem: pessoas.nome_tokens @> tokens_de_nome('nome como o usuário escreveu'). Nos outros views, junte por pessoa_id.
- Palavras-chave (termo) estão em minúsculas e sem acento: compare com sem_acento('...').
- Coleção pelo nome: colecao ilike '%parte do nome%'. Sigla de programa não está no nome da coleção: escreva o nome por extenso (PPGEGC → engenharia e gestão do conhecimento; use _ no lugar de letras acentuadas).
- Ao comparar pessoas na rede, filtre escopo e use ranking_entre_pessoas.
- Perguntas de seguimento herdam o assunto, a pessoa e o recorte da conversa.

DICIONÁRIO DAS VIEWS
${dicionario}

EXEMPLOS DE SQL CORRETO
${EXEMPLOS}`;
  const mensagem = `${historicoTexto(turnos)}PERGUNTA: ${pergunta}`;
  return { sistema, mensagem };
}

export function promptCorrecaoSql(sql: string, erro: string) {
  return `O SQL abaixo falhou no banco. Corrija e devolva SOMENTE o JSON do plano, no mesmo formato.\n\nSQL:\n${sql}\n\nERRO: ${erro}`;
}

const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : undefined);
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/**
 * Lê o plano que o modelo devolveu. Tolera cerca de código e texto em volta do
 * JSON, porque modelos diferentes erram de jeitos diferentes; não tolera tipo
 * inválido. Sem plano legível, devolve `null` e quem chama decide o que fazer.
 */
export function lerPlano(resposta: string): Plano | null {
  const inicio = resposta.indexOf('{');
  const fim = resposta.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) return null;
  let bruto: Record<string, unknown>;
  try { bruto = JSON.parse(resposta.slice(inicio, fim + 1)); } catch { return null; }
  if (!bruto || typeof bruto !== 'object' || !TIPOS.includes(bruto.tipo as TipoPlano)) return null;
  const grupos = Array.isArray(bruto.grupos)
    ? bruto.grupos
      .map((g) => (Array.isArray(g) ? g.map((t) => texto(t, 80)).filter((t): t is string => !!t).slice(0, 12) : []))
      .filter((g) => g.length > 0)
      .slice(0, 5)
    : undefined;
  const plano: Plano = {
    tipo: bruto.tipo as TipoPlano,
    sql: texto(bruto.sql, 4000),
    grupos: grupos?.length ? grupos : undefined,
    colecao: texto(bruto.colecao, 200),
    ano_min: numero(bruto.ano_min),
    ano_max: numero(bruto.ano_max),
    motivo: texto(bruto.motivo, 500),
  };
  // Um tipo que exige consulta sem a consulta vira o que ainda dá para fazer.
  if (plano.tipo === 'misto' && !plano.sql) plano.tipo = 'tema';
  if (plano.tipo === 'misto' && !plano.grupos) plano.tipo = 'dados';
  if (plano.tipo === 'dados' && !plano.sql) return null;
  if (plano.tipo === 'tema' && !plano.grupos) return null;
  return plano;
}

export interface Fonte {
  numero: number;
  documentoId: string;
  titulo: string;
  ano: number | null;
  colecao: string;
  url: string | null;
  origem?: ObraAmostra['origem'];
}

export const fontesDaAmostra = (panorama: Panorama | null): Fonte[] =>
  (panorama?.amostra ?? []).map((o, i) => ({ numero: i + 1, documentoId: o.documento_id, titulo: o.titulo, ano: o.ano, colecao: o.colecao, url: o.url, origem: o.origem }));

const lista = (pares: Array<[string | number, number]> | null | undefined, n = 10) =>
  (pares ?? []).slice(0, n).map(([k, v]) => `${k}: ${v}`).join('; ') || 'nenhum';

function blocoDados(dados: Dados | null, erroSql: string | null) {
  if (erroSql) return `DADOS (SQL): a consulta falhou e não há números apurados. Erro: ${erroSql}`;
  if (!dados) return '';
  const linhas = dados.linhas.slice(0, MAX_LINHAS_CONTEXTO);
  let json = JSON.stringify(linhas);
  if (json.length > MAX_CARACTERES_DADOS) json = json.slice(0, MAX_CARACTERES_DADOS) + ' …(cortado)';
  const aviso = dados.truncado || dados.linhas.length > linhas.length ? ' Resultado truncado: há mais linhas do que as mostradas.' : '';
  return `DADOS (SQL executado no índice, ${dados.linhas.length} linhas).${aviso}\nSQL: ${dados.sql}\nLinhas:\n${cercarDadosDoAcervo(json)}`;
}

/** Os números do panorama, sem a amostra: a leitura padrão e o aprofundamento usam os mesmos. */
function marcadoresDoPanorama(p: Panorama): string[] {
  const extras = p.busca_por_significado && p.obras_so_por_significado
    ? ` Além delas, ${p.obras_so_por_significado} obras próximas em significado não usam os termos; elas NÃO entram em nenhuma contagem.`
    : '';
  return [
    `- Obras encontradas: ${p.obras} (${p.registros} registros); sem resumo utilizável: ${p.obras_sem_resumo ?? 0}.${extras}`,
    `- Por coleção (top 10): ${lista(p.por_colecao)}`,
    `- Por nível: ${lista(p.por_nivel)}`,
    `- Por ano: ${lista(p.por_ano, 60)}`,
    `- Macrotemas (classificação automática): ${lista(p.por_macrotema)}`,
    `- Orientadores com mais obras no tema: ${lista(p.principais_orientadores)}`,
  ];
}

function blocoPanorama(p: Panorama | null, plano: Plano, erro: string | null) {
  if (erro) return `PANORAMA DO TEMA: a busca falhou (${erro}). O tema pode ser amplo demais: sugira restringir por programa ou período.`;
  if (!p) return '';
  const semAmostra = !(p.amostra ?? []).length;
  if (!p.obras && semAmostra) return `PANORAMA DO TEMA: nenhuma obra encontrada para ${JSON.stringify(plano.grupos)}${plano.colecao ? ` na coleção "${plano.colecao}"` : ''}${p.busca_por_significado ? ', nem pelos termos nem por significado' : ''}.`;
  const amostra = cercarDadosDoAcervo((p.amostra ?? []).map((o, i) => [
    `[${i + 1}] ${o.titulo} (${o.ano ?? 'sem ano'}) — ${o.colecao} · ${o.nivel ?? 'nível não informado'}${o.origem === 'significado' ? ' · ACHADA SÓ POR SIGNIFICADO (não usa os termos da busca)' : ''}`,
    `    Autoria: ${(o.autores ?? []).join('; ') || 'não informada'} · Orientação: ${o.orientador || 'não informada'}`,
    `    Palavras-chave: ${(o.palavras_chave ?? []).slice(0, 8).join('; ') || 'não informadas'}`,
    `    Trecho do resumo: ${o.trecho ? o.trecho.replace(/\s+/g, ' ').slice(0, MAX_CARACTERES_TRECHO) : 'sem resumo utilizável'}`,
  ].join('\n')).join('\n'));
  if (p.amplo_demais) {
    return [
      'PANORAMA DO TEMA: o tema é amplo demais para contar as obras dentro do limite de tempo do banco. NÃO dê nenhum número de obras. As obras abaixo vieram só da busca por significado, como exemplos. Diga isso e sugira restringir por programa, período ou um subtema.',
      '',
      `AMOSTRA POR SIGNIFICADO (${(p.amostra ?? []).length} obras mais próximas; cite como [n]):`,
      amostra,
    ].join('\n');
  }
  if (!p.obras) {
    return [
      'PANORAMA DO TEMA: nenhuma obra usa os termos da busca. As obras abaixo vieram SÓ da busca por significado, que não tem total: não dê número de obras sobre o tema, diga que são aproximações e que o acervo não usa esse vocabulário.',
      '',
      `AMOSTRA POR SIGNIFICADO (${(p.amostra ?? []).length} obras mais próximas; cite como [n]):`,
      amostra,
    ].join('\n');
  }
  return [
    `PANORAMA DO TEMA (apurado sobre TODAS as obras que casaram com os termos da busca; números exatos):`,
    ...marcadoresDoPanorama(p),
    '',
    `AMOSTRA (${(p.amostra ?? []).length} de ${p.obras} obras, espalhadas pelas coleções em proporção ao tamanho de cada uma; cite como [n]):`,
    amostra,
  ].join('\n');
}

export function promptResposta(pergunta: string, plano: Plano, dados: Dados | null, erroSql: string | null, panorama: Panorama | null, erroPanorama: string | null, turnos: readonly Turno[] = [], indiceAtrasado = false) {
  const sistema = `${PERSONA_UFSCAO}

${REGRAS_DE_SEGURANCA}

REGRAS DA RESPOSTA
- Use SOMENTE o CONTEXTO. Todo número vem de DADOS ou do PANORAMA, com a unidade: obras (trabalhos distintos) ou registros (catalogações).
- Cada afirmação sobre um trabalho da AMOSTRA leva a citação [n] logo depois. Colchetes com número servem SÓ para obras da AMOSTRA: sem AMOSTRA no contexto, não use [n] nenhum, nem para numerar linhas de DADOS. Nunca invente título, pessoa, ano ou vínculo.
- A amostra é parte do total: descreva tendências com o PANORAMA e use a amostra como exemplos, sem dizer que ela é o conjunto.
- Obra marcada "ACHADA SÓ POR SIGNIFICADO" não usa os termos da busca: pode ser exemplo valioso de vocabulário diferente, mas confira pelo trecho se trata mesmo do tema e nunca a some às contagens.
- O último ano do acervo está em coleta: não chame seus números de queda nem de projeção.
- Pessoas foram unificadas automaticamente a partir das grafias do acervo, sem revisão humana; macrotema é classificação automática da base, não categoria oficial; o último ano do acervo ainda está em coleta.${indiceAtrasado ? '\n- O índice que você consultou foi gerado de uma versão anterior das bases e pode estar atrás do que a busca do EcoGrad mostra. Diga isso na resposta, numa frase, e avise que trabalhos recentes podem faltar.' : ''}
- Se a consulta falhou ou nada foi encontrado, diga isso com clareza e sugira como reformular (outros termos, um programa, um período).
- Se a pergunta é "fora", recuse com gentileza e explique o que o acervo permite responder.

FORMA
- Markdown, de 120 a 350 palavras, em tom de conversa: trate quem pergunta por "você" e escreva como quem explica para alguém ao lado, não como relatório. Uma abertura curta e calorosa cabe bem; elogiar a pergunta, não. O essencial vem logo: panorama em poucas linhas e então os destaques da amostra com [n].
- Nomes de pessoas no formato do acervo ("Sobrenome, Nome") ou na ordem direta, como ficar mais natural.
- Termine com um próximo passo útil: abrir uma obra citada, refinar por programa ou período, ou perguntar sobre um orientador.`;
  const contexto = plano.tipo === 'conversa' || plano.tipo === 'fora'
    ? `TIPO: ${plano.tipo}${plano.motivo ? ` — ${plano.motivo}` : ''}. Nenhuma consulta foi feita.`
    : [blocoDados(dados, erroSql), blocoPanorama(panorama, plano, erroPanorama)].filter(Boolean).join('\n\n');
  const mensagem = `${historicoTexto(turnos)}PERGUNTA: ${pergunta}\n\nCONTEXTO\n${contexto}`;
  return { sistema, mensagem };
}

/**
 * Troca cada `[n]` do HTML da resposta por botão que abre a fonte. Só texto
 * fora de marcação é tocado, e só números que existem na amostra: citação a
 * fonte inexistente fica como texto, e `citacoesInvalidas` a aponta.
 */
export function realcarCitacoes(html: string, fontes: readonly Fonte[]): string {
  if (!fontes.length) return html;
  let dentro = 0;
  return html.split(/(<[^>]*>)/).map((parte) => {
    if (parte.startsWith('<')) {
      if (/^<(a|code|button)\b/i.test(parte)) dentro += 1;
      else if (/^<\/(a|code|button)>/i.test(parte)) dentro = Math.max(0, dentro - 1);
      return parte;
    }
    if (dentro > 0) return parte;
    // "[4]" e também "[4, 5, 8]": cada número vira o próprio botão.
    return parte.replace(/\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})*)\]/g, (inteiro, numeros: string) => {
      const botoes = numeros.split(/\s*[,;]\s*/).map((n) => {
        const fonte = fontes.find((f) => f.numero === Number(n));
        return fonte
          ? `<button type="button" class="eco-citacao" data-fonte="${fonte.numero}" title="${escaparHtml(`Abrir no Motor de Busca: ${fonte.titulo}`)}">[${fonte.numero}]</button>`
          : `[${n}]`;
      });
      return botoes.some((b) => b.startsWith('<')) ? botoes.join('') : inteiro;
    });
  }).join('');
}

export const citacoesInvalidas = (texto: string, total: number) =>
  [...new Set([...texto.matchAll(/\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\]/g)]
    .flatMap((m) => m[1].split(/\s*[,;]\s*/).map(Number)).filter((n) => n < 1 || n > total))];

// ------------------------------------------------- aprofundar (ADR 004, fase C)
//
// A leitura padrão manda ao modelo a amostra de 15 a 20 obras que o banco
// escolheu (decisão D8). "Aprofundar" lê **todas** as obras do tema que têm
// resumo utilizável, em lotes, como o UFSCão das coleções carregadas já faz
// sobre o recorte baixado — com a mesma estimativa de chamadas, tokens e tempo
// antes de gastar a chave de quem pergunta, e as mesmas regras de citação.
//
// Só o conjunto léxico entra: a obra achada por significado não tem total (D2),
// e "li todas as obras do tema" precisa ser verdade sobre um conjunto contável.

/**
 * Teto de obras lidas numa pergunta. Não é limite do banco: é o ponto em que a
 * conta deixa de ser razoável para quem paga. 400 resumos são cerca de 213 mil
 * tokens de entrada e 21 chamadas — uma ordem de grandeza acima da leitura
 * padrão, e já caro em qualquer provedor. Acima disso o caminho honesto é
 * restringir o tema, não ler mais.
 */
export const TETO_APROFUNDAR = 400;

/** Uma obra como `resumos_das_obras` a devolve. */
export interface ObraDoIndice {
  documento_id: string; titulo: string; ano: number | null; colecao: string;
  nivel: string | null; url: string | null; autores: string[] | null; orientador: string | null; resumo: string | null;
}

/** Obra lida no aprofundamento: serve de material ao modelo e de alvo da citação. */
export interface ObraLida extends Fonte, FonteResumo {}

/**
 * Numera as obras na ordem em que o índice as devolveu, que é a ordem de
 * aderência. A numeração é a das citações e precisa ser estável entre os lotes
 * e a síntese final: por isso ela sai daqui, e não de cada lote.
 */
export function obrasLidas(obras: readonly ObraDoIndice[], inicio = 0): ObraLida[] {
  return obras.map((o, i) => ({
    numero: inicio + i + 1,
    documentoId: o.documento_id,
    titulo: o.titulo,
    ano: o.ano,
    colecao: o.colecao,
    url: o.url,
    origem: 'texto' as const,
    nivel: o.nivel ?? '',
    autores: o.autores ?? [],
    orientador: o.orientador ?? '',
    resumo: (o.resumo ?? '').trim().slice(0, MAX_CARACTERES_RESUMO),
  }));
}

/** Lotes e estimativa de volume, mostrados antes de gastar a chave do usuário. */
export const planejarLeituraDoTema = (obras: readonly ObraLida[]): PlanoAprofundamento<ObraLida> =>
  planejarAprofundamento(obras);

/** O que fica guardado na conversa depois de aprofundar: o texto e as fontes, sem os resumos. */
export interface Aprofundamento {
  texto: string;
  leitura: LeituraDoTema;
  fontes: Fonte[];
}

export interface LeituraDoTema {
  /** Obras que casaram os termos, com resumo utilizável ou não. */
  obras: number;
  /** Quantas delas têm resumo utilizável: é o universo que dá para ler. */
  comResumo: number;
  /** Quantas foram lidas de fato — menor que `comResumo` quando bateu no teto. */
  lidas: number;
}

/**
 * Síntese final do aprofundamento, escrita sobre as notas citadas dos lotes. O
 * panorama continua sendo o único lugar de onde número pode sair, e a leitura
 * declara o que ficou de fora: obra sem resumo, e obra além do teto.
 */
export function promptReducaoDoTema(
  pergunta: string, panorama: Panorama, leitura: LeituraDoTema, obras: readonly ObraLida[],
  notas: readonly string[], turnos: readonly Turno[] = [],
) {
  const uteis = notas.map((n) => (n ?? '').trim()).filter((n) => n && !n.toUpperCase().includes(SEM_RELEVANCIA));
  const cobertura = leitura.lidas >= leitura.comResumo
    ? `As notas cobrem as ${leitura.lidas} obras com resumo utilizável do tema, de ${leitura.obras} no total`
    : `As notas cobrem as ${leitura.lidas} obras de maior aderência, de ${leitura.comResumo} com resumo utilizável (o tema tem ${leitura.obras} obras): a leitura não é do tema inteiro, e você deve dizer isso`;
  const sistema = sistemaSintese(
    'as NOTAS dos lotes e as citações que elas já trazem',
    `${cobertura}. São notas, não o texto original: não conte trabalhos nem estime proporções por conta própria — todo número sai do PANORAMA.`,
  );
  const mensagem = [
    `${historicoTexto(turnos)}PERGUNTA: ${pergunta}`,
    '',
    'PANORAMA DO TEMA (apurado pelo banco sobre TODAS as obras que casaram com os termos; é o único lugar de onde número pode vir):',
    ...marcadoresDoPanorama(panorama),
    '',
    `FONTES LIDAS (${obras.length}; os números das citações se referem a elas):`,
    ...obras.map((o) => `[${o.numero}] ${o.titulo || 'Trabalho sem título'} (${o.ano ?? 'sem ano'}) · ${o.colecao}`),
    '',
    uteis.length
      ? 'NOTAS DOS LOTES (só estas afirmações podem ser usadas, com as citações que já trazem):'
      : 'NOTAS DOS LOTES: nenhum lote encontrou conteúdo relevante para a pergunta.',
    ...uteis.flatMap((n, i) => ['', `— Notas ${i + 1} —`, n]),
  ].join('\n');
  return { sistema, mensagem };
}
