import type { EvidenciaIA, FonteExtracao } from './ia-evidencias';
import type { Curadoria } from './curadoria';
import type { OntologiaIA } from '../types';
import type { PreviaImportacao } from './ontologia-importacao';
export interface ItemExtracao { id:string; titulo:string; estado:'pendente'|'executando'|'concluido'|'erro'; ontologia?:OntologiaIA; evidencias?:EvidenciaIA[]; fonte?:FonteExtracao; curadoria?:Curadoria; erro?:string }
export interface LoteExtracao { revisaoId?:string; baseVersion:string; itens:ItemExtracao[]; estado:'executando'|'interrompido'|'concluido'; aplicado?:boolean }
export interface SinteseIA { texto:string; estado:'executando'|'interrompida'|'concluida'|'erro'; erro?:string; amostra:string; programas:string[]; escopo?:string }
export interface EstadoIA { lote:LoteExtracao|null; importacao:PreviaImportacao|null; sinteses:Record<string,SinteseIA> }
export const iaVazia=():EstadoIA=>({lote:null,importacao:null,sinteses:{}});
export function recuperarIA(ia:EstadoIA):EstadoIA {
  return {...ia,lote:ia.lote?{...ia.lote,estado:ia.lote.estado==='executando'?'interrompido':ia.lote.estado,itens:ia.lote.itens.map(i=>i.estado==='executando'?{...i,estado:'pendente'}:i)}:null,sinteses:Object.fromEntries(Object.entries(ia.sinteses).map(([id,s])=>[id,s.estado==='executando'?{...s,estado:'interrompida',erro:'Interrompida ao recarregar. Gere novamente quando desejar.'}:s]))};
}
