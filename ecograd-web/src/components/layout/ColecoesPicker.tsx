import { useId, useState } from 'react';
import { useSessionField } from '@/hooks/useSessionField';
import { nomeParaComparar, urlColecao, vinculoDocumentado, type ColecaoCobertura } from '@/lib/colecoes';
import { correspondeBusca } from '@/lib/utils';
const numero = (n: number) => n.toLocaleString('pt-BR');
export function EvidenciaColecao({ nome, specs, tipo }: { nome: string; specs: string[]; tipo: string }) {
  const vinculo = vinculoDocumentado(nome, specs, tipo);
  return <div className="space-y-2 text-xs text-slate-300">
    <p className="font-medium">{tipo === 'tcc' ? 'CAPES: não se aplica à coleção de TCCs; não se atribui nota de programa a esses trabalhos.' : vinculo ? `Vínculo documentado · CAPES ${vinculo.codigo} · ${vinculo.modalidade}` : 'CAPES: vínculo não verificado. Nenhuma nota atribuída à coleção.'}</p>
    {vinculo && <details><summary className="cursor-pointer py-2 text-eco-accent">Evidências do vínculo CAPES</summary><p>{vinculo.criterio}</p><p className="my-2">Verificação documental: {vinculo.verificadoEm}. A nota e a situação são consultadas separadamente na CAPES.</p><ul className="space-y-2">{vinculo.fontes.map((f) => <li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">{f.titulo} ↗</a></li>)}</ul></details>}
  </div>;
}
export function DetalhesCobertura({ c }: { c: ColecaoCobertura }) {
  return <div className="space-y-3 text-sm text-slate-300">
    <p>{Object.entries(c.niveis).map(([nivel, n]) => `${numero(n)} ${nivel}`).join(' · ') || 'Nenhum tipo de documento registrado.'}</p>
    <dl className="grid grid-cols-2 gap-2 text-xs">
      {([['Com resumo', c.comResumo], ['Com palavras-chave', c.comPalavras], ['Com orientador', c.comOrientador], ['Com link de fonte', c.comFonte], ['Sem ano', c.semAno]] as const).map(([label, n]) => <div key={label}><dt>{label}</dt><dd className="font-semibold">{numero(n)} de {numero(c.total)}</dd></div>)}
    </dl>
    {c.comFonte > c.fontesDistintas && <p className="text-xs text-amber-200">{numero(c.comFonte - c.fontesDistintas)} repetições de links nesta coleção. A contagem representa registros, não trabalhos únicos.</p>}
    {c.setSpecs.length > 1 && <p className="text-xs text-amber-200">Este nome agrupa {c.setSpecs.length} identificadores no catálogo. A base não distingue o identificador de origem de cada registro.</p>}
    <div className="space-y-2 break-words">{c.setSpecs.map((spec) => <p key={spec}>{urlColecao(spec) ? <a className="text-xs text-eco-accent underline" href={urlColecao(spec)!} target="_blank" rel="noopener noreferrer">Coleção no repositório: {spec.replace('col_', '').replace('_', '/')} ↗</a> : <span>{spec}</span>}</p>)}</div>
    <EvidenciaColecao nome={c.nome} specs={c.setSpecs} tipo={c.tipo} />
  </div>;
}
export function resumoCobertura(c?: ColecaoCobertura) {
  return c ? `${numero(c.total)} ${c.total === 1 ? 'registro' : 'registros'} · ${c.inicio === null ? 'período não informado' : c.inicio === c.fim ? `${c.inicio}` : `${c.inicio}–${c.fim}`}` : 'Cobertura ainda não disponível';
}
export function ColecoesPicker({ rotulo, tipo, opcoes, selecionados, onChange, colecoes }: {
  rotulo: string; tipo: 'ppg' | 'tcc'; opcoes: { nome: string; specs: string[] }[];
  selecionados: string[]; onChange: (v: string[]) => void; colecoes?: ColecaoCobertura[];
}) {
  const id = useId();
  const [busca, setBusca] = useSessionField('selecao.busca.' + tipo, '');
  const [limite, setLimite] = useState(20);
  const [somenteSelecionadas, setSomenteSelecionadas] = useSessionField('selecao.marcadas.' + tipo, false);
  const encontradas = opcoes.filter((o) => (!somenteSelecionadas || selecionados.includes(o.nome)) && correspondeBusca(o.nome + ' ' + o.specs.join(' '), busca));
  return <div className="min-w-0 space-y-3">
    <label htmlFor={id} className="block font-semibold">{rotulo}</label>
    <input id={id} className="input" type="search" placeholder="Buscar por nome ou identificador" value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(20); }} />
    <label className="flex min-h-11 items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={somenteSelecionadas} onChange={(e) => setSomenteSelecionadas(e.target.checked)} /> Mostrar apenas selecionadas ({selecionados.length})</label>
    <p className="text-xs text-slate-400" role="status">{encontradas.length} coleções encontradas · exibindo {Math.min(limite, encontradas.length)}</p>
    <ul className="max-h-[32rem] space-y-3 overflow-y-auto rounded-lg border border-eco-border p-2">
      {encontradas.slice(0, limite).map((o) => {
        const c = colecoes?.find((c) => c.tipo === tipo && c.nome === o.nome);
        const semelhantes = opcoes.filter((p) => p.nome !== o.nome && nomeParaComparar(p.nome) === nomeParaComparar(o.nome));
        return <li key={o.nome} className="space-y-2 rounded-lg border border-eco-border bg-eco-panel p-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold leading-relaxed"><input className="mt-1.5 shrink-0" type="checkbox" checked={selecionados.includes(o.nome)} onChange={() => onChange(selecionados.includes(o.nome) ? selecionados.filter((n) => n !== o.nome) : [...selecionados, o.nome])} /><span className="min-w-0 break-words">{o.nome}</span></label>
          <p className="text-xs text-slate-400 break-words">UFSC · {o.specs.join(' · ')}</p>
          <p className="text-sm text-slate-200">{resumoCobertura(c)}</p>
          {c?.total === 0 && <p className="text-xs text-amber-200">Sem registros neste recorte local. Isso não significa ausência de produção no repositório.</p>}
          {!!semelhantes.length && <p className="text-xs text-amber-200">Há {semelhantes.length} outra(s) coleção(ões) de nome semelhante. Compare identificadores, qualificadores e cobertura; elas não são unificadas.</p>}
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-eco-accent">Ver cobertura e fontes de {o.nome}</summary>{c ? <DetalhesCobertura c={c} /> : <><p className="mb-2 text-xs">Os metadados não puderam ser confirmados para esta coleção.</p><EvidenciaColecao nome={o.nome} specs={o.specs} tipo={tipo} /></>}</details>
        </li>;
      })}
      {!encontradas.length && <li className="p-3 text-sm text-slate-300">Nenhuma coleção neste filtro. Altere a busca ou desmarque “Mostrar apenas selecionadas”.</li>}
    </ul>
    {encontradas.length > limite && <button type="button" className="btn" onClick={() => setLimite((n) => n + 20)}>Mostrar mais coleções de {rotulo}</button>}
  </div>;
}
