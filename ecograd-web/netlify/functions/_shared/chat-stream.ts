/** Translate Gemini SSE into a protocol with an explicit successful terminal event. */
export function respostaChat(upstream:Response,signal:AbortSignal):Response {
 const reader=upstream.body!.getReader();let cancelado=false;
 const decoder=new TextDecoder(),encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   let buffer='',confirmado=false,recebeuTexto=false;
   const emitir=(v:unknown)=>{if(!cancelado)controller.enqueue(encoder.encode(JSON.stringify(v)+'\n'));};
   const linha=(l:string)=>{
    if(!l.startsWith('data:'))return;const raw=l.slice(5).trim();if(!raw||raw==='[DONE]')return;
    const e=JSON.parse(raw);if(e.error||e.promptFeedback?.blockReason)throw new Error('O provedor não concluiu esta resposta.');
    const candidato=e.candidates?.[0];for(const p of candidato?.content?.parts??[]){if(typeof p.text==='string'&&p.text){recebeuTexto=true;emitir({tipo:'texto',texto:p.text});}}
    if(candidato?.finishReason){if(candidato.finishReason==='STOP')confirmado=true;else throw new Error(`Resposta parcial: finalização ${candidato.finishReason}.`);}
   };
   const abort=()=>{void reader.cancel();};signal.addEventListener('abort',abort,{once:true});
   try{
    for(;;){signal.throwIfAborted();const r=await reader.read();if(r.done)break;buffer+=decoder.decode(r.value,{stream:true});const linhas=buffer.split('\n');buffer=linhas.pop()??'';for(const l of linhas)linha(l);}
    buffer+=decoder.decode();if(buffer.trim())linha(buffer);signal.throwIfAborted();
    if(!confirmado||!recebeuTexto)throw new Error('A resposta terminou sem confirmação de conclusão ou sem texto.');emitir({tipo:'fim'});
   }catch(e){emitir({tipo:'erro',mensagem:e instanceof Error?e.message:'Falha durante a resposta.'});}
   finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();if(!cancelado)controller.close();}
  },
  cancel(){cancelado=true;return reader.cancel();},
 });
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
