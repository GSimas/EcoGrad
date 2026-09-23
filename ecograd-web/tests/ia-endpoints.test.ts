import assert from 'node:assert/strict';
import {test} from 'node:test';
import sintetizar from '../netlify/functions/gemini-synthesize';
import ontologia from '../netlify/functions/gemini-ontology';
const req=(body:unknown,signal?:AbortSignal)=>new Request('http://localhost/api',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'},signal});
const mock=async(run:()=>Promise<void>,fetcher:typeof fetch)=>{const f=globalThis.fetch,k=process.env.DEEPSEEK_API_KEY;globalThis.fetch=fetcher;process.env.DEEPSEEK_API_KEY='fake-test-key';try{await run();}finally{globalThis.fetch=f;if(k===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=k;}};
test('synthesis endpoint uses explicit bounded sample and returns a real failure status',async()=>{
 let sent='';await mock(async()=>{const r=await sintetizar(req({nomesProgramas:['A'],amostraTextos:'Amostra'}));assert.equal(r.status,200);assert.match(sent,/apenas nesta amostra/);},async(_u,o)=>{sent=String(o?.body);return Response.json({choices:[{message:{content:'Síntese da amostra'}}]});});
 const controller=new AbortController();await mock(async()=>{const r=await sintetizar(req({nomesProgramas:['A'],amostraTextos:'Amostra'},controller.signal));assert.equal(r.status,502);assert.ok((await r.json()).error);},async()=>{controller.abort();throw new Error('Falha simulada');});
});
test('ontology endpoint echoes exact identity and marks malformed model JSON as failed',async()=>{
 const item={id:'doc-v1-'+'a'.repeat(64),titulo:'Mesmo título',resumo:'Resumo'};
 await mock(async()=>{const r=await ontologia(req({itens:[item],delayMs:0}));const data=await r.json();assert.equal(data.resultados[0].id,item.id);assert.equal(data.resultados[0].ontologia,null);assert.ok(data.resultados[0].erro);},async()=>Response.json({choices:[{message:{content:'{}'}}]}));
});
test('ontology accepts valid empty lists, rejects missing or duplicate IDs and never matches titles',async()=>{
 const item={id:'doc-v1-'+'b'.repeat(64),titulo:'Título',resumo:'Resumo'};
 await mock(async()=>{const r=await ontologia(req({itens:[item],delayMs:0}));const data=await r.json();assert.equal(data.resultados[0].erro,null);assert.deepEqual(data.resultados[0].ontologia.teorias_e_modelos,[]);assert.equal((await ontologia(req({itens:[item,item]}))).status,400);assert.equal((await ontologia(req({itens:[{titulo:'Título',resumo:'Resumo'}]}))).status,400);},async()=>Response.json({choices:[{message:{content:'{"teorias_e_modelos":[],"ferramentas_e_artefatos":[],"metodos_e_tecnicas":[],"evidencias":[]}'}}]}));
});
