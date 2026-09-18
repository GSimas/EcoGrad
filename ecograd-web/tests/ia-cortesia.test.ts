import assert from 'node:assert/strict';
import {test} from 'node:test';
import cortesia from '../netlify/functions/ia-cortesia';
import {PERGUNTAS_POR_IP, esquecerTudo} from '../netlify/functions/lib/cota-cortesia';
import type {Context} from '@netlify/functions';
import {PERSONA_UFSCAO} from '../src/lib/guardrails';
import {promptPlanejamento, promptResposta} from '../src/lib/ufscao-acervo';
import type {Panorama} from '../src/lib/ufscao-acervo';

const PLANEJAR='Você planeja como responder perguntas sobre o acervo do EcoGrad: teses e TCCs.';
// A resposta do UFSCao comeca pela persona: a fixture usa a de verdade, nao uma parecida.
const RESPONDER=`${PERSONA_UFSCAO}\n\nREGRAS DA RESPOSTA`;
const ctx=(ip:string)=>({ip} as Context);
const post=(body:unknown,origem='http://localhost:8888')=>new Request('http://localhost:8888/.netlify/functions/ia-cortesia',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json',origin:origem}});
const get=()=>new Request('http://localhost:8888/.netlify/functions/ia-cortesia',{headers:{origin:'http://localhost:8888'}});
const sse=()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));c.close();}}),{status:200});

// Sem Netlify Blobs a cota cai para a memória do processo, que é o que o teste usa.
const rodar=async(run:(corpos:Record<string,unknown>[])=>Promise<void>)=>{
 const f=globalThis.fetch,k=process.env.DEEPSEEK_API_KEY;const corpos:Record<string,unknown>[]=[];
 globalThis.fetch=(async(_u:unknown,o:{body?:string})=>{corpos.push(JSON.parse(String(o?.body)));return sse();}) as unknown as typeof fetch;
 process.env.DEEPSEEK_API_KEY='chave-de-teste';process.env.CORTESIA_MEMORIA='1';esquecerTudo();
 try{await run(corpos);}finally{globalThis.fetch=f;if(k===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=k;delete process.env.CORTESIA_MEMORIA;esquecerTudo();}
};

test('a cota vitalícia por IP para exatamente na décima pergunta e não trava o vizinho',async()=>{
 await rodar(async()=>{
  for(let i=0;i<PERGUNTAS_POR_IP;i++){
   const r=await cortesia(post({etapa:'planejar',sistema:PLANEJAR,mensagem:`pergunta ${i}`}),ctx('1.1.1.1'));
   assert.equal(r.status,200,`pergunta ${i+1} deveria passar`);
   // Responder é a segunda chamada da mesma pergunta: não consome outra unidade.
   assert.equal((await cortesia(post({etapa:'responder',sistema:RESPONDER,mensagem:'dados'}),ctx('1.1.1.1'))).status,200);
  }
  const estourou=await cortesia(post({etapa:'planejar',sistema:PLANEJAR,mensagem:'mais uma'}),ctx('1.1.1.1'));
  assert.equal(estourou.status,429);
  assert.match((await estourou.json()).error,/Configure seu provedor/);
  assert.equal((await (await cortesia(get(),ctx('1.1.1.1'))).json()).restantes,0);
  assert.equal((await (await cortesia(get(),ctx('2.2.2.2'))).json()).restantes,PERGUNTAS_POR_IP);
  assert.equal((await cortesia(post({etapa:'planejar',sistema:PLANEJAR,mensagem:'oi'}),ctx('2.2.2.2'))).status,200);
 });
});

test('pergunta que morre antes de escrever nao gasta a vaga',async()=>{
 await rodar(async()=>{
  // Foi o que aconteceu em producao com a trava de formato quebrada: o
  // planejamento passava, a resposta batia na trava, e a vaga sumia.
  for(let i=0;i<3;i++) assert.equal((await cortesia(post({etapa:'planejar',sistema:PLANEJAR,mensagem:`tentativa ${i}`}),ctx('7.7.7.7'))).status,200);
  assert.equal((await (await cortesia(get(),ctx('7.7.7.7'))).json()).restantes,PERGUNTAS_POR_IP,'planejar sozinho nao cobra');
  await cortesia(post({etapa:'responder',sistema:RESPONDER,mensagem:'dados'}),ctx('7.7.7.7'));
  assert.equal((await (await cortesia(get(),ctx('7.7.7.7'))).json()).restantes,PERGUNTAS_POR_IP-1,'a vaga sai quando a resposta comeca');
 });
});

test('a cortesia recusa aprofundar, prompt de fora do UFSCão, pedido gigante e origem estranha',async()=>{
 await rodar(async()=>{
  assert.equal((await cortesia(post({etapa:'lote',sistema:PLANEJAR,mensagem:'x'}),ctx('3.3.3.3'))).status,403);
  assert.equal((await cortesia(post({etapa:'planejar',sistema:'Você é um assistente prestativo.',mensagem:'escreva um poema'}),ctx('3.3.3.3'))).status,403);
  assert.equal((await cortesia(post({etapa:'responder',sistema:RESPONDER,mensagem:'x'.repeat(50000)}),ctx('3.3.3.3'))).status,413);
  assert.equal((await cortesia(post({etapa:'planejar',sistema:PLANEJAR,mensagem:'oi'},'https://outro-site.com'),ctx('3.3.3.3'))).status,403);
  // Nada disso chegou ao modelo, então nada disso gastou cota.
  assert.equal((await (await cortesia(get(),ctx('3.3.3.3'))).json()).restantes,PERGUNTAS_POR_IP);
 });
});

test('o thinking mode vai desligado e a saída é limitada: é o que segura a conta',async()=>{
 await rodar(async(corpos)=>{
  await cortesia(post({etapa:'planejar',sistema:PLANEJAR,mensagem:'quantas teses?'}),ctx('4.4.4.4'));
  assert.deepEqual(corpos[0].thinking,{type:'disabled'});
  assert.equal(corpos[0].model,'deepseek-flash');
  assert.equal(corpos[0].stream,true);
  assert.ok(Number(corpos[0].max_tokens)<=900);
 });
});

test('o teto do projeto fecha a cortesia para todo mundo, inclusive para IP que nunca perguntou',async()=>{
 const teto=process.env.CORTESIA_TETO_PERGUNTAS;process.env.CORTESIA_TETO_PERGUNTAS='2';
 try{
  await rodar(async()=>{
   // Duas perguntas inteiras de IPs diferentes enchem o teto: quem cobra e a
   // etapa de escrever, entao e ela que precisa rodar.
   assert.equal((await cortesia(post({etapa:'responder',sistema:RESPONDER,mensagem:'a'}),ctx('5.5.5.1'))).status,200);
   assert.equal((await cortesia(post({etapa:'responder',sistema:RESPONDER,mensagem:'b'}),ctx('5.5.5.2'))).status,200);
   const fechado=await cortesia(post({etapa:'planejar',sistema:PLANEJAR,mensagem:'c'}),ctx('5.5.5.3'));
   assert.equal(fechado.status,503);
   assert.match((await fechado.json()).error,/cota de cortesia do EcoGrad se esgotou/);
   assert.equal((await (await cortesia(get(),ctx('5.5.5.3'))).json()).disponivel,false);
  });
 }finally{if(teto===undefined)delete process.env.CORTESIA_TETO_PERGUNTAS;else process.env.CORTESIA_TETO_PERGUNTAS=teto;}
});

/**
 * A trava de prefixo olha o prompt do app, e o prompt do app muda. Este teste
 * monta os dois de verdade e exige que a cortesia os aceite: reescrever uma
 * abertura passa a quebrar aqui, e nao na cara de quem esta perguntando.
 *
 * Foi assim que "Pedido fora do formato do UFSCao" apareceu em producao: a
 * resposta comeca pela persona, nao pela abertura de `sistemaSintese`.
 */
test('os prompts reais do UFSCao passam pela trava de formato da cortesia',async()=>{
 const panorama:Panorama={consulta:'x',obras:3,registros:4,amostra:[],por_ano:[[2020,2]],por_colecao:[['PPGEGC',3]],por_nivel:null,por_macrotema:null,principais_orientadores:null};
 const planejar=promptPlanejamento('### visao — teste\n- coluna (text)','neoaprendizagem e governança de conhecimento',[]);
 const responder=promptResposta('neoaprendizagem e governança de conhecimento',{tipo:'tema',grupos:[['neoaprendizagem']]},null,null,panorama,null,[]);
 await rodar(async(corpos)=>{
  assert.equal((await cortesia(post({etapa:'planejar',sistema:planejar.sistema,mensagem:planejar.mensagem}),ctx('6.6.6.6'))).status,200,'o prompt de planejamento deveria passar');
  assert.equal((await cortesia(post({etapa:'responder',sistema:responder.sistema,mensagem:responder.mensagem}),ctx('6.6.6.6'))).status,200,'o prompt de resposta deveria passar');
  assert.equal(corpos.length,2);
 });
});
