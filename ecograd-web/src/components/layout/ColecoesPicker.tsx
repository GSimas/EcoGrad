import { urlColecao, vinculoDocumentado, type ColecaoCobertura } from '@/lib/colecoes';
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
