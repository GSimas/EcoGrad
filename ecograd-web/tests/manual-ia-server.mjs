import { createHash } from 'node:crypto';
// Local-only UI fixture: serves the production build and simulates AI responses.
// Run from repository root: node ecograd-web/tests/manual-ia-server.mjs
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const port=Number(process.env.ECO_FIXTURE_PORT??8891);
const failChart=process.env.ECO_FIXTURE_FAIL_CHART==='1';
const root=resolve('ecograd-web/dist');let chatCalls=0,synthCalls=0,ontologyCalls=0;
const server=http.createServer(async(req,res)=>{
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 res.setHeader('X-EcoGrad-Fixture','simulated-ai');
 if(failChart && /\/assets\/echarts-.*\.js$/.test(path)){res.writeHead(503).end('Simulated chart load failure');return;}
 if(path==='/api/gemini-chat'){
  let raw='';for await(const c of req)raw+=c;const payload=JSON.parse(raw);chatCalls++;const call=chatCalls;
  res.writeHead(200,{'Content-Type':'application/x-ndjson'});
  res.write(JSON.stringify({tipo:'texto',texto:'Resposta simulada para validação. '})+'\n');
  const delay=payload.mensagens.at(-1)?.content.includes('lenta')?15000:400;
  setTimeout(()=>{if(res.destroyed)return;if(call===1)res.end(JSON.stringify({tipo:'erro',mensagem:'Interrupção simulada do provedor.'})+'\n');else res.end(JSON.stringify({tipo:'texto',texto:'Consulte os trabalhos e suas fontes.'})+'\n'+JSON.stringify({tipo:'fim'})+'\n');},delay);return;
 }
 if(path==='/api/gemini-synthesize'){
  for await(const _c of req){}synthCalls++;const call=synthCalls;
  setTimeout(()=>{if(res.destroyed)return;res.writeHead(call===2?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify(call===2?{error:'Falha temporária simulada na síntese.'}:{descritivo:'Síntese simulada da amostra de títulos e palavras-chave; confira a produção nas fontes.'}));},call===3?15000:400);return;
 }
 if(path==='/api/gemini-ontology'){
  let raw='';for await(const c of req)raw+=c;const item=JSON.parse(raw).itens[0];ontologyCalls++;const call=ontologyCalls;
  setTimeout(()=>{if(res.destroyed)return;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({resultados:[{id:item.id,titulo:item.titulo,ontologia:call===2?null:{teorias_e_modelos:['Teoria, simulada'],ferramentas_e_artefatos:['Ferramenta simulada'],metodos_e_tecnicas:[]},evidencias:[{categoria:'teorias_e_modelos',termo:'Teoria, simulada',trecho:item.resumo.slice(0,200)},{categoria:'ferramentas_e_artefatos',termo:'Ferramenta simulada',trecho:item.resumo.slice(0,200)}],resumoSha256:createHash('sha256').update(item.resumo).digest('hex'),erro:call===2?'Falha simulada neste documento':null}]}));},call===3?15000:400);return;
 }
 if(path.startsWith('/api/')){const r=await fetch('http://localhost:8888'+req.url);res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')??'application/json'});res.end(Buffer.from(await r.arrayBuffer()));return;}
 const file=resolve(root,'.'+path);if(file!==root&&!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 const target=extname(file)?file:resolve(root,'index.html');let data;try{data=await readFile(target);}catch{res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.gz':'application/gzip','.png':'image/png','.svg':'image/svg+xml'})[extname(target)]??'application/octet-stream'});res.end(data);
 }catch{res.writeHead(500).end('Fixture error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Fixture IA local: http://127.0.0.1:${port} — respostas simuladas, sem Gemini${failChart?' — falha de gráfico simulada':''}`));
