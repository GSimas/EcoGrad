import assert from 'node:assert/strict';
import {test} from 'node:test';
import chat from '../netlify/functions/gemini-chat';
import sintetizar from '../netlify/functions/gemini-synthesize';
import ontologia from '../netlify/functions/gemini-ontology';
const req=(body:unknown,signal?:AbortSignal)=>new Request('http://localhost/api',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'},signal});
const mock=async(run:()=>Promise<void>,fetcher:typeof fetch)=>{const f=globalThis.fetch,k=process.env.GEMINI_API_KEY;globalThis.fetch=fetcher;process.env.GEMINI_API_KEY='fake-test-key';try{await run();}finally{globalThis.fetch=f;if(k===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=k;}};
test('synthesis endpoint uses explicit bounded sample and returns a real failure status',async()=>{
 let sent='';await mock(async()=>{const r=await sintetizar(req({nomesProgramas:['A'],amostraTextos:'Amostra'}));assert.equal(r.status,200);assert.match(sent,/apenas nesta amostra/);},async(_u,o)=>{sent=String(o?.body);return Response.json({candidates:[{content:{parts:[{text:'Síntese da amostra'}]}}]});});
 const controller=new AbortController();await mock(async()=>{const r=await sintetizar(req({nomesProgramas:['A'],amostraTextos:'Amostra'},controller.signal));assert.equal(r.status,502);assert.ok((await r.json()).error);},async()=>{controller.abort();throw new Error('Falha simulada');});
});
test('ontology endpoint echoes exact identity and marks malformed model JSON as failed',async()=>{
 const item={id:'doc-v1-'+'a'.repeat(64),titulo:'Mesmo título',resumo:'Resumo'};
 await mock(async()=>{const r=await ontologia(req({itens:[item],delayMs:0}));const data=await r.json();assert.equal(data.resultados[0].id,item.id);assert.equal(data.resultados[0].ontologia,null);assert.ok(data.resultados[0].erro);},async()=>Response.json({candidates:[{content:{parts:[{text:'{}'}]}}]}));
});
test('ontology accepts valid empty lists, rejects missing or duplicate IDs and never matches titles',async()=>{
 const item={id:'doc-v1-'+'b'.repeat(64),titulo:'Título',resumo:'Resumo'};
 await mock(async()=>{const r=await ontologia(req({itens:[item],delayMs:0}));const data=await r.json();assert.equal(data.resultados[0].erro,null);assert.deepEqual(data.resultados[0].ontologia.teorias_e_modelos,[]);assert.equal((await ontologia(req({itens:[item,item]}))).status,400);assert.equal((await ontologia(req({itens:[{titulo:'Título',resumo:'Resumo'}]}))).status,400);},async()=>Response.json({candidates:[{content:{parts:[{text:'{"teorias_e_modelos":[],"ferramentas_e_artefatos":[],"metodos_e_tecnicas":[],"evidencias":[]}'}]}}]}));
});
test('chat endpoint validates limits and returns the terminal-aware protocol',async()=>{
 const dossie={nomePrograma:'TCC A',totalDocumentos:1,lideresVolume:[],pontesInterdisciplinares:[],principaisConceitos:[],docentes:[],catalogo:[]};
 await mock(async()=>{assert.equal((await chat(req({mensagens:[{role:'user',content:'x'.repeat(24001)}],dossie}))).status,400);const r=await chat(req({mensagens:[{role:'user',content:'Pergunta'}],dossie}));assert.match(r.headers.get('content-type')!,/x-ndjson/);assert.match(await r.text(),/"tipo":"fim"/);},async()=>new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Resposta'}]},finishReason:'STOP'}]})));
});
