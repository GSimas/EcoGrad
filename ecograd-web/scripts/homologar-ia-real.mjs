// Explicit execution only: sends public repository metadata to local Gemini functions.
// Does not apply results to the scientific base or read API keys.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root = new URL('../../', import.meta.url);
const out = new URL(process.argv.includes('--bloco14') ? 'docs/evidencias/ia-semantica/ia-real.json' : 'docs/evidencias/homologacao/ia-real.json', root);
if (!process.argv.includes('--executar')) throw new Error('Use --executar: até 4 pedidos locais (6 com --bloco14), com retries/fallback do servidor e possível consumo de quota.');
const base = JSON.parse(gunzipSync(await readFile(new URL('base_consolidada_ufsc.json.gz', root))).toString('utf8'));
const d = base.find(d => d.programa_origem === 'Ecologia' && d.url?.startsWith('https://repositorio.ufsc.br/') && d.resumo?.length > 200 && typeof d.orientador === 'string' && Array.isArray(d.autores)) ?? base.find(d => d.url?.startsWith('https://repositorio.ufsc.br/') && d.resumo?.length > 200 && typeof d.orientador === 'string' && Array.isArray(d.autores));
if (!d) throw new Error('Amostra pública com fonte e resumo não encontrada.');
const id = 'doc-v1-' + createHash('sha256').update(JSON.stringify(['fonte',d.programa_origem,d.url])).digest('hex');
const report = {data:new Date().toISOString(), origem:'http://localhost:8888', escopo:'Smoke de endpoints locais reais; não valida UI, custo nem produção', amostra:{id,titulo:d.titulo,url:d.url,programa:d.programa_origem,resumo:d.resumo,palavras_chave:d.palavras_chave}, execucoes:[]};
const clean = s => s.replace(/AIza[\w-]+/g,'[SEGREDO REMOVIDO]');
async function run(endpoint, payload, cancel=false) {
 const start=performance.now(), controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),65000);
 const entry={endpoint,cancelamentoSolicitado:cancel,entrada:payload};
 try {
  const r=await fetch(`http://localhost:8888/api/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
  entry.status=r.status; entry.contentType=r.headers.get('content-type');entry.cabecalhosMs=Math.round(performance.now()-start);
  let body='';const reader=r.body.getReader(); const decoder=new TextDecoder();let first=true;
  while(true){const p=await reader.read();if(p.done)break;if(first){entry.primeiroChunkMs=Math.round(performance.now()-start);first=false;}body+=decoder.decode(p.value,{stream:true});if(cancel&&body.includes('"tipo":"texto"')){controller.abort();entry.canceladoAposTexto=true;break;}}
  body+=decoder.decode();entry.resposta=clean(body);
 }catch(e){entry.erro=clean(e.message);}
 finally{clearTimeout(timer);entry.totalMs=Math.round(performance.now()-start);report.execucoes.push(entry);await mkdir(new URL('.',out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(endpoint,entry.status??entry.erro,entry.totalMs+'ms');}
 return entry;
}
const dossie={nomePrograma:d.programa_origem,totalDocumentos:1,lideresVolume:[],pontesInterdisciplinares:[],principaisConceitos:d.palavras_chave??[],docentes:[],catalogo:[{titulo:d.titulo,autores:d.autores,orientador:d.orientador,macrotema:d.macrotema??'',conceitos:d.palavras_chave??[],url:d.url}]};
const chat={mensagens:[{role:'user',content:'Indique o único trabalho do catálogo com título e link exatos. Explique os limites deste recorte e se permite afirmar disponibilidade atual de orientação.'}],dossie};
const first=await run('gemini-chat',chat);
if(first.status===200&&first.resposta?.includes('"tipo":"fim"')) {
 await run('gemini-synthesize',{nomesProgramas:[d.programa_origem],recorte:{quantidade:1,total:1,salto:1,truncada:false},amostraTextos:`Título: ${d.titulo}\nPalavras-chave: ${(d.palavras_chave??[]).join(', ')}`});
 await run('gemini-ontology',{itens:[{id,titulo:d.titulo,resumo:d.resumo}]});
 if(process.argv.includes('--bloco14')) {
  const extras=[base.find(x=>typeof x.resumo==='string'&&/análise de variância|análise de variancia|ANOVA/.test(x.resumo)&&x.url?.startsWith('https://repositorio.ufsc.br/')),base.find(x=>x.titulo==='Boletim Informativo do PGA'&&x.resumo?.length>200&&x.url?.startsWith('https://repositorio.ufsc.br/'))];
  for(const x of extras){if(!x)throw new Error('Amostra adicional pública ausente.');const xid='doc-v1-'+createHash('sha256').update(JSON.stringify(['fonte',x.programa_origem,x.url])).digest('hex');report.amostrasAdicionais??=[];report.amostrasAdicionais.push({id:xid,titulo:x.titulo,url:x.url,resumo:x.resumo});await run('gemini-ontology',{itens:[{id:xid,titulo:x.titulo,resumo:x.resumo}]});}
 }
 await run('gemini-chat',{...chat,mensagens:[{role:'user',content:'Explique detalhadamente os limites do catálogo recebido em 15 parágrafos.'}]},true);
} else {console.log('Interrompido após falha inicial; não consumir quota com os demais casos.');process.exitCode=1;}
