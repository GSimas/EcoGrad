import { conversaVazia, useEcoGradStore } from '../stores/useEcoGradStore';
import { herdadoDaTelaInicial, historicoEnviado, LIMITE_MENSAGEM } from '../lib/ia-contexto';
import { CHAVE_CONVERSA_ACERVO, turnosHerdados } from '../lib/ufscao-acervo';
import { promptConsultor, type DossieConsultor } from '../lib/consultor-prompt';
import { lerConfigIA, lerStreamChat, provedorPorId, requisicaoChat, validarConfigIA, type ConfigIA } from '../lib/provedores-ia';
import type { ChatMessage } from '../types';
/** O que este servico precisa saber da conversa da tela inicial, sem importar o servico dela. */
type ConversaDaTelaInicial=ReadonlyArray<{pergunta:string;texto:string;aprofundamento?:{texto:string}}>;
let controller:AbortController|null=null;
export function interromperConversa(){controller?.abort();}
export function limparConversa(){controller?.abort();controller=null;const entrada=useEcoGradStore.getState().chat.entrada;useEcoGradStore.setState({chat:{...conversaVazia(),entrada}});}
/** BYOK: a chamada sai do navegador direto para o provedor escolhido pelo usuário. */
export async function enviarMensagem(dossie:DossieConsultor,repetir=false,config:ConfigIA|null=lerConfigIA()){
 const {chat,analysisId,setChat}=useEcoGradStore.getState();
 if(chat.streaming||(chat.contexto&&chat.contexto!==analysisId))return;
 if(!repetir&&(!chat.entrada.trim()||chat.entrada.length>LIMITE_MENSAGEM))return;
 if(repetir&&(!chat.tentativa||chat.tentativa.contexto!==analysisId))return;
 const invalida=config?validarConfigIA(config):'Configure um provedor e sua chave de API para conversar.';
 if(!config||invalida){setChat({erro:invalida});return;}
 const provedor=provedorPorId(config.provedor);
 const request=new AbortController();controller=request;
 const historico:ChatMessage[]=repetir?chat.tentativa!.historico:[...chat.mensagens,...(chat.parcial?[{role:'assistant' as const,content:`[Resposta parcial interrompida] ${chat.parcial}`}]:[]),{role:'user',content:chat.entrada.trim()}];
 const atualizar=(v:Parameters<typeof setChat>[0])=>{if(controller===request&&useEcoGradStore.getState().analysisId===analysisId)setChat(v);};
 atualizar({mensagens:historico,entrada:repetir?chat.entrada:'',parcial:'',erro:null,streaming:true,contexto:analysisId,tentativa:{historico,contexto:analysisId},parciaisAnteriores:repetir&&chat.parcial?[...(chat.parciaisAnteriores??[]),chat.parcial]:chat.parciaisAnteriores});
 let acumulado='';
 try{
  // O dossiê é montado para ESTA pergunta: sem ela iria o acervo inteiro a cada mensagem.
  const pergunta=[...historico].reverse().find(m=>m.role==='user')?.content??'';
  // A conversa da tela inicial entra antes da do painel, e só na solicitação:
  // guardar em `chat.mensagens` a mostraria duas vezes na tela.
  const herdados=herdadoDaTelaInicial(turnosHerdados((useEcoGradStore.getState().ui[CHAVE_CONVERSA_ACERVO] as ConversaDaTelaInicial)??[]));
  const {url,init}=requisicaoChat(config,promptConsultor(dossie,pergunta,herdados.length/2),[...herdados,...historicoEnviado(historico)]);
  if(new TextEncoder().encode(String(init.body)).length>1500000)throw new Error('Contexto excede 1,5 MB. Reduza a seleção de coleções antes de consultar.');
  let response:Response;
  try{response=await fetch(url,{...init,signal:request.signal});}
  catch(e){if(request.signal.aborted)throw e;throw new Error(`Não foi possível conectar a ${provedor.nome}. Verifique a URL, a rede ou se o provedor aceita chamadas diretas do navegador (CORS).`);}
  if(!response.ok||!response.body){const e=await response.json().catch(()=>null);const d=Array.isArray(e)?e[0]:e;throw new Error(`${provedor.nome}: ${d?.error?.message||`resposta indisponível (HTTP ${response.status})`}`);}
  await lerStreamChat(response.body,provedor.formato,(texto)=>{acumulado+=texto;atualizar({parcial:acumulado});if(acumulado.length>100000)throw new Error('Resposta excedeu 100 mil caracteres. O texto parcial foi preservado.');},request.signal);
  if(!acumulado.trim())throw new Error('A IA encerrou sem retornar texto.');
  atualizar({mensagens:[...historico,{role:'assistant',content:acumulado}],parcial:'',tentativa:undefined});
 }catch(e){atualizar({erro:request.signal.aborted?'Resposta interrompida por você. Pergunta e texto parcial preservados.':`${e instanceof Error?e.message:'Falha na resposta.'} Pergunta e texto parcial preservados.`});}
 finally{atualizar({streaming:false});if(controller===request)controller=null;}
}
useEcoGradStore.subscribe((s,p)=>{if(s.analysisId!==p.analysisId){interromperConversa();controller=null;if(s.chat.streaming)useEcoGradStore.getState().setChat({streaming:false,erro:'Interrompida porque a análise mudou. A conversa anterior foi preservada.'});}});
