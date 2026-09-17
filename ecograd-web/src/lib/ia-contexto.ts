import type { ChatMessage, Documento } from '../types';
export const LIMITE_MENSAGEM=8000;
export const LIMITE_HISTORICO=24000;
export function historicoEnviado(mensagens:readonly ChatMessage[]) {
  const saida:ChatMessage[]=[];let caracteres=0;
  for(const m of [...mensagens].reverse()){if(saida.length>=20 || caracteres+m.content.length>LIMITE_HISTORICO) break;saida.unshift(m);caracteres+=m.content.length;}
  while(saida[0]?.role==='assistant')saida.shift();
  return saida;
}
/** Preserve the existing evenly spaced sample, while exposing the exact server character cut. */
export function amostraSintese(docs:readonly Documento[]) {
  const linhas:string[]=[];const salto=Math.max(1,Math.floor(docs.length/25));
  for(let i=0;i<docs.length&&linhas.length<25;i+=salto)linhas.push(`- ${docs[i].titulo} | ${docs[i].palavras_chave.join(', ')}`);
  const completo=linhas.join('\n');return {texto:completo.slice(0,20000),quantidade:linhas.length,salto,truncada:completo.length>20000,total:docs.length};
}
