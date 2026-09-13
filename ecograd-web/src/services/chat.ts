import { conversaVazia, useEcoGradStore } from '../stores/useEcoGradStore';
import { historicoEnviado, lerRespostaChat, LIMITE_MENSAGEM } from '../lib/ia-contexto';
import type { ChatMessage } from '../types';
let controller:AbortController|null=null;
export function interromperConversa(){controller?.abort();}
export function limparConversa(){controller?.abort();controller=null;const entrada=useEcoGradStore.getState().chat.entrada;useEcoGradStore.setState({chat:{...conversaVazia(),entrada}});}
export async function enviarMensagem(dossie:unknown,repetir=false){
 const {chat,analysisId,setChat}=useEcoGradStore.getState();
 if(chat.streaming||(chat.contexto&&chat.contexto!==analysisId))return;
 if(!repetir&&(!chat.entrada.trim()||chat.entrada.length>LIMITE_MENSAGEM))return;
 if(repetir&&(!chat.tentativa||chat.tentativa.contexto!==analysisId))return;
 const request=new AbortController();controller=request;
 const historico:ChatMessage[]=repetir?chat.tentativa!.historico:[...chat.mensagens,...(chat.parcial?[{role:'assistant' as const,content:`[Resposta parcial interrompida] ${chat.parcial}`}]:[]),{role:'user',content:chat.entrada.trim()}];
 const atualizar=(v:Parameters<typeof setChat>[0])=>{if(controller===request&&useEcoGradStore.getState().analysisId===analysisId)setChat(v);};
 atualizar({mensagens:historico,entrada:repetir?chat.entrada:'',parcial:'',erro:null,streaming:true,contexto:analysisId,tentativa:{historico,contexto:analysisId},parciaisAnteriores:repetir&&chat.parcial?[...(chat.parciaisAnteriores??[]),chat.parcial]:chat.parciaisAnteriores});
 let acumulado='';
 try{
  const payload=JSON.stringify({mensagens:historicoEnviado(historico),dossie});
  if(new TextEncoder().encode(payload).length>1500000)throw new Error('Contexto excede 1,5 MB. Reduza a seleção de coleções antes de consultar.');
  const response=await fetch('/api/gemini-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:request.signal});
  if(!response.ok||!response.body){const e=await response.json().catch(()=>null);throw new Error(e?.error||`Resposta indisponível (HTTP ${response.status}).`);}
  if(!response.headers.get('content-type')?.includes('application/x-ndjson'))throw new Error('O serviço de chat precisa ser atualizado para confirmar respostas completas.');
  await lerRespostaChat(response.body,(texto)=>{acumulado+=texto;atualizar({parcial:acumulado});if(acumulado.length>100000)throw new Error('Resposta excedeu 100 mil caracteres. O texto parcial foi preservado.');},request.signal);
  if(!acumulado.trim())throw new Error('A IA encerrou sem retornar texto.');
  atualizar({mensagens:[...historico,{role:'assistant',content:acumulado}],parcial:'',tentativa:undefined});
 }catch(e){atualizar({erro:request.signal.aborted?'Resposta interrompida por você. Pergunta e texto parcial preservados.':`${e instanceof Error?e.message:'Falha na resposta.'} Pergunta e texto parcial preservados.`});}
 finally{atualizar({streaming:false});if(controller===request)controller=null;}
}
useEcoGradStore.subscribe((s,p)=>{if(s.analysisId!==p.analysisId){interromperConversa();controller=null;if(s.chat.streaming)useEcoGradStore.getState().setChat({streaming:false,erro:'Interrompida porque a análise mudou. A conversa anterior foi preservada.'});}});
