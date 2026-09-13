import { hashResumo } from '../src/lib/ia-evidencias';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { identidadeDocumento, prepararImportacao, linhasExportacaoOntologia, aplicarPorIdentidade, COLUNAS_ONTOLOGIA, ontologiaValida } from '../src/lib/ontologia-importacao';
import { amostraSintese, historicoEnviado } from '../src/lib/ia-contexto';
import { recuperarIA, iaVazia } from '../src/lib/ia-state';
import { conversaVazia, useEcoGradStore } from '../src/stores/useEcoGradStore';
import { enviarMensagem, interromperConversa } from '../src/services/chat';
import { iniciarExtracao, interromperExtracao, gerarSintese, interromperSintese } from '../src/services/ia';
import { lerStreamChat, requisicaoChat, validarConfigIA, type ConfigIA } from '../src/lib/provedores-ia';
import type { Documento, OntologiaIA } from '../src/types';
const doc=(p:Partial<Documento>={}):Documento=>({titulo:'Mesmo título',ano:2020,programa_origem:'TCC A',url:'https://repositorio.ufsc.br/handle/1/2',autores:['Ana'],orientador:'João',co_orientadores:[],palavras_chave:['A'],macrotema:'M',nivel_academico:'TCC',resumo:'Um resumo',...p});
const onto:OntologiaIA={teorias_e_modelos:['Teoria, com vírgula'],ferramentas_e_artefatos:[],metodos_e_tecnicas:['Método\ncom quebra']};
const fields=['Título',...COLUNAS_ONTOLOGIA];
const legacy=(titulo:string)=>({'Título':titulo,'Teorias e Modelos':'Teoria','Ferramentas e Artefatos':'','Métodos e Técnicas':''});
const init=()=>useEcoGradStore.setState({analysisId:crypto.randomUUID(),baseVersion:'v1',docs:[doc(),doc({titulo:'Segundo',url:'https://repositorio.ufsc.br/handle/1/3'})],chat:conversaVazia(),ia:iaVazia(),ui:{}});
const sse=(eventos:unknown[])=>new Response(eventos.map(e=>'data: '+JSON.stringify(e)).join('\n\n')+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
const openai=(texto:string,fim=true)=>sse([{choices:[{delta:{content:texto}}]},...(fim?[{choices:[{delta:{},finish_reason:'stop'}]}]:[])]);
const cfg:ConfigIA={provedor:'openai',modelo:'gpt-teste',baseUrl:'https://api.openai.com/v1',chave:'sk-teste'};
const dossie={nomePrograma:'TCC A',totalDocumentos:2,lideresVolume:[],pontesInterdisciplinares:[],principaisConceitos:[],docentes:[],catalogo:[]};
const tick=()=>new Promise<void>(r=>setTimeout(r,10));
test('identity is stable across ordering and ontology changes, separating same titles by source and collection',async()=>{
 const a=doc(),b=doc({url:'https://repositorio.ufsc.br/handle/1/3'});assert.notEqual(await identidadeDocumento(a),await identidadeDocumento(b));assert.equal(await identidadeDocumento(a),await identidadeDocumento({...a,ontologia_ia:onto}));assert.notEqual(await identidadeDocumento(a),await identidadeDocumento({...a,programa_origem:'B'}));
 assert.equal(await identidadeDocumento(doc({url:''})),await identidadeDocumento(doc({url:'',ontologia_ia:onto})));
});
test('new CSV roundtrip preserves commas, newlines, JSON lists and empty lists',async()=>{
 const docs=[doc({ontologia_ia:onto})];const rows=await linhasExportacaoOntologia(docs,'v1');const stringRows=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,String(v)])));
 const preview=await prepararImportacao(stringRows,Object.keys(rows[0]),docs,'v1','roundtrip.csv');assert.equal(preview.linhas[0].valida,true);assert.deepEqual(preview.linhas[0].ontologia,onto);assert.equal(preview.linhas[0].substituir,true);
});
test('legacy matching is exact and unique; accent, case, whitespace and repeated titles never approximate',async()=>{
 const docs=[doc({titulo:'Árvore'}),doc({titulo:'Duplicado',url:'b'}),doc({titulo:'Duplicado',url:'c'})];
 const p=await prepararImportacao(['Árvore','arvore','Árvore ','Duplicado'].map(legacy),fields,docs,'v1','old.csv');assert.deepEqual(p.linhas.map(l=>l.valida),[true,false,false,false]);
});
test('unknown IDs never fall back to title; wrong base, metadata and duplicate rows are blocked',async()=>{
 const rows=await linhasExportacaoOntologia([doc({ontologia_ia:onto})],'v1');const r=Object.fromEntries(Object.entries(rows[0]).map(([k,v])=>[k,String(v)]));
 for(const changed of [{...r,'ID do documento':'unknown'},{...r,'Versão da base':'v2'},{...r,'Título':'Alterado'},{...r,URL:'https://fonte-diferente.example'}])assert.equal((await prepararImportacao([changed],Object.keys(r),[doc()],'v1','a')).linhas[0].valida,false);
 assert.ok((await prepararImportacao([r,r],Object.keys(r),[doc()],'v1','a')).linhas.every(l=>!l.valida));
});
test('validation refuses malformed lists, duplicate headers and files over row limit',async()=>{
 assert.equal(ontologiaValida({teorias_e_modelos:[''],ferramentas_e_artefatos:[],metodos_e_tecnicas:[]}),false);
 await assert.rejects(prepararImportacao([],['Título',...fields],[doc()],'v1','a'));
 await assert.rejects(prepararImportacao(Array.from({length:2001},()=>legacy('Mesmo título')),fields,[doc()],'v1','a'));
});
test('application ignores ambiguous identity, preserves existing ontology unless explicitly replacing, and never mutates input',async()=>{
 const d=doc();const id=await identidadeDocumento(d);const map=new Map([[id,onto]]);assert.equal((await aplicarPorIdentidade([d,d],map)).atualizados,0);
 const changed=await aplicarPorIdentidade([d],map);assert.equal(changed.atualizados,1);assert.equal(d.ontologia_ia,undefined);
 assert.equal((await aplicarPorIdentidade(changed.proximos,map)).atualizados,0);assert.equal((await aplicarPorIdentidade(changed.proximos,map,true)).atualizados,1);
});
test('sampling preserves the original stride and exposes actual 20000 character truncation',()=>{
 const a=amostraSintese(Array.from({length:264},(_,i)=>doc({titulo:String(i)})));assert.equal(a.quantidade,25);assert.equal(a.salto,10);assert.ok(a.texto.includes('- 240 |'));
 assert.equal(amostraSintese([doc({titulo:'x'.repeat(21000)})]).truncada,true);assert.equal(amostraSintese([]).quantidade,0);
});
test('conversation window respects message and character limits without changing saved history',()=>{
 const m=Array.from({length:30},(_,i)=>({role:i%2?'assistant' as const:'user' as const,content:'x'.repeat(2000)}));const h=historicoEnviado(m);assert.ok(h.length<=12);assert.equal(h[0].role,'user');assert.equal(m.length,30);
});
test('provider streams preserve partial text but require an explicit successful finish',async()=>{
 const sinal=new AbortController().signal;let t='';
 await assert.rejects(lerStreamChat(openai('Parcial',false).body!,'openai',x=>t+=x,sinal));assert.equal(t,'Parcial');
 await assert.rejects(lerStreamChat(sse([{choices:[{delta:{content:'a'},finish_reason:'length'}]}]).body!,'openai',()=>{},sinal),/length/);
 t='';await lerStreamChat(sse([{type:'content_block_delta',delta:{type:'thinking_delta',thinking:'x'}},{type:'content_block_delta',delta:{type:'text_delta',text:'Olá'}},{type:'message_delta',delta:{stop_reason:'end_turn'}}]).body!,'anthropic',x=>t+=x,sinal);assert.equal(t,'Olá');
 await assert.rejects(lerStreamChat(sse([{type:'message_delta',delta:{stop_reason:'refusal'}}]).body!,'anthropic',()=>{},sinal),/recusou/);
 await assert.rejects(lerStreamChat(sse([{type:'error',error:{message:'Sobrecarga'}}]).body!,'anthropic',()=>{},sinal),/Sobrecarga/);
 await lerStreamChat(new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Oi'}]},finishReason:'STOP'}]})).body!,'google',()=>{},sinal);
 await assert.rejects(lerStreamChat(sse([{candidates:[{content:{parts:[{text:'Oi'}]},finishReason:'MAX_TOKENS'}]}]).body!,'google',()=>{},sinal));
});
test('requests go straight to the chosen provider with its own auth and system prompt placement',()=>{
 const m=[{role:'user' as const,content:'Pergunta'}];
 const o=requisicaoChat(cfg,'Sistema',m);assert.equal(o.url,'https://api.openai.com/v1/chat/completions');assert.equal((o.init.headers as Record<string,string>).Authorization,'Bearer sk-teste');assert.deepEqual(JSON.parse(String(o.init.body)).messages[0],{role:'system',content:'Sistema'});
 const a=requisicaoChat({...cfg,provedor:'anthropic',modelo:'claude-opus-5',baseUrl:'https://api.anthropic.com/v1/'},'Sistema',m);const ah=a.init.headers as Record<string,string>;const ab=JSON.parse(String(a.init.body));
 assert.equal(a.url,'https://api.anthropic.com/v1/messages');assert.equal(ah['x-api-key'],'sk-teste');assert.equal(ah['anthropic-dangerous-direct-browser-access'],'true');assert.equal(ab.system[0].text,'Sistema');assert.equal(ab.fallbacks,'default');assert.equal(ah['anthropic-beta'],'server-side-fallback-2026-07-01');
 assert.equal(JSON.parse(String(requisicaoChat({...cfg,provedor:'anthropic',modelo:'claude-haiku-4-5',baseUrl:'https://api.anthropic.com/v1'},'S',m).init.body)).fallbacks,undefined);
 const g=requisicaoChat({...cfg,provedor:'google',modelo:'gemini-2.5-flash',baseUrl:'https://generativelanguage.googleapis.com/v1beta'},'Sistema',[...m,{role:'assistant',content:'R'}]);assert.match(g.url,/models\/gemini-2\.5-flash:streamGenerateContent\?alt=sse$/);assert.equal(JSON.parse(String(g.init.body)).contents[1].role,'model');
 assert.equal(validarConfigIA({...cfg,chave:' '}),'Informe a chave de API do provedor.');assert.match(validarConfigIA({...cfg,provedor:'personalizado',baseUrl:'http://exemplo.com/v1'})!,/HTTPS/);assert.equal(validarConfigIA({...cfg,provedor:'personalizado',baseUrl:'http://localhost:11434/v1'}),null);
});
test('chat without a configured provider asks for a key and sends nothing',async()=>{
 init();const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response();};
 try{useEcoGradStore.getState().setChat({entrada:'Pergunta'});await enviarMensagem(dossie,false,null);assert.equal(calls,0);assert.match(useEcoGradStore.getState().chat.erro!,/chave/);assert.equal(useEcoGradStore.getState().chat.entrada,'Pergunta');}finally{globalThis.fetch=original;}
});
test('retry does not duplicate question, preserves prior partial and draft, and successful completion clears retry',async()=>{
 init();const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>++calls===1?openai('Parcial',false):openai('Completa');
 try{useEcoGradStore.getState().setChat({entrada:'Pergunta'});await enviarMensagem(dossie,false,cfg);assert.equal(useEcoGradStore.getState().chat.parcial,'Parcial');useEcoGradStore.getState().setChat({entrada:'Outro rascunho'});await enviarMensagem(dossie,true,cfg);const c=useEcoGradStore.getState().chat;assert.equal(c.mensagens.filter(m=>m.role==='user').length,1);assert.deepEqual(c.parciaisAnteriores,['Parcial']);assert.equal(c.entrada,'Outro rascunho');assert.equal(c.tentativa,undefined);}finally{globalThis.fetch=original;}
});
test('chat cancellation and analysis changes reject late replies',async()=>{
 init();const original=globalThis.fetch;let release!:(r:Response)=>void;globalThis.fetch=()=>new Promise(r=>release=r);
 try{useEcoGradStore.getState().setChat({entrada:'Pergunta'});const pending=enviarMensagem(dossie,false,cfg);interromperConversa();release(openai('Tardia'));await pending;assert.equal(useEcoGradStore.getState().chat.streaming,false);assert.ok(useEcoGradStore.getState().chat.erro);
 useEcoGradStore.getState().setChat({entrada:'Outra'});const second=enviarMensagem(dossie,false,cfg);init();release(openai('Tardia'));await second;assert.equal(useEcoGradStore.getState().chat.mensagens.length,0);}finally{globalThis.fetch=original;}
});
test('ontology persists successes, retries only failed items, and applies nothing before review',async()=>{
 init();const original=globalThis.fetch;let fail=true;const sent:string[]=[];
 globalThis.fetch=async(_u,o)=>{const d=JSON.parse(String(o?.body)).itens[0];sent.push(d.id);return Response.json({resultados:[{id:d.id,ontologia:d.titulo==='Segundo'&&fail?null:{teorias_e_modelos:[],ferramentas_e_artefatos:[],metodos_e_tecnicas:[]},evidencias:[],resumoSha256:await hashResumo(d.resumo),erro:d.titulo==='Segundo'&&fail?'Falha':null}]});};
 try{await iniciarExtracao(5);let s=useEcoGradStore.getState();assert.equal(s.ia.lote?.itens.filter(i=>i.estado==='concluido').length,1);assert.ok(s.docs.every(d=>!d.ontologia_ia));fail=false;await iniciarExtracao(5,true);s=useEcoGradStore.getState();assert.equal(sent.length,3);assert.equal(s.ia.lote?.itens.filter(i=>i.estado==='concluido').length,2);}finally{globalThis.fetch=original;}
});
test('ontology refuses mismatched response identity and interruption leaves pending work resumable',async()=>{
 init();const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({resultados:[{id:'wrong',ontologia:onto}]});
 try{await iniciarExtracao(5);assert.ok(useEcoGradStore.getState().ia.lote?.itens.every(i=>i.estado==='erro'));
 let release!:(r:Response)=>void;globalThis.fetch=()=>new Promise(r=>release=r);const p=iniciarExtracao(5,true);await tick();interromperExtracao();release(Response.json({resultados:[]}));await p;assert.equal(useEcoGradStore.getState().ia.lote?.estado,'interrompido');}finally{globalThis.fetch=original;}
});
test('synthesis failures, interruption and empty responses preserve prior result without false success',async()=>{
 init();const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({descritivo:'Síntese original'});
 try{await gerarSintese('s',['A'],'amostra');globalThis.fetch=async()=>Response.json({error:'Indisponível'},{status:503});await gerarSintese('s',['A'],'amostra');assert.equal(useEcoGradStore.getState().ia.sinteses.s.texto,'Síntese original');assert.equal(useEcoGradStore.getState().ia.sinteses.s.estado,'erro');
 let release!:(r:Response)=>void;globalThis.fetch=()=>new Promise(r=>release=r);const p=gerarSintese('s',['A'],'amostra');interromperSintese('s');release(Response.json({descritivo:'Tardia'}));await p;assert.equal(useEcoGradStore.getState().ia.sinteses.s.texto,'Síntese original');assert.equal(useEcoGradStore.getState().ia.sinteses.s.estado,'interrompida');}finally{globalThis.fetch=original;}
});
test('reload converts active AI work to manual recovery without losing completed items, previews or synthesis',()=>{
 const state=iaVazia();state.lote={baseVersion:'v1',estado:'executando',itens:[{id:'a',titulo:'A',estado:'concluido',ontologia:onto},{id:'b',titulo:'B',estado:'executando'}]};state.sinteses.s={texto:'Anterior',estado:'executando',amostra:'a',programas:['A']};const r=recuperarIA(state);assert.equal(r.lote?.estado,'interrompido');assert.equal(r.lote?.itens[0].estado,'concluido');assert.equal(r.lote?.itens[1].estado,'pendente');assert.equal(r.sinteses.s.estado,'interrompida');assert.equal(r.sinteses.s.texto,'Anterior');assert.equal(state.lote.estado,'executando');
});

test('commit revalidates concurrent activity guard before replacing document data',async()=>{
 init();const s=useEcoGradStore.getState(),docs=s.docs;const id=await identidadeDocumento(docs[0]);
 await assert.rejects(s.aplicarOntologia(new Map([[id,onto]]),false,()=>{throw new Error('Cálculo em andamento');}),/Cálculo em andamento/);
 assert.equal(useEcoGradStore.getState().docs,docs);assert.equal(docs[0].ontologia_ia,undefined);
});

test('resuming refuses ambiguous document IDs without sending a source to AI',async()=>{
 init();const d=doc(),id=await identidadeDocumento(d);useEcoGradStore.setState({docs:[d,{...d,resumo:'Outro resumo'}],ia:{...iaVazia(),lote:{baseVersion:'v1',estado:'interrompido',itens:[{id,titulo:d.titulo,estado:'pendente'}]}}});
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({resultados:[]});};
 try{await iniciarExtracao(5,true);assert.equal(calls,0);assert.match(useEcoGradStore.getState().ia.lote!.itens[0].erro!,/ambígua/);assert.ok(useEcoGradStore.getState().docs.every(d=>!d.ontologia_ia));}finally{globalThis.fetch=original;}
});
test('resuming a stale review preserves its proposals instead of replacing the batch',async()=>{
 init();const lote={baseVersion:'old',estado:'interrompido' as const,itens:[{id:await identidadeDocumento(doc()),titulo:'Original',estado:'pendente' as const}]};useEcoGradStore.getState().setIA({lote});
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({resultados:[]});};
 try{await iniciarExtracao(5,true);assert.equal(calls,0);assert.equal(useEcoGradStore.getState().ia.lote,lote);}finally{globalThis.fetch=original;}
});
test('review changed while IDs are computed cannot be overwritten by extraction',async()=>{
 init();const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({resultados:[]});};
 try{const pending=iniciarExtracao(5);const newer={baseVersion:'v1',estado:'concluido' as const,itens:[]};useEcoGradStore.getState().setIA({lote:newer});await pending;assert.equal(calls,0);assert.equal(useEcoGradStore.getState().ia.lote,newer);}finally{globalThis.fetch=original;}
});
