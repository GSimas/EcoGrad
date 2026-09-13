import { hashResumo } from '../src/lib/ia-evidencias';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { identidadeDocumento, prepararImportacao, linhasExportacaoOntologia, aplicarPorIdentidade, COLUNAS_ONTOLOGIA, ontologiaValida } from '../src/lib/ontologia-importacao';
import { amostraSintese, historicoEnviado, lerRespostaChat } from '../src/lib/ia-contexto';
import { recuperarIA, iaVazia } from '../src/lib/ia-state';
import { conversaVazia, useEcoGradStore } from '../src/stores/useEcoGradStore';
import { enviarMensagem, interromperConversa } from '../src/services/chat';
import { iniciarExtracao, interromperExtracao, gerarSintese, interromperSintese } from '../src/services/ia';
import { respostaChat } from '../netlify/functions/_shared/chat-stream';
import type { Documento, OntologiaIA } from '../src/types';
const doc=(p:Partial<Documento>={}):Documento=>({titulo:'Mesmo título',ano:2020,programa_origem:'TCC A',url:'https://repositorio.ufsc.br/handle/1/2',autores:['Ana'],orientador:'João',co_orientadores:[],palavras_chave:['A'],macrotema:'M',nivel_academico:'TCC',resumo:'Um resumo',...p});
const onto:OntologiaIA={teorias_e_modelos:['Teoria, com vírgula'],ferramentas_e_artefatos:[],metodos_e_tecnicas:['Método\ncom quebra']};
const fields=['Título',...COLUNAS_ONTOLOGIA];
const legacy=(titulo:string)=>({'Título':titulo,'Teorias e Modelos':'Teoria','Ferramentas e Artefatos':'','Métodos e Técnicas':''});
const init=()=>useEcoGradStore.setState({analysisId:crypto.randomUUID(),baseVersion:'v1',docs:[doc(),doc({titulo:'Segundo',url:'https://repositorio.ufsc.br/handle/1/3'})],chat:conversaVazia(),ia:iaVazia(),ui:{}});
const stream=(lines:string[])=>new Response(lines.join('\n')+'\n',{headers:{'Content-Type':'application/x-ndjson'}});
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
test('stream decoder preserves partial text but rejects EOF without terminal confirmation',async()=>{
 let texto='';await assert.rejects(lerRespostaChat(stream(['{"tipo":"texto","texto":"Parcial"}']).body!,t=>texto+=t,new AbortController().signal));assert.equal(texto,'Parcial');
 await lerRespostaChat(stream(['{"tipo":"texto","texto":"Completa"}','{"tipo":"fim"}']).body!,()=>{},new AbortController().signal);
});
test('server streaming handles final SSE without newline and detects MAX_TOKENS or missing STOP',async()=>{
 const event=(finishReason?:string)=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Olá'}]},finishReason}]});
 let txt=await respostaChat(new Response(event('STOP')),new AbortController().signal).text();assert.match(txt,/"tipo":"fim"/);
 txt=await respostaChat(new Response(event('MAX_TOKENS')),new AbortController().signal).text();assert.match(txt,/"tipo":"erro"/);assert.doesNotMatch(txt,/"tipo":"fim"/);
 txt=await respostaChat(new Response(event()),new AbortController().signal).text();assert.match(txt,/"tipo":"erro"/);
});
test('retry does not duplicate question, preserves prior partial and draft, and successful completion clears retry',async()=>{
 init();const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>++calls===1?stream(['{"tipo":"texto","texto":"Parcial"}']):stream(['{"tipo":"texto","texto":"Completa"}','{"tipo":"fim"}']);
 try{useEcoGradStore.getState().setChat({entrada:'Pergunta'});await enviarMensagem({});assert.equal(useEcoGradStore.getState().chat.parcial,'Parcial');useEcoGradStore.getState().setChat({entrada:'Outro rascunho'});await enviarMensagem({},true);const c=useEcoGradStore.getState().chat;assert.equal(c.mensagens.filter(m=>m.role==='user').length,1);assert.deepEqual(c.parciaisAnteriores,['Parcial']);assert.equal(c.entrada,'Outro rascunho');assert.equal(c.tentativa,undefined);}finally{globalThis.fetch=original;}
});
test('chat cancellation and analysis changes reject late replies',async()=>{
 init();const original=globalThis.fetch;let release!:(r:Response)=>void;globalThis.fetch=()=>new Promise(r=>release=r);
 try{useEcoGradStore.getState().setChat({entrada:'Pergunta'});const pending=enviarMensagem({});interromperConversa();release(stream(['{"tipo":"texto","texto":"Tardia"}','{"tipo":"fim"}']));await pending;assert.equal(useEcoGradStore.getState().chat.streaming,false);assert.ok(useEcoGradStore.getState().chat.erro);
 useEcoGradStore.getState().setChat({entrada:'Outra'});const second=enviarMensagem({});init();release(stream(['{"tipo":"texto","texto":"Tardia"}','{"tipo":"fim"}']));await second;assert.equal(useEcoGradStore.getState().chat.mensagens.length,0);}finally{globalThis.fetch=original;}
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
