import assert from 'node:assert/strict';
import { test } from 'node:test';
import { propostas, registrarDecisao, resultadoCurado, type DecisaoTermo } from '../src/lib/curadoria';
import { decidirTermo, aplicarCuradoria } from '../src/services/curadoria';
import { hashResumo } from '../src/lib/ia-evidencias';
import { identidadeDocumento } from '../src/lib/ontologia-importacao';
import { iaVazia, recuperarIA, type ItemExtracao } from '../src/lib/ia-state';
import { encode, decode } from '../src/lib/session-codec';
import { useEcoGradStore as store } from '../src/stores/useEcoGradStore';
import type { Documento } from '../src/types';

const resumo='Usamos análise de variância e teste Tukey para comparar os grupos.';
const doc:Documento={titulo:'Mesmo título',programa_origem:'A',url:'https://repositorio.ufsc.br/handle/1/2',resumo,autores:[],co_orientadores:[],orientador:'',ano:2020,nivel_academico:'',macrotema:'',palavras_chave:[]};
const onto={teorias_e_modelos:[],ferramentas_e_artefatos:[],metodos_e_tecnicas:['análise de variância','tema genérico']};
const makeItem=async():Promise<ItemExtracao>=>({id:await identidadeDocumento(doc),titulo:doc.titulo,estado:'concluido',ontologia:structuredClone(onto),fonte:{titulo:doc.titulo,url:doc.url,resumo,resumoSha256:await hashResumo(resumo)},evidencias:[{categoria:'metodos_e_tecnicas',termo:'análise de variância',trecho:resumo},{categoria:'metodos_e_tecnicas',termo:'tema genérico',trecho:resumo}]});
const decision=(estado:'aprovado'|'rejeitado',termo='ANOVA'):DecisaoTermo=>({estado,termo,categoria:'metodos_e_tecnicas',trecho:resumo,justificativa:estado==='aprovado'?'Sigla do método explicitamente utilizado.':'É um tema, não método do estudo.',quando:'2026-09-12T23:00:00.000Z'});
async function init() {
 const item=await makeItem();store.setState({analysisId:crypto.randomUUID(),baseVersion:'v1',docs:[structuredClone(doc)],ia:{...iaVazia(),lote:{revisaoId:'teste',baseVersion:'v1',estado:'concluido',itens:[item]}},ui:{}});return item;
}
const guard=()=>{};

test('new and legacy proposals default to pending, never automatically approved',async()=>{
 const item=await makeItem();assert.equal(resultadoCurado(item).aprovados,0);assert.equal(resultadoCurado(item).pendentes,2);
 delete item.fonte;delete item.evidencias;assert.equal(resultadoCurado(item).pendentes,2);
});
test('correction preserves original proposal and evidence; rejection excludes term',async()=>{
 const item=await makeItem(),before=encode(item),keys=propostas(item);
 let updated=registrarDecisao(item,keys[0].chave,decision('aprovado'));
 updated=registrarDecisao(updated,keys[1].chave,decision('rejeitado','tema genérico'));
 assert.equal(encode(item),before);assert.deepEqual(updated.ontologia,item.ontologia);assert.deepEqual(updated.evidencias,item.evidencias);
 assert.deepEqual(resultadoCurado(updated),{ontologia:{...onto,metodos_e_tecnicas:['ANOVA']},aprovados:1,rejeitados:1,pendentes:0});
});
test('approval requires literal support and all decisions require justification',async()=>{
 const item=await makeItem(),key=propostas(item)[0].chave;
 assert.throws(()=>registrarDecisao(item,key,{...decision('aprovado'),trecho:'Uma citação inventada.'}),/literal/);
 for(const estado of ['aprovado','rejeitado'] as const)assert.throws(()=>registrarDecisao(item,key,{...decision(estado),justificativa:' '}),/justificativa/);
 assert.throws(()=>registrarDecisao(item,'wrong',decision('aprovado')),/não encontrada/);
});
test('history is append-only, last decision wins, corrected duplicate terms are blocked',async()=>{
 let item=await makeItem();const keys=propostas(item);
 item=registrarDecisao(item,keys[0].chave,decision('aprovado'));
 assert.throws(()=>registrarDecisao(item,keys[1].chave,decision('aprovado')),/mesmo termo/);
 item=registrarDecisao(item,keys[0].chave,decision('rejeitado'));
 assert.equal(item.curadoria?.termos[keys[0].chave].length,2);assert.equal(resultadoCurado(item).aprovados,0);
});
test('application blocks pending terms then applies only approved corrections by exact ID',async()=>{
 const item=await init(),keys=propostas(item),idBefore=await identidadeDocumento(store.getState().docs[0]);
 await decidirTermo(item.id,keys[0].chave,decision('aprovado'));
 await assert.rejects(aplicarCuradoria(guard),/todos os termos/);assert.equal(store.getState().docs[0].ontologia_ia,undefined);
 await decidirTermo(item.id,keys[1].chave,decision('rejeitado','tema genérico'));
 assert.equal(await aplicarCuradoria(guard),1);
 assert.deepEqual(store.getState().docs[0].ontologia_ia,{...onto,metodos_e_tecnicas:['ANOVA']});assert.equal(await identidadeDocumento(store.getState().docs[0]),idBefore);
 assert.equal(store.getState().ia.lote?.aplicado,true);assert.deepEqual(store.getState().ia.lote?.itens[0].ontologia,onto);
 await assert.rejects(decidirTermo(item.id,keys[0].chave,decision('rejeitado')),/indisponível/);
});
test('all rejected means no enrichment, not empty ontology',async()=>{
 const item=await init();for(const p of propostas(item))await decidirTermo(item.id,p.chave,decision('rejeitado',p.termo));
 await assert.rejects(aplicarCuradoria(guard),/Nenhum termo/);assert.equal(store.getState().docs[0].ontologia_ia,undefined);
});
test('review history and pending terms survive session codec and recovery',async()=>{
 const item=await init();await decidirTermo(item.id,propostas(item)[0].chave,decision('aprovado'));
 const saved=store.getState().ia,restored=recuperarIA(decode(encode(saved)) as typeof saved);
 assert.deepEqual(restored,saved);assert.equal(resultadoCurado(restored.lote!.itens[0]).pendentes,1);
});
test('changed summary, duplicate IDs, stale base and concurrent revision cannot alter documents',async()=>{
 let item=await init();store.setState({docs:[{...doc,resumo:'Resumo alterado'}]});await assert.rejects(decidirTermo(item.id,propostas(item)[0].chave,decision('aprovado')),/fonte mudou/);
 item=await init();store.setState({docs:[doc,{...doc}]});await assert.rejects(decidirTermo(item.id,propostas(item)[0].chave,decision('aprovado')),/ambígua/);
 item=await init();for(const [i,p] of propostas(item).entries())await decidirTermo(item.id,p.chave,decision(i===0?'aprovado':'rejeitado',i===0?'ANOVA':p.termo));
 const before=store.getState().docs;let calls=0;
 await assert.rejects(aplicarCuradoria(()=>{if(++calls===3){const lote=store.getState().ia.lote!;store.getState().setIA({lote:{...lote}});}}),/curadoria mudou/);
 assert.equal(store.getState().docs,before);
 store.setState({baseVersion:'v2'});await assert.rejects(aplicarCuradoria(guard),/indisponível/);
});
test('legacy evidence must be supplied by the curator; old approval flags do not invent decisions',async()=>{
 const item=await init();const lote=store.getState().ia.lote!;store.getState().setIA({lote:{...lote,itens:[{...item,fonte:undefined,evidencias:undefined}]}});
 await decidirTermo(item.id,propostas(item)[0].chave,decision('aprovado'));
 const saved=store.getState().ia.lote!.itens[0];assert.equal(saved.fonte?.resumo,resumo);assert.equal(saved.evidencias,undefined);assert.equal(resultadoCurado(saved).pendentes,1);
});
