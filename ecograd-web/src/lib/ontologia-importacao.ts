import { parseOntologia } from './foresight-math';
import type { Documento, OntologiaIA } from '../types';
export const COLUNAS_ONTOLOGIA = ['Teorias e Modelos', 'Ferramentas e Artefatos', 'Métodos e Técnicas'] as const;
export const CHAVES_ONTOLOGIA = ['teorias_e_modelos', 'ferramentas_e_artefatos', 'metodos_e_tecnicas'] as const;
export const MAX_ARQUIVO = 2 * 1024 * 1024;
export const MAX_LINHAS = 2000;
export const FORMATO_ONTOLOGIA = 'ecograd-ontologia-v1';
/** Source identity within its collection; fallback uses exact bibliographic metadata, never array position or ontology. */
export async function identidadeDocumento(d: Documento): Promise<string> {
  const identidade = d.url ? ['fonte', d.programa_origem, d.url] : ['metadados', d.programa_origem, d.titulo, d.ano, d.autores, d.orientador, d.co_orientadores];
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(identidade)));
  return 'doc-v1-' + [...new Uint8Array(bytes)].map((b)=>b.toString(16).padStart(2,'0')).join('');
}
export async function indexarDocumentos(docs: readonly Documento[]) {
  return Promise.all(docs.map(async(d,indice)=>({id:await identidadeDocumento(d),indice,documento:d})));
}
export function ontologiaValida(valor: unknown): valor is OntologiaIA {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  return CHAVES_ONTOLOGIA.every((chave)=>{
    const lista=(valor as Record<string,unknown>)[chave];
    return Array.isArray(lista) && lista.length<=100 && lista.every((v)=>typeof v==='string' && v.trim().length>0 && v.length<=500);
  });
}
export interface LinhaImportacao { linha:number; id:string; titulo:string; colecao:string; situacao:string; valida:boolean; substituir:boolean; ontologia:OntologiaIA|null }
export interface PreviaImportacao { arquivo:string; baseVersion:string; linhas:LinhaImportacao[]; legado:boolean; aplicada?:boolean }
export async function prepararImportacao(linhas:Record<string,string>[], campos:string[], docs: readonly Documento[], versao:string, arquivo:string):Promise<PreviaImportacao> {
  if(linhas.length>MAX_LINHAS) throw new Error(`Limite de ${MAX_LINHAS} linhas excedido.`);
  if(new Set(campos).size!==campos.length || !['Título',...COLUNAS_ONTOLOGIA].every(c=>campos.includes(c))) throw new Error('Cabeçalhos ausentes ou duplicados. Use o CSV para reimportação do catálogo.');
  const legado=!campos.includes('ID do documento');
  if(!legado && !['Formato','Versão da base','Coleção'].every(c=>campos.includes(c))) throw new Error('CSV com identidade exige Formato, Versão da base e Coleção.');
  const indice=await indexarDocumentos(docs);
  const ids=new Map<string,typeof indice>();const titulos=new Map<string,typeof indice>();
  for(const item of indice){ids.set(item.id,[...(ids.get(item.id)??[]),item]);titulos.set(item.documento.titulo,[...(titulos.get(item.documento.titulo)??[]),item]);}
  const saida=linhas.map((l,i):LinhaImportacao=>{
    const titulo=l['Título']??''; const candidatos=legado ? titulos.get(titulo)??[] : ids.get(l['ID do documento'])??[];
    const item=candidatos.length===1?candidatos[0]:null;
    let problema = !legado && l.Formato!==FORMATO_ONTOLOGIA ? 'Formato incompatível' : !legado && l['Versão da base']!==versao ? 'Versão da base diferente' : candidatos.length===0 ? 'Documento não encontrado' : candidatos.length>1 ? 'Identidade ambígua: múltiplos registros' : '';
    if(item && !legado && (item.documento.titulo!==titulo || item.documento.programa_origem!==l['Coleção'] || (campos.includes('URL') && item.documento.url!==l.URL))) problema='Metadados divergentes do documento identificado';
    let onto:OntologiaIA|null=null;
    try {
      onto=Object.fromEntries(COLUNAS_ONTOLOGIA.map((c,j)=>[CHAVES_ONTOLOGIA[j],legado ? String(l[c]??'').split(',').map(v=>v.trim()).filter(Boolean) : JSON.parse(l[c]??'')])) as unknown as OntologiaIA;
      if(!ontologiaValida(onto)) throw new Error();
    }catch{problema=problema||'Listas inválidas: use arrays JSON de textos no formato atual';onto=null;}
    const substituir=!!item?.documento.ontologia_ia;
    return {linha:i+2,id:item?.id??l['ID do documento']??'',titulo,colecao:item?.documento.programa_origem??l['Coleção']??'',situacao:problema||(substituir?'Substitui ontologia existente':'Novo enriquecimento'),valida:!problema,substituir,ontologia:onto};
  });
  const contagem=new Map<string,number>();for(const l of saida)if(l.id)contagem.set(l.id,(contagem.get(l.id)??0)+1);
  for(const l of saida)if(l.id && contagem.get(l.id)!>1){l.valida=false;l.situacao='Documento repetido no arquivo; remova a duplicata';}
  return {arquivo,baseVersion:versao,linhas:saida,legado};
}
export async function linhasExportacaoOntologia(docs:readonly Documento[],versao:string) {
  const index=await indexarDocumentos(docs.map(d=>({...d,ontologia_ia:parseOntologia(d.ontologia_ia)??undefined})));
  return index.filter(x=>ontologiaValida(x.documento.ontologia_ia)).map(({id,documento:d})=>({
    Formato:FORMATO_ONTOLOGIA,'Versão da base':versao,'ID do documento':id,'Título':d.titulo,'Coleção':d.programa_origem,URL:d.url,Ano:d.ano??'',
    ...Object.fromEntries(COLUNAS_ONTOLOGIA.map((c,i)=>[c,JSON.stringify((d.ontologia_ia as OntologiaIA)[CHAVES_ONTOLOGIA[i]])])),
  }));
}
/** Reject ambiguity again at application time, including changes made since preview. */
export async function aplicarPorIdentidade(docs:readonly Documento[],porId:Map<string,OntologiaIA>,substituir=false) {
  const index=await indexarDocumentos(docs);const counts=new Map<string,number>();for(const x of index)counts.set(x.id,(counts.get(x.id)??0)+1);
  let atualizados=0;
  const proximos=index.map(({id,documento})=>{const onto=porId.get(id);if(counts.get(id)!==1||!ontologiaValida(onto)||(!substituir&&!!parseOntologia(documento.ontologia_ia)))return documento;atualizados++;return {...documento,ontologia_ia:onto};});
  return {proximos,atualizados};
}
