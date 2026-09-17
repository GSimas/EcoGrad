import type { ChatMessage, Documento } from '../types';
export const LIMITE_MENSAGEM=8000;
export const LIMITE_HISTORICO=24000;
export function historicoEnviado(mensagens:readonly ChatMessage[]) {
  const saida:ChatMessage[]=[];let caracteres=0;
  for(const m of [...mensagens].reverse()){if(saida.length>=20 || caracteres+m.content.length>LIMITE_HISTORICO) break;saida.unshift(m);caracteres+=m.content.length;}
  while(saida[0]?.role==='assistant')saida.shift();
  return saida;
}
/**
 * A conversa da tela inicial virada histórico do painel flutuante.
 *
 * Vai antes das mensagens do próprio painel, e não entra em `chat.mensagens`:
 * o painel a mostra à parte, e reenviá-la como se fosse dele duplicaria a
 * conversa na tela. O aviso de que essas respostas cobrem outro recorte está
 * no prompt de sistema, onde o modelo não pode confundi-lo com fala do usuário.
 */
export function herdadoDaTelaInicial(turnos:readonly {pergunta:string;resposta:string}[]):ChatMessage[] {
  return turnos.flatMap((t)=>[{role:'user' as const,content:t.pergunta},{role:'assistant' as const,content:t.resposta}]);
}
/** Preserve the existing evenly spaced sample, while exposing the exact server character cut. */
export function amostraSintese(docs:readonly Documento[]) {
  const linhas:string[]=[];const salto=Math.max(1,Math.floor(docs.length/25));
  for(let i=0;i<docs.length&&linhas.length<25;i+=salto)linhas.push(`- ${docs[i].titulo} | ${docs[i].palavras_chave.join(', ')}`);
  const completo=linhas.join('\n');return {texto:completo.slice(0,20000),quantidade:linhas.length,salto,truncada:completo.length>20000,total:docs.length};
}
