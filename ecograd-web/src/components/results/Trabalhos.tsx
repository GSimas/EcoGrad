import { Select } from '@/components/ui/Select';
import { useId, useMemo } from 'react';
import { useSessionField } from '@/hooks/useSessionField';
import { fonteSegura, filtrarTrabalhos, type FiltroTrabalhos } from '@/lib/resultados';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { Documento } from '@/types';
export function FonteTrabalho({ doc }: { doc: Documento }) {
  const url = fonteSegura(doc.url);
  return url ? <a className="btn min-h-11 text-eco-accent" href={url} target="_blank" rel="noopener noreferrer">Abrir fonte original ↗<span className="sr-only">: {doc.titulo} (nova aba)</span></a> : <p className="text-xs text-slate-400">Link de fonte não disponível neste registro.</p>;
}
export function Trabalhos({ docs, sessionKey, titulo = 'Trabalhos para ler' }: { docs: readonly Documento[]; sessionKey: string; titulo?: string }) {
  const id = useId();
  const [filtro, setFiltro] = useSessionField<FiltroTrabalhos>(sessionKey + '.filtro', { busca: '', colecao: '', comResumo: false });
  const [pagina, setPagina] = useSessionField(sessionKey + '.pagina', 0);
  const result = useMemo(() => filtrarTrabalhos(docs, filtro), [docs, filtro]);
  const nomes = useMemo(() => [...new Set(docs.map((d) => d.programa_origem))].sort(), [docs]);
  const paginaAtual = Math.max(0, Math.min(Number.isInteger(pagina) ? pagina : 0, Math.ceil(result.length / 6) - 1));
  const alterar = (v: Partial<FiltroTrabalhos>) => { setFiltro({ ...filtro, ...v }); setPagina(0); };
  const abrir = (d: Documento) => { const s = useEcoGradStore.getState(); s.navegarDocumento(s.docs.indexOf(d)); };
  return <section className="space-y-4" aria-label={titulo}>
    <h2 className="text-xl font-semibold">{titulo}</h2>
    <div className="grid gap-3 md:grid-cols-2">
      <label htmlFor={id} className="space-y-1 text-sm"><span>Buscar nestes trabalhos</span><input id={id} type="search" className="input" value={filtro.busca} onChange={(e) => alterar({ busca: e.target.value })} placeholder="Título, pessoa, palavra-chave ou resumo" /></label>
      <div className="space-y-1 text-sm"><label htmlFor={id + '-colecao'}>Coleção dos trabalhos</label><Select id={id + '-colecao'} valor={filtro.colecao} onChange={(v) => alterar({ colecao: v })} opcoes={[{ valor: '', rotulo: 'Todas as coleções deste conjunto' }, ...(filtro.colecao && !nomes.includes(filtro.colecao) ? [{ valor: filtro.colecao, rotulo: `${filtro.colecao} (fora deste conjunto)` }] : []), ...nomes.filter(Boolean).map((n) => ({ valor: n, rotulo: n }))]} /></div>
    </div>
    <div className="flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={filtro.comResumo} onChange={(e) => alterar({ comResumo: e.target.checked })} /> Somente com resumo</label><button type="button" className="btn" onClick={() => alterar({ busca: '', colecao: '', comResumo: false })}>Limpar filtros dos trabalhos</button></div>
    <p className="text-xs text-slate-400" role="status">{result.length} de {docs.length} registros · anos mais recentes primeiro; sem ano ao final. Os filtros desta lista não alteram os cálculos.</p>
    {!result.length ? <p className="rounded-lg border border-eco-border p-4 text-sm">Nenhum trabalho neste filtro. Limpe os filtros para voltar ao conjunto disponível.</p> : <ol className="space-y-3" start={paginaAtual * 6 + 1}>{result.slice(paginaAtual * 6, paginaAtual * 6 + 6).map((d, i) => <li key={paginaAtual * 6 + i} className="card space-y-3">
      <button type="button" className="min-h-11 text-left text-base font-semibold text-eco-accent underline-offset-4 hover:underline" onClick={() => abrir(d)}>{d.titulo || 'Trabalho sem título'}</button>
      <p className="text-xs leading-relaxed text-slate-300">{d.ano ?? 'Ano não informado'} · {d.nivel_academico || 'Tipo não informado'} · {d.programa_origem || 'Origem não informada'}</p>
      <p className="text-sm text-slate-300">{d.autores.join('; ') || 'Autoria não informada'}</p>
      <p className="text-sm leading-relaxed text-slate-400">{d.resumo.trim() ? d.resumo.length > 240 ? d.resumo.slice(0, 240) + '…' : d.resumo : 'Resumo não disponível no recorte local.'}</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="btn" onClick={() => abrir(d)} aria-label={`Ler resumo e detalhes: ${d.titulo}`}>Ler resumo e detalhes</button><FonteTrabalho doc={d} /></div>
    </li>)}</ol>}
    {result.length > 6 && <nav className="flex flex-wrap items-center gap-3" aria-label={`Páginas de ${titulo}`}><button className="btn" type="button" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>Trabalhos anteriores</button><span className="text-sm">Página {paginaAtual + 1} de {Math.ceil(result.length / 6)}</span><button className="btn" type="button" disabled={(paginaAtual + 1) * 6 >= result.length} onClick={() => setPagina(paginaAtual + 1)}>Próximos trabalhos</button></nav>}
  </section>;
}
