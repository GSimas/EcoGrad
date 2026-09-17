/**
 * O corpo de uma resposta do UFSCão sobre o acervo, num lugar só.
 *
 * Existe porque a mesma resposta aparece em duas telas: na conversa da tela
 * inicial, onde nasce, e no painel flutuante das páginas de análise, que a herda
 * para a pergunta de seguimento fazer sentido (ADR 004, E1 — o flutuante
 * continua respondendo só sobre as coleções carregadas, mas não finge que a
 * conversa começou agora). Renderizar nos dois lugares pelo mesmo código é o que
 * impede a herdada de virar uma versão pior da original.
 */
import { useMemo, type MouseEvent } from 'react';
import { itemDoAcervo, type IndiceBusca, type ResultadoBusca } from '@/lib/busca-global';
import { markdownParaHtml } from '@/lib/markdown';
import { dicionarioDeItens, realcarMencoes, type Mencao } from '@/lib/mencoes';
import {
  CHAVE_CONVERSA_ACERVO, TURNOS_HERDADOS, citacoesInvalidas, fontesDaAmostra, realcarCitacoes,
  type Fonte, type Panorama,
} from '@/lib/ufscao-acervo';
import { abrirEscolhaDoAcervo } from '@/services/abrir-item';
import { Expander } from '@/components/ui/primitives';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { TipoBusca } from '@/types';

const PAPEIS: TipoBusca[] = ['Autor', 'Orientador', 'Co-orientador'];
const CAMPOS_DE_PESSOA = new Set(['nome', 'orientador', 'orientando', 'rotulo']);

/** O mínimo que este módulo precisa saber de uma resposta, sem depender do serviço. */
export interface RespostaRenderizavel {
  pergunta: string;
  texto: string;
  panorama: Panorama | null;
  dados: { linhas: Record<string, unknown>[] } | null;
}

/** Pessoas e títulos que o banco devolveu nesta resposta: só eles viram botão. */
export function itensDaResposta(r: RespostaRenderizavel): Mencao[] {
  const itens: Mencao[] = [];
  const pessoa = (nome: unknown) => { if (typeof nome === 'string' && nome.includes(',')) itens.push({ tipo: 'Pessoa', nome }); };
  for (const [nome] of r.panorama?.principais_orientadores ?? []) pessoa(nome);
  for (const o of r.panorama?.amostra ?? []) {
    (o.autores ?? []).forEach(pessoa);
    (o.orientador ?? '').split('; ').forEach(pessoa);
  }
  for (const linha of r.dados?.linhas ?? []) {
    for (const [campo, valor] of Object.entries(linha)) if (CAMPOS_DE_PESSOA.has(campo)) pessoa(valor);
  }
  return itens;
}

/**
 * Abre no Motor de Busca o que a resposta citou. Sem base carregada, o item é
 * achado no catálogo global e as coleções dele são carregadas — o mesmo caminho
 * da busca da tela inicial.
 */
export function abrirNoMotor(indice: IndiceBusca | undefined, tipo: 'Documento' | 'Pessoa', nome: string, url?: string | null) {
  const itens: ResultadoBusca[] = indice
    ? (tipo === 'Documento' ? [itemDoAcervo(indice, 'Documento', nome)] : PAPEIS.map((p) => itemDoAcervo(indice, p, nome)))
      .filter((i): i is ResultadoBusca => !!i)
    : [];
  if (itens.length) { abrirEscolhaDoAcervo({ itens, colecoes: [] }); return; }
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Texto da resposta com `[n]` e nomes do acervo clicáveis. `fontes` vem de fora
 * porque a resposta aprofundada cita outra lista que a leitura padrão.
 */
export function CorpoDaResposta({ resposta: r, fontes, indice }: {
  resposta: RespostaRenderizavel;
  fontes: readonly Fonte[];
  indice: IndiceBusca | undefined;
}) {
  const dic = useMemo(() => dicionarioDeItens(itensDaResposta(r)), [r]);
  const html = useMemo(() => realcarMencoes(realcarCitacoes(markdownParaHtml(r.texto), fontes), dic), [r.texto, fontes, dic]);
  const invalidas = useMemo(() => citacoesInvalidas(r.texto, fontes.length), [r.texto, fontes.length]);

  const clique = (e: MouseEvent<HTMLDivElement>) => {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-fonte],[data-mencao]');
    if (!alvo) return;
    const { fonte, mencao, nome } = alvo.dataset;
    if (fonte) { const f = fontes.find((x) => x.numero === Number(fonte)); if (f) abrirNoMotor(indice, 'Documento', f.titulo, f.url); }
    else if (mencao === 'Pessoa' && nome) abrirNoMotor(indice, 'Pessoa', nome);
  };

  return <>
    {/* O HTML vem de `markdownParaHtml`, que escapa o texto do modelo antes de marcar. */}
    <div className="markdown" onClick={clique} dangerouslySetInnerHTML={{ __html: html }} />
    {invalidas.length > 0 && <p className="erro mt-2 text-xs">A resposta cita {invalidas.map((n) => `[${n}]`).join(', ')}, que não existe entre as fontes consultadas. Desconsidere essas citações.</p>}
  </>;
}

/** Lista recolhível das obras que a resposta podia citar. */
export function FontesDaResposta({ fontes, total, rotulo, indice }: {
  fontes: readonly Fonte[];
  total?: number;
  rotulo: string;
  indice: IndiceBusca | undefined;
}) {
  if (!fontes.length) return null;
  return <details className="mt-3 text-xs">
    <summary className="cursor-pointer text-slate-300">{rotulo} ({fontes.length}{total ? ` de ${total.toLocaleString('pt-BR')} obras encontradas` : ''})</summary>
    <ol className="mt-2 space-y-1">
      {fontes.map((f) => <li key={f.numero} className="flex gap-1">
        <button type="button" className="text-left text-eco-accent underline" onClick={() => abrirNoMotor(indice, 'Documento', f.titulo, f.url)}>[{f.numero}] {f.titulo}</button>
        <span className="shrink-0 text-slate-400">· {f.ano ?? 'sem ano'} · {f.colecao}{f.origem === 'significado' ? ' · achada por significado' : ''}</span>
        {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Fonte original, em nova aba">↗<span className="sr-only"> (abre a fonte original)</span></a>}
      </li>)}
    </ol>
  </details>;
}

export const fontesDaResposta = (r: RespostaRenderizavel) => fontesDaAmostra(r.panorama);

/** Um turno da tela inicial como o painel flutuante precisa ve-lo. */
interface RespostaHerdada extends RespostaRenderizavel {
  id: number;
  aprofundamento?: { fontes: Fonte[] };
}

/**
 * A conversa da tela inicial, mostrada no painel flutuante das páginas de
 * análise. Só leitura: ela pertence à outra superfície, e continuar a partir
 * dela é papel do campo de pergunta do painel, que responde sobre as coleções
 * carregadas. Vem recolhida porque o assunto do painel é a análise atual.
 */
export function ConversaHerdada({ indice }: { indice: IndiceBusca | undefined }) {
  const conversa = useEcoGradStore((s) => s.ui[CHAVE_CONVERSA_ACERVO]) as RespostaHerdada[] | undefined;
  if (!conversa?.length) return null;
  const levados = Math.min(conversa.length, TURNOS_HERDADOS);
  return <Expander titulo={`Conversa da tela inicial (${conversa.length} ${conversa.length === 1 ? 'pergunta' : 'perguntas'})`} persistir={false}>
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-400">
        Estas respostas vieram da tela inicial e cobrem o <strong>acervo inteiro</strong>, pelo índice.
        O UFSCão daqui responde sobre as <strong>coleções carregadas</strong>: {levados === conversa.length ? 'elas vão' : `as ${levados} últimas vão`} junto
        com a sua próxima pergunta, para o seguimento fazer sentido, mas as contagens e os números continuam valendo só para o recorte de cada resposta.
      </p>
      {conversa.map((r) => <div key={r.id} className="space-y-1 border-l-2 border-eco-border pl-3">
        <p className="text-xs font-semibold text-slate-300">{r.pergunta}</p>
        <div className="text-sm">
          <CorpoDaResposta resposta={r} fontes={r.aprofundamento?.fontes ?? fontesDaResposta(r)} indice={indice} />
        </div>
      </div>)}
    </div>
  </Expander>;
}
