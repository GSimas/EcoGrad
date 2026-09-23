import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validarEvidencias, hashResumo } from '../src/lib/ia-evidencias';
import { recuperarIA, iaVazia } from '../src/lib/ia-state';
import { encode, decode } from '../src/lib/session-codec';
import { gerarSintese, iniciarExtracao } from '../src/services/ia';
import type { Documento } from '../src/types';
import { useEcoGradStore as store } from '../src/stores/useEcoGradStore';
import ontologia from '../netlify/functions/gemini-ontology';
import sintese from '../netlify/functions/gemini-synthesize';
const resumo='Aplicamos análise de variância para comparar os grupos.';
const onto={teorias_e_modelos:[],ferramentas_e_artefatos:[],metodos_e_tecnicas:['ANOVA']};
const evidence=[{categoria:'metodos_e_tecnicas' as const,termo:'ANOVA',trecho:resumo}];
const req=(body:unknown)=>new Request('http://localhost/api',{method:'POST',body:JSON.stringify(body)});

test('every term requires one literal excerpt from its own summary, with exact category and label',()=>{
 assert.deepEqual(validarEvidencias(onto,evidence,resumo),evidence);
 for(const bad of [undefined,[],[...evidence,...evidence],[{...evidence[0],trecho:'Texto que não consta do resumo.'}],[{...evidence[0],termo:'anova'}],[{...evidence[0],categoria:'teorias_e_modelos'}]]) assert.throws(()=>validarEvidencias(onto,bad,resumo));
 assert.throws(()=>validarEvidencias({...onto,metodos_e_tecnicas:['ANOVA','ANOVA']},evidence,resumo));
 assert.deepEqual(validarEvidencias({...onto,metodos_e_tecnicas:[]},[],resumo),[]);
});

test('endpoint validates actual provider excerpts and binds them to exact input summary and ID',async()=>{
 const original=fetch,key=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY='fake-test';
 let response:unknown={...onto,evidencias:evidence},sent='',url='';
 globalThis.fetch=async(u,options)=>{url=String(u);sent=String(options?.body);return Response.json({choices:[{message:{content:JSON.stringify(response)}}]});};
 try {
  const item={id:'doc-v1-'+'c'.repeat(64),titulo:'Método exclusivo do título: Voisin',resumo};
  const success=await (await ontologia(req({itens:[item]}))).json();
  assert.equal(success.resultados[0].id,item.id);assert.deepEqual(success.resultados[0].evidencias,evidence);assert.equal(success.resultados[0].resumoSha256,await hashResumo(resumo));assert.ok(!sent.includes(item.titulo));assert.ok(!sent.includes(item.id));
  assert.equal(url,'https://api.deepseek.com/v1/chat/completions');const corpo=JSON.parse(sent);assert.deepEqual(corpo.response_format,{type:'json_object'});assert.deepEqual(corpo.thinking,{type:'disabled'});assert.equal(corpo.messages[0].role,'user');
  response={...onto,evidencias:[{...evidence[0],trecho:'Citação inventada, ausente no resumo.'}]};
  const bad=await (await ontologia(req({itens:[item]}))).json();assert.equal(bad.processados,0);assert.equal(bad.resultados[0].ontologia,null);assert.match(bad.resultados[0].erro,/literal/);
 } finally {globalThis.fetch=original;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;}
});

test('synthesis scope is deterministic even when provider omits it, and invalid counts fail',async()=>{
 const original=fetch,key=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY='fake-test';
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:'A pesquisa aborda energia.'}}]});
 try {
  const body={nomesProgramas:['A'],amostraTextos:'Título: Energia',recorte:{quantidade:1,total:264,salto:10,truncada:true}};
  const r=await (await sintese(req(body))).json();assert.match(r.descritivo,/^Síntese restrita a até 1 de 264 registros/);assert.match(r.escopo,/com corte de texto/);
  assert.equal((await sintese(req({...body,recorte:{...body.recorte,total:0}}))).status,400);
 } finally {globalThis.fetch=original;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;}
});

test('failed synthesis keeps the successful text, scope and input together',async()=>{
 store.setState({analysisId:crypto.randomUUID(),ia:iaVazia()});const original=fetch;
 try {
  globalThis.fetch=async()=>Response.json({descritivo:'Texto A',escopo:'Escopo A'});await gerarSintese('s',['A'],'amostra A');
  globalThis.fetch=async()=>Response.json({error:'Falhou'},{status:503});await gerarSintese('s',['B'],'amostra B');
  const saved=store.getState().ia.sinteses.s;assert.equal(saved.texto,'Texto A');assert.equal(saved.amostra,'amostra A');assert.equal(saved.escopo,'Escopo A');assert.deepEqual(saved.programas,['A']);
 } finally {globalThis.fetch=original;}
});

test('evidence and source snapshots survive serialization and manual recovery; legacy results remain intact',async()=>{
 const state=iaVazia();const fonte={titulo:'Título',url:'https://repositorio.ufsc.br/handle/1/2',resumo,resumoSha256:await hashResumo(resumo)};
 state.lote={baseVersion:'v1',estado:'executando',itens:[{id:'a',titulo:'Título',estado:'concluido',ontologia:onto,evidencias:evidence,fonte},{id:'b',titulo:'Legado',estado:'concluido',ontologia:onto},{id:'c',titulo:'Pendente',estado:'executando'}]};
 const recovered=recuperarIA(decode(encode(state)) as typeof state);
 assert.deepEqual(recovered.lote?.itens[0],state.lote.itens[0]);assert.deepEqual(recovered.lote?.itens[1],state.lote.itens[1]);assert.equal(recovered.lote?.itens[2].estado,'pendente');
});

test('client rejects evidence attached to a different summary even with a matching document ID',async()=>{
 const original=fetch;
 store.setState({analysisId:crypto.randomUUID(),baseVersion:'v1',ia:iaVazia(),docs:[{titulo:'A',programa_origem:'A',url:'https://repositorio.ufsc.br/handle/1/2',resumo,autores:[],co_orientadores:[],palavras_chave:[],orientador:'',ano:2020,nivel_academico:'',macrotema:''} as Documento]});
 globalThis.fetch=async(_url,options)=>{const item=JSON.parse(String(options?.body)).itens[0];return Response.json({resultados:[{id:item.id,ontologia:onto,evidencias:evidence,resumoSha256:await hashResumo('Outro resumo')} ]});};
 try {await iniciarExtracao(1);assert.equal(store.getState().ia.lote?.itens[0].estado,'erro');assert.match(store.getState().ia.lote?.itens[0].erro??'',/outro resumo/);assert.equal(store.getState().docs[0].ontologia_ia,undefined);}
 finally{globalThis.fetch=original;}
});
