import { validarEvidencias, hashResumo } from '../lib/ia-evidencias';
import { useEcoGradStore } from '../stores/useEcoGradStore';
import { indexarDocumentos, ontologiaValida } from '../lib/ontologia-importacao';
import { parseOntologia } from '../lib/foresight-math';
import type { LoteExtracao, SinteseIA } from '../lib/ia-state';
const sinteses=new Map<string,AbortController>();
let extracao:AbortController|null=null;
export const interromperExtracao=()=>extracao?.abort();
export const interromperSintese=(id:string)=>sinteses.get(id)?.abort();
export async function gerarSintese(id:string,programas:string[],amostra:string,recorte?:{quantidade:number;total:number;salto:number;truncada:boolean}){
 const s=useEcoGradStore.getState();if(sinteses.has(id))return;
 const controller=new AbortController();sinteses.set(id,controller);const analysisId=s.analysisId;
 const atualizar=(v:Partial<SinteseIA>)=>{const atual=useEcoGradStore.getState();if(atual.analysisId!==analysisId||sinteses.get(id)!==controller)return;atual.setIA({sinteses:{...atual.ia.sinteses,[id]:{...atual.ia.sinteses[id],...v} as SinteseIA}});};
 atualizar({texto:s.ia.sinteses[id]?.texto??'',estado:'executando',erro:undefined,...(!s.ia.sinteses[id]?{amostra,programas}: {})});
 try{const r=await fetch('/api/gemini-synthesize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nomesProgramas:programas,amostraTextos:amostra,recorte:recorte?{quantidade:recorte.quantidade,total:recorte.total,salto:recorte.salto,truncada:recorte.truncada}:undefined}),signal:controller.signal});const body=await r.json();if(!r.ok)throw new Error(body.error||`HTTP ${r.status}`);if(typeof body.descritivo!=='string'||!body.descritivo.trim())throw new Error('A IA retornou uma síntese vazia.');controller.signal.throwIfAborted();atualizar({texto:body.descritivo,estado:'concluida',amostra,programas,escopo:typeof body.escopo==='string'?body.escopo:undefined});}
 catch(e){atualizar({estado:controller.signal.aborted?'interrompida':'erro',erro:controller.signal.aborted?'Solicitação interrompida. A síntese anterior foi preservada.':e instanceof Error?e.message:'Falha ao gerar síntese.'});}
 finally{if(sinteses.get(id)===controller)sinteses.delete(id);}
}
export async function iniciarExtracao(tamanho:number,retomar=false){
 if(extracao)return;const controller=new AbortController();extracao=controller;
 const s=useEcoGradStore.getState();const analysisId=s.analysisId;let lote:LoteExtracao|null=null;
 const atualizar=()=>{const atual=useEcoGradStore.getState();if(atual.analysisId!==analysisId||extracao!==controller||!lote)return;atual.setIA({lote:{...lote,itens:lote.itens.map(i=>({...i}))}});useEcoGradStore.setState(a=>({ui:{...a.ui,'ontologia.processando':lote!.estado==='executando','ontologia.status':`${lote!.itens.filter(i=>i.estado==='concluido').length}/${lote!.itens.length} documentos concluídos no lote.`}}));};
 try{
  const anterior=s.ia.lote;
  if(retomar&&(!anterior||anterior.aplicado||anterior.baseVersion!==s.baseVersion))return;
  const index=await indexarDocumentos(s.docs);controller.signal.throwIfAborted();
  const atual=useEcoGradStore.getState();
  if(atual.analysisId!==analysisId||atual.docs!==s.docs||atual.baseVersion!==s.baseVersion||atual.ia.lote!==anterior)return;
  const counts=new Map<string,number>();for(const x of index)counts.set(x.id,(counts.get(x.id)??0)+1);
  lote=retomar&&anterior&&anterior.baseVersion===s.baseVersion&&!anterior.aplicado?{...anterior,estado:'executando',itens:anterior.itens.map(i=>({...i,estado:i.estado==='concluido'?'concluido':'pendente',erro:undefined}))}:{revisaoId:crypto.randomUUID(),baseVersion:s.baseVersion,estado:'executando',itens:index.filter(x=>!parseOntologia(x.documento.ontologia_ia)&&x.documento.resumo.trim()&&counts.get(x.id)===1).slice(0,Math.max(1,Math.min(tamanho,1000))).map(x=>({id:x.id,titulo:x.documento.titulo,estado:'pendente'}))};
  atualizar();
  for(const item of lote.itens){
   if(item.estado==='concluido')continue;controller.signal.throwIfAborted();
   if(counts.get(item.id)!==1){item.estado='erro';item.erro='Identidade ausente ou ambígua na análise. Nenhuma fonte foi enviada.';atualizar();continue;}
   const d=index.find(x=>x.id===item.id)?.documento;
   if(!d){item.estado='erro';item.erro='Identidade não encontrada na análise.';atualizar();continue;}
   item.estado='executando';atualizar();
   try{
    // A completed document is checkpointed before another request starts.
    const r=await fetch('/api/gemini-ontology',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itens:[{id:item.id,titulo:d.titulo,resumo:d.resumo}],delayMs:0}),signal:controller.signal});
    const body=await r.json();if(!r.ok)throw new Error(body.error||`HTTP ${r.status}`);
    const out=body.resultados?.[0];if(body.resultados?.length!==1||out?.id!==item.id)throw new Error('Resposta sem identidade correspondente. Nenhum documento foi associado.');
    if(out.erro||!ontologiaValida(out.ontologia))throw new Error(out.erro||'Ontologia inválida.');
    const evidencias=validarEvidencias(out.ontologia,out.evidencias,d.resumo);
    const resumoSha256=await hashResumo(d.resumo);if(out.resumoSha256!==resumoSha256)throw new Error('A evidência pertence a outro resumo.');
    controller.signal.throwIfAborted();item.ontologia=out.ontologia;item.evidencias=evidencias;item.fonte={titulo:d.titulo,url:d.url,resumo:d.resumo,resumoSha256};item.estado='concluido';
   }catch(e){if(controller.signal.aborted)throw e;item.estado='erro';item.erro=e instanceof Error?e.message:'Falha na extração.';}
   atualizar();
   if(item!==lote.itens.at(-1))await intervaloExtracao(controller.signal);
  }
  lote.estado='concluido';atualizar();
 }catch{if(lote){lote.estado='interrompido';lote.itens=lote.itens.map(i=>i.estado==='executando'?{...i,estado:'pendente'}:i);atualizar();}}
 finally{if(extracao===controller){extracao=null;const atual=useEcoGradStore.getState();if(atual.analysisId===analysisId)useEcoGradStore.setState(a=>({ui:{...a.ui,'ontologia.processando':false}}));}}
}
useEcoGradStore.subscribe((s,p)=>{if(s.analysisId!==p.analysisId){interromperExtracao();for(const c of sinteses.values())c.abort();}});

function intervaloExtracao(signal:AbortSignal){
 signal.throwIfAborted();return new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},4000);signal.addEventListener('abort',abort,{once:true});});
}
