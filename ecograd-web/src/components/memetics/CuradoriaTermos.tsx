import { Select } from '@/components/ui/Select';
import { useId, useState, useEffect } from 'react';
import { useSessionField } from '@/hooks/useSessionField';
import { propostas, decisaoAtual, ROTULOS_CATEGORIA, type CategoriaTermo } from '@/lib/curadoria';
import { CATEGORIAS_EVIDENCIA } from '@/lib/ia-evidencias';
import type { ItemExtracao } from '@/lib/ia-state';
import { decidirTermo } from '@/services/curadoria';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { indexarDocumentos } from '@/lib/ontologia-importacao';

export function CuradoriaTermos({item,bloqueado,revisaoId}:{item:ItemExtracao;bloqueado:boolean;revisaoId:string}) {
  if(item.estado !== 'concluido')return <p>Curadoria disponível após concluir a extração.</p>;
  const termos=propostas(item);
  if(!termos.length)return <p>Não há termos propostos. Nenhum enriquecimento será aplicado para este documento.</p>;
  return <details><summary className="min-h-11 cursor-pointer">Revisar {termos.length} termos de {item.titulo}</summary>
    {!item.fonte&&<FonteLegada id={item.id}/>}
    <div className="space-y-4 py-2">{termos.map(p=><EditorTermo key={p.chave} item={item} proposta={p} bloqueado={bloqueado} revisaoId={revisaoId}/>)}</div>
  </details>;
}
function FonteLegada({id}:{id:string}) {
  const docs=useEcoGradStore(s=>s.docs),[fonte,setFonte]=useState<{resumo:string;url:string}|null>(null),[erro,setErro]=useState('');
  useEffect(()=>{let ativo=true;setFonte(null);setErro('');void indexarDocumentos(docs).then(index=>{
    if(!ativo)return;const matches=index.filter(x=>x.id===id);
    if(matches.length!==1){setErro('Não há uma fonte de identidade única para este resultado.');return;}
    setFonte({resumo:matches[0].documento.resumo,url:matches[0].documento.url});
  }).catch(()=>{if(ativo)setErro('Não foi possível conferir a fonte.');});return()=>{ativo=false;};},[docs,id]);
  return <div className="space-y-2"><p>Resultado legado: o resumo abaixo é o da análise atual; não há registro do que a IA recebeu originalmente. Ao salvar uma decisão, esta fonte será vinculada à revisão humana.</p>
    {erro&&<p role="alert">{erro}</p>}
    {fonte&&<><details><summary className="min-h-11 cursor-pointer">Conferir resumo atual do documento</summary><p className="whitespace-pre-wrap">{fonte.resumo||'Resumo indisponível; não será possível aprovar termos.'}</p></details>{/^https?:\/\//i.test(fonte.url)&&<a href={fonte.url} target="_blank" rel="noopener noreferrer" className="underline">Abrir fonte atual</a>}</>}
  </div>;
}
function EditorTermo({item,proposta:p,bloqueado,revisaoId}:{item:ItemExtracao;proposta:ReturnType<typeof propostas>[number];bloqueado:boolean;revisaoId:string}) {
  const atual=decisaoAtual(item,p.chave);
  const idCategoria=useId();
  const [draft,setDraft]=useSessionField(`curadoria.${revisaoId}.${item.id}.${p.chave}`,{
    termo:atual?.termo??p.termo,categoria:atual?.categoria??p.categoria,trecho:atual?.trecho??p.trecho,justificativa:atual?.justificativa??'',
  });
  const [erro,setErro]=useState(''),[salvando,setSalvando]=useState(false);
  const salvar=async(estado:'aprovado'|'rejeitado')=>{
    setSalvando(true);setErro('');
    try{await decidirTermo(item.id,p.chave,{...draft,estado});}
    catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar a decisão.');}
    finally{setSalvando(false);}
  };
  const alterado=!!atual&&(draft.termo!==atual.termo||draft.categoria!==atual.categoria||draft.trecho!==atual.trecho||draft.justificativa!==atual.justificativa);
  return <fieldset className="min-w-0 space-y-2 border border-slate-600 rounded p-3" disabled={bloqueado||salvando}>
    <legend className="font-semibold break-words">Proposta original: {p.termo}</legend>
    <p>Categoria original: {ROTULOS_CATEGORIA[CATEGORIAS_EVIDENCIA.indexOf(p.categoria)]}</p>
    <p role="status">Decisão salva: {atual?.estado??'pendente'}{alterado?' · Há alterações no rascunho; salve uma decisão para usá-las.':''}</p>
    {p.trecho&&<blockquote className="border-l-2 pl-2">{p.trecho}</blockquote>}
    <label className="block">Termo revisado<input className="input mt-1 w-full" value={draft.termo} maxLength={500} onChange={e=>setDraft({...draft,termo:e.target.value})}/></label>
    <label htmlFor={idCategoria} className="block">Categoria revisada<Select id={idCategoria} aria-label="Categoria revisada" className="mt-1" valor={draft.categoria} onChange={v=>setDraft({...draft,categoria:v as CategoriaTermo})} opcoes={CATEGORIAS_EVIDENCIA.map((c,i)=>({valor:c,rotulo:ROTULOS_CATEGORIA[i]}))} /></label>
    <label className="block">Trecho literal de apoio<textarea className="input mt-1 w-full min-h-24" maxLength={1000} value={draft.trecho} onChange={e=>setDraft({...draft,trecho:e.target.value})}/></label>
    <label className="block">Justificativa da decisão<textarea className="input mt-1 w-full min-h-20" maxLength={2000} value={draft.justificativa} onChange={e=>setDraft({...draft,justificativa:e.target.value})}/></label>
    <p className="text-xs">Aprovar ou corrigir exige justificativa e trecho literal de 10 a 1.000 caracteres. Rejeitar exige justificativa; a proposta original será mantida.</p>
    <div className="flex flex-wrap gap-2"><button type="button" className="btn" onClick={()=>void salvar('aprovado')}>Salvar aprovação</button><button type="button" className="btn" onClick={()=>void salvar('rejeitado')}>Rejeitar termo</button></div>
    {erro&&<p role="alert">{erro}</p>}
    {atual&&<p>Última decisão: {atual.termo} · {ROTULOS_CATEGORIA[CATEGORIAS_EVIDENCIA.indexOf(atual.categoria)]} · {atual.justificativa}</p>}
    {!!item.curadoria?.termos[p.chave]?.length&&<details><summary className="min-h-11 cursor-pointer">Histórico de decisões</summary><ol className="space-y-2">{item.curadoria.termos[p.chave].map((d,i)=><li key={i}>{d.quando} · {d.estado} · {d.termo} · {ROTULOS_CATEGORIA[CATEGORIAS_EVIDENCIA.indexOf(d.categoria)]}<p>{d.justificativa}</p>{d.trecho&&<blockquote>{d.trecho}</blockquote>}</li>)}</ol></details>}
  </fieldset>;
}
