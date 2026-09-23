import { useId, useMemo, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useSessionField } from '@/hooks/useSessionField';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { baixarArquivo, cn } from '@/lib/utils';
import { CHIP } from '@/components/layout/atalhos';
import { FiltroCabecalho } from './FiltroCabecalho';
import { Dica } from './Dica';
import { useEmJanela } from './contexto-janela';
import { valorExibido, consultaInicial, consultarLinhas, contextoPublicavel, csvComContexto, filtroAtivo, pacoteExportacao, type ConsultaTabela, type FiltroColuna, type RotulosColuna } from '@/lib/visualizacao';

export interface ColunaTabela<T> {
  chave: string;
  rotulo: string;
  render?: (linha: T) => ReactNode;
  className?: string;
  barra?: { max: number };
}
export const NOTA_FILTROS = 'O funil no cabeçalho filtra a coluna; busca, filtros e ordenação afetam somente esta tabela.';
export const NOTA_EXPORTACAO = 'Exporta todas as linhas filtradas, com nomes completos, recorte, unidades dos cabeçalhos e parâmetros. JSON conserva os valores; CSV protege textos que poderiam ser interpretados como fórmulas.';

export interface LeituraDados<T extends Record<string, unknown> = Record<string, unknown>> {
  titulo: string;
  descricao?: string;
  linhas: readonly T[];
  colunas: ReadonlyArray<ColunaTabela<T>>;
  contexto?: Record<string, unknown>;
  onAbrir?: (linha: T) => void;
  rotuloAbrir?: (linha: T) => string;
}
export function Tabela<T extends Record<string, unknown>>({
  colunas, linhas, titulo, descricao, contexto, onAbrir, rotuloAbrir, altura = 'max-h-96', vazio = 'Sem dados para exibir.', aninhada = false,
  notasNaDica: notasNaDicaPedidas,
}: LeituraDados<T> & { altura?: string; vazio?: string;
  /** Dentro de uma região que já tem este nome — o Grafico. Evita duas regiões homônimas. */
  aninhada?: boolean;
  /** Quem monta a tabela já mostra a descrição e a nota de exportação numa `Dica`. */
  notasNaDica?: boolean }) {
  const id = useId();
  // Dentro de uma janela de bloco, descrição e notas saem da página e vão para
  // uma dica "i" na linha de status — a própria tabela a desenha. Quem passa
  // `notasNaDica` já mostra essas notas numa dica sua, e a tabela não repete.
  const emJanela = useEmJanela();
  const dicaPropria = notasNaDicaPedidas === undefined && emJanela;
  const notasNaDica = notasNaDicaPedidas ?? emJanela;
  const [consulta, setConsulta] = useSessionField<ConsultaTabela>('tabela.' + titulo, consultaInicial);
  const chaves = colunas.map((c) => c.chave);
  // Colunas que desenham a própria célula ditam o texto do filtro por seleção
  // quando esse desenho é texto puro (um ano sem separador de milhar, por exemplo).
  const rotulos = useMemo<RotulosColuna>(() => Object.fromEntries(colunas.filter((c) => c.render).map((c) =>
    [c.chave, (l: Record<string, unknown>) => { const r = c.render?.(l as T); return typeof r === 'string' ? r : valorExibido(l[c.chave]); }])), [colunas]);
  const filtradas = useMemo(() => consultarLinhas(linhas, chaves, consulta, rotulos), [linhas, colunas, consulta, rotulos]);
  const pagina = Math.max(0, Math.min(consulta.pagina, Math.ceil(filtradas.length / 25) - 1));
  const alterar = (v: Partial<ConsultaTabela>) => setConsulta({ ...consulta, pagina: 0, ...v });
  const filtros = consulta.filtros ?? {};
  const definirFiltro = (chave: string, f: FiltroColuna | null) => {
    const proximos = { ...filtros };
    if (f) proximos[chave] = f; else delete proximos[chave];
    alterar({ filtros: proximos });
  };
  const ativos = colunas.filter((c) => filtroAtivo(filtros[c.chave])).length;
  const ordenar = (chave: string, direcao: 'asc' | 'desc') => alterar({ coluna: chave, direcao });
  const exportar = (formato: 'csv' | 'json') => {
    const s = useEcoGradStore.getState();
    const meta = { ...contextoPublicavel(s), ...contexto, titulo, descricao: descricao ?? '', exportadoEm: new Date().toISOString(), consulta, linhasDisponiveis: linhas.length, linhasExportadas: filtradas.length, escopo: 'Todas as linhas filtradas e ordenadas, não apenas a página visível' };
    const pacote = pacoteExportacao(filtradas, colunas, meta);
    const nome = 'ecograd-' + titulo.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    baixarArquivo(formato === 'csv' ? csvComContexto(pacote) : JSON.stringify(pacote, (_, v) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v, 2), nome + '.' + formato, formato === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
  };
  // Duas regiões aninhadas com o mesmo nome fazem quem navega por landmarks ouvir
  // o rótulo repetido, sem saber qual escolher.
  const Raiz = aninhada ? 'div' : 'section';
  return <Raiz className="min-w-0 space-y-3" aria-label={aninhada ? undefined : titulo}>
    {descricao && !notasNaDica && <p className="text-xs leading-relaxed text-slate-300">{descricao}</p>}
    <div className="flex flex-wrap items-end gap-2">
      <label htmlFor={id} className="min-w-0 flex-1 basis-56 text-sm"><span>Buscar em {titulo}</span><input className="input mt-1" id={id} type="search" value={consulta.busca} onChange={(e) => alterar({ busca: e.target.value })} /></label>
      <button type="button" className="btn" onClick={() => setConsulta(consultaInicial)}>Restaurar tabela</button>
    </div>

    <div className="flex items-center gap-2">
      <p className="text-xs text-slate-400" role="status">{filtradas.length} de {linhas.length} linhas · {consulta.coluna ? `${colunas.find((c) => c.chave === consulta.coluna)?.rotulo ?? consulta.coluna}: ${consulta.direcao === 'asc' ? 'crescente' : 'decrescente'}` : 'ordem original'} · {ativos ? `${ativos} ${ativos === 1 ? 'coluna filtrada' : 'colunas filtradas'}` : 'nenhuma coluna filtrada'}.{!notasNaDica && ` ${NOTA_FILTROS}`}</p>
      {dicaPropria && <Dica rotulo={`Como ler: ${titulo}`}>{descricao && <p>{descricao}</p>}<p>{NOTA_FILTROS} {NOTA_EXPORTACAO}</p></Dica>}
    </div>
    <div className={cn('overflow-auto rounded-lg border border-eco-border', altura)} role="region" aria-label={`Tabela ${titulo}; role para ler todas as colunas`} tabIndex={0}>
      <table className="tabela tabela-exploravel">
        <caption className="p-3 text-left text-sm font-medium">{titulo}</caption>
        <thead><tr>{colunas.map((c) => <th key={c.chave} scope="col" aria-sort={consulta.coluna === c.chave ? consulta.direcao === 'asc' ? 'ascending' : 'descending' : 'none'}>
          {/* Ordem no clique do título; o funil abre o menu da própria coluna. */}
          <div className="flex items-center gap-1">
            <button type="button" className="min-h-11 flex-1 text-left" aria-label={`Ordenar ${titulo} por ${c.rotulo}`} onClick={() => alterar({ coluna: c.chave, direcao: consulta.coluna === c.chave && consulta.direcao === 'asc' ? 'desc' : 'asc' })}>{c.rotulo} {consulta.coluna === c.chave ? consulta.direcao === 'asc' ? '↑' : '↓' : '↕'}</button>
            <FiltroCabecalho rotulo={c.rotulo} chave={c.chave} linhas={linhas} rotulos={rotulos} filtro={filtros[c.chave]}
              aoFiltrar={(f) => definirFiltro(c.chave, f)}
              ordem={consulta.coluna === c.chave ? consulta.direcao : null}
              aoOrdenar={(d) => ordenar(c.chave, d)} />
          </div>
        </th>)}</tr></thead>
        <tbody>{filtradas.slice(pagina * 25, (pagina + 1) * 25).map((linha, i) => <tr key={i}>{colunas.map((c, coluna) => {
          const bruto = linha[c.chave];
          // Mesmo texto que o filtro por seleção lista: a opção marcada é o que se lê aqui.
          const numero = valorExibido(bruto);
          const conteudo = c.render ? c.render(linha) : c.barra ? <div className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-12 shrink-0 overflow-hidden rounded bg-eco-border"><span className="block h-full bg-eco-accent" style={{ width: `${Math.max(0, Math.min(100, c.barra.max > 0 ? Number(bruto) / c.barra.max * 100 : 0))}%` }} /></span><span>{numero}</span></div> : numero;
          return <td key={c.chave} className={cn(c.className, '!whitespace-normal !overflow-visible !text-clip break-words')}>
            {/* O caminho para explorar é o próprio nome, na primeira coluna: uma
                coluna "Explorar" à direita repetia a identidade da linha e
                separava o rótulo do que ele abre. */}
            {onAbrir && coluna === 0
              ? <button type="button" className={cn(CHIP, 'min-h-0 max-w-full px-3 py-1.5 text-left text-xs')} aria-label={`Explorar ${rotuloAbrir ? rotuloAbrir(linha) : String(bruto ?? 'registro')}`} onClick={() => onAbrir(linha)}>
                <ArrowUpRight size={13} aria-hidden className="shrink-0" /><span className="min-w-0 break-words">{conteudo}</span>
              </button>
              : conteudo}
          </td>;
        })}</tr>)}</tbody>
      </table>
      {!filtradas.length && <p className="p-4 text-sm">{linhas.length ? 'Nenhuma linha corresponde à busca e aos filtros de coluna. Restaure a tabela para voltar.' : vazio}</p>}
    </div>
    {filtradas.length > 25 && <nav aria-label={`Paginação de ${titulo}`} className="flex flex-wrap items-center gap-2"><button className="btn" disabled={pagina === 0} onClick={() => alterar({ pagina: pagina - 1 })}>Anterior</button><span className="text-sm">Página {pagina + 1} de {Math.ceil(filtradas.length / 25)}</span><button className="btn" disabled={(pagina + 1) * 25 >= filtradas.length} onClick={() => alterar({ pagina: pagina + 1 })}>Próxima</button></nav>}
    <div className="flex flex-wrap gap-2"><button type="button" className="btn" disabled={!filtradas.length} onClick={() => exportar('csv')} aria-label={`Exportar ${titulo} em CSV com contexto`}>CSV com contexto</button><button type="button" className="btn" disabled={!filtradas.length} onClick={() => exportar('json')} aria-label={`Exportar ${titulo} em JSON com contexto`}>JSON com contexto</button></div>
    {!notasNaDica && <p className="text-xs text-slate-400">{NOTA_EXPORTACAO}</p>}
  </Raiz>;
}
