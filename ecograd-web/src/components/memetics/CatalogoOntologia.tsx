import { Select } from '@/components/ui/Select';
import { CuradoriaTermos } from './CuradoriaTermos';
import { resultadoCurado } from '@/lib/curadoria';
import { aplicarCuradoria } from '@/services/curadoria';
import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { useSessionField } from '@/hooks/useSessionField';
import { Aviso, Card, Expander, Progresso, Tabela } from '@/components/ui/primitives';
import { baixarArquivo } from '@/lib/utils';
import { parseOntologia } from '@/lib/foresight-math';
import { COLUNAS_ONTOLOGIA, CHAVES_ONTOLOGIA, MAX_ARQUIVO, MAX_LINHAS, indexarDocumentos, linhasExportacaoOntologia, prepararImportacao } from '@/lib/ontologia-importacao';
import { iniciarExtracao, interromperExtracao } from '@/services/ia';
import { atividades } from '@/services/calculos';
import { useAtividades, emExecucao } from '@/hooks/useSnaWorker';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { ItemExtracao } from '@/lib/ia-state';
import type { OntologiaIA } from '@/types';

export function CatalogoOntologia() {
 const docs=useEcoGradStore(s=>s.docs);const baseVersion=useEcoGradStore(s=>s.baseVersion);
 const {lote,importacao}=useEcoGradStore(s=>s.ia);const setIA=useEcoGradStore(s=>s.setIA);
 const [tamanho,setTamanho]=useSessionField('ontologia.tamanho',10);
 const [mensagem,setMensagem]=useSessionField('ontologia.mensagem','');
 const [csvRascunho,setCsvRascunho]=useSessionField('ontologia.csvRascunho','');
 const [substituir,setSubstituir]=useSessionField('ontologia.substituir',false);
 const [ocupado,setOcupado]=useState(false);const inputRef=useRef<HTMLInputElement>(null);const previaRef=useRef<HTMLDivElement>(null);
 const processando=lote?.estado==='executando';const calculando=useAtividades().some(emExecucao);
 const linhas=useMemo(()=>docs.flatMap((d,indice)=>{const onto=parseOntologia(d.ontologia_ia);return onto?[{indice,Ano:d.ano??'N/A','Título':d.titulo,...Object.fromEntries(COLUNAS_ONTOLOGIA.map((c,i)=>[c,onto[CHAVES_ONTOLOGIA[i]].join(', ')]))}]:[];}),[docs]);
 const comResumo=docs.filter(d=>d.resumo.trim()).length;
 const validas=importacao?.linhas.filter(l=>l.valida && (!l.substituir||substituir))??[];
 const sucessoLote=lote?.itens.filter(i=>i.estado==='concluido'&&i.ontologia)??[];
 const resumoCuradoria=useMemo(()=>{try{return {erro:'',...sucessoLote.reduce((r,i)=>{const c=resultadoCurado(i);return {pendentes:r.pendentes+c.pendentes,aprovados:r.aprovados+c.aprovados,rejeitados:r.rejeitados+c.rejeitados};},{pendentes:0,aprovados:0,rejeitados:0})};}catch(e){return {erro:e instanceof Error?e.message:'Curadoria inválida',pendentes:0,aprovados:0,rejeitados:0};}},[lote]);
 const pendentes=lote?.itens.filter(i=>i.estado!=='concluido').length??0;
 const aguardando=lote?.itens.filter(i=>i.estado==='pendente'||i.estado==='executando').length??0;
 const guard=()=>{if(atividades.getSnapshot().some(emExecucao))throw new Error('Aguarde ou interrompa as atividades de cálculo antes de aplicar dados novos.');};
 const aplicar=async(porId:Map<string,OntologiaIA>,origem:'lote'|'csv')=>{
  const estado=useEcoGradStore.getState();const id=estado.analysisId;setOcupado(true);setMensagem('');
  try{guard();const n=origem==='lote'?await aplicarCuradoria(guard):await estado.aplicarOntologia(porId,substituir,guard);if(useEcoGradStore.getState().analysisId!==id)return;
   if(origem==='csv'&&importacao)setIA({importacao:{...importacao,aplicada:true}});
   setMensagem(`${n} ${n===1?'documento atualizado':'documentos atualizados'} por identidade exata. Resultados de cálculo anteriores foram invalidados porque os dados mudaram; execute-os novamente quando desejar.`);
  }catch(e){if(useEcoGradStore.getState().analysisId===id)setMensagem(e instanceof Error?e.message:'Falha na aplicação.');}finally{setOcupado(false);}
 };
 const lerArquivo=async(arquivo:File)=>{
  const id=useEcoGradStore.getState().analysisId;setOcupado(true);setMensagem('');
  try{if(arquivo.size>MAX_ARQUIVO)throw new Error('Arquivo excede 2 MiB. Divida o catálogo e importe uma parte por vez.');
   const texto=await arquivo.text();const parsed=Papa.parse<Record<string,string>>(texto,{header:true,skipEmptyLines:'greedy'});
   if(parsed.errors.length || Object.keys((parsed.meta as {renamedHeaders?:object}).renamedHeaders??{}).length)throw new Error('CSV malformado ou cabeçalhos duplicados. Corrija o arquivo antes de importar.');
   const previa=await prepararImportacao(parsed.data,parsed.meta.fields??[],docs,baseVersion,arquivo.name);
   if(useEcoGradStore.getState().analysisId!==id)return;setSubstituir(false);setIA({importacao:previa});
   requestAnimationFrame(()=>{previaRef.current?.focus();previaRef.current?.scrollIntoView({block:'start'});});
  }catch(e){if(useEcoGradStore.getState().analysisId===id){setIA({importacao:null});setMensagem(e instanceof Error?e.message:'Não foi possível ler o CSV.');}}finally{setOcupado(false);if(inputRef.current)inputRef.current.value='';}
 };
 const exportar=async()=>{
  setOcupado(true);try{const dados=await linhasExportacaoOntologia(docs,baseVersion);baixarArquivo(Papa.unparse(dados,{quotes:true}),'catalogo_ontologico_ia.csv');}catch{setMensagem('Não foi possível preparar a exportação.');}finally{setOcupado(false);}
 };
 const criarLote=async()=>{
  const id=useEcoGradStore.getState().analysisId;const indice=await indexarDocumentos(docs);if(useEcoGradStore.getState().analysisId!==id)return;
  const ids=indice.map(i=>i.id);const ambiguos=ids.length-new Set(ids).size;
  setMensagem(ambiguos?`${ambiguos} identidades repetidas: esses registros não serão enviados automaticamente.`:'');
  void iniciarExtracao(tamanho);
 };
 return <div className="space-y-4">
  <Card className="space-y-4">
   <h3 className="text-base font-semibold">Extração de artefatos por IA</h3>
   <p className="text-sm text-slate-300">A IA recebe somente o resumo integral de cada documento do lote. Título e identificador vinculam a resposta ao documento no EcoGrad e não são enviados ao Google Gemini nesta extração. {comResumo} de {docs.length} registros têm resumo. A fila segue a ordem da seleção, ignora registros já enriquecidos e identidades ambíguas. Não envia chat nem notas CAPES.</p>
   <p className="text-sm text-slate-300">A IA propõe nomes de teorias, ferramentas e métodos e pode agrupá-los ou omitir conceitos. Revise as extrações e suas fontes. Há uma pausa de quatro segundos entre documentos. Cada resultado fica salvo para revisão; só altera a análise ao aplicar. Interromper impede novas solicitações, mas o provedor pode concluir uma já recebida.</p>
   <div className="flex flex-wrap items-end gap-3">
    <label className="text-sm">Tamanho do Lote<Select aria-label="Tamanho do Lote" className="mt-1" valor={String(tamanho)} disabled={processando} onChange={v=>setTamanho(Number(v))} opcoes={[5,10,20,50,100,200,500,1000].map(t=>({valor:String(t),rotulo:String(t)}))} /></label>
    <button type="button" className="btn btn-primary" disabled={processando||ocupado||!comResumo||!!lote&&!lote.aplicado} onClick={()=>void criarLote()}>Preparar novo lote pela IA</button>
    {processando&&<button type="button" className="btn" onClick={interromperExtracao}>Interromper extração</button>}
   </div>
   {lote&&<div className="space-y-3">
    <Progresso valor={lote.itens.length?100*lote.itens.filter(i=>i.estado==='concluido'||i.estado==='erro').length/lote.itens.length:0} texto={`${sucessoLote.length} concluídos · ${lote.itens.filter(i=>i.estado==='erro').length} falhas · ${aguardando} pendentes · ${lote.estado==='concluido'?'processamento concluído':lote.estado==='interrompido'?'interrompido':'em andamento'}`} />
    <p className="text-sm">Lote capturado: {lote.itens.length} documentos. Retomar repete somente pendências e falhas; não reenvia os concluídos. Limite de 1.000 documentos por lote e armazenamento compartilhado de 64 MiB na sessão.</p>
    {lote.itens.length===0&&<Aviso>Nenhum registro elegível. Confira resumos, identidades repetidas e o catálogo existente.</Aviso>}
    <div className="flex flex-wrap gap-2">
     <button type="button" className="btn" disabled={processando||!pendentes||lote.aplicado} onClick={()=>void iniciarExtracao(tamanho,true)}>Retomar pendências e falhas</button>
     <button type="button" className="btn" disabled={processando||ocupado||calculando||!!resumoCuradoria.erro||!!resumoCuradoria.pendentes||!resumoCuradoria.aprovados||lote.aplicado} onClick={()=>void aplicar(new Map(), 'lote')}>Aplicar {resumoCuradoria.aprovados} termos aprovados</button>
     {!processando&&<button type="button" className="btn" onClick={()=>{if(!lote.aplicado&&!window.confirm('Encerrar descarta os resultados deste lote ainda não aplicados. Exporte a revisão se precisar conservar uma cópia. Continuar?'))return;setIA({lote:null});setMensagem('Lote encerrado. O catálogo já aplicado permanece na análise.');}}>Encerrar revisão deste lote</button>}
    </div>
    <button type="button" className="btn" onClick={()=>baixarArquivo(JSON.stringify({formato:'ecograd-revisao-ia-v2',...lote},null,2),'ecograd-revisao-ia.json')}>Exportar revisão com fontes e evidências</button>
    <p className="text-sm">Trechos literais demonstram a origem da proposta, não garantem que sua categoria esteja correta. Confira o uso descrito no resumo antes de aplicar. Resultados antigos sem evidências são identificados abaixo e não são reprocessados automaticamente. O CSV científico mantém o formato anterior; conserve também o JSON de revisão.</p>
    <p role="status">Curadoria: {resumoCuradoria.aprovados} aprovados · {resumoCuradoria.rejeitados} rejeitados · {resumoCuradoria.pendentes} pendentes.</p>
    {resumoCuradoria.erro&&<p role="alert">{resumoCuradoria.erro}</p>}
    <p className="text-sm">Decida todos os termos dos resultados concluídos antes de aplicar. Somente aprovações salvas serão usadas; rejeições e rascunhos ficam fora do catálogo. Após aplicar, a revisão fica bloqueada. Documentos com todos os termos rejeitados permanecem sem enriquecimento.</p>
    {lote.aplicado&&<Aviso>Resultados aplicados. Encerre a revisão para preparar outro lote; documentos já enriquecidos serão ignorados.</Aviso>}
    <Tabela titulo="Revisão do lote de ontologia" descricao="Resultados por identidade estável. Falhas não são ontologias vazias; listas vazias válidas significam que a IA não identificou itens." linhas={lote.itens.map(i=>({...i,artefatos:i.ontologia?JSON.stringify(i.ontologia):'',erro:i.erro??''}))} colunas={[{chave:'titulo',rotulo:'Título',className:'min-w-64'},{chave:'estado',rotulo:'Estado'},{chave:'artefatos',rotulo:'Extração proposta',render:l=><DetalheOntologia valor={l.ontologia as OntologiaIA|undefined}/>},{chave:'evidencias',rotulo:'Trechos e fonte',render:l=><EvidenciasExtracao item={l as unknown as ItemExtracao}/>},{chave:'curadoria',rotulo:'Curadoria por termo',render:l=><CuradoriaTermos item={l as unknown as ItemExtracao} bloqueado={!!processando||ocupado||!!lote.aplicado} revisaoId={lote.revisaoId??'legado'}/>},{chave:'erro',rotulo:'Motivo da falha'}]} />
   </div>}
  </Card>
  <Card className="space-y-3">
   <h3 className="text-base font-semibold">Importar catálogo com prévia</h3>
   <p className="text-sm text-slate-300">CSV de até 2 MiB e {MAX_LINHAS} linhas. Nada é aplicado ao selecionar o arquivo. O formato atual inclui versão da base, coleção, identificador estável e listas JSON, preservando vírgulas nos nomes. Identidade repetida ou divergente bloqueia a linha.</p>
   <div className="flex flex-wrap gap-2"><button type="button" className="btn" disabled={ocupado||processando} onClick={()=>inputRef.current?.click()}>Escolher CSV para prévia</button><button type="button" className="btn" disabled={ocupado||!linhas.length} onClick={()=>void exportar()}>Exportar CSV para reimportação</button></div>
   <Expander titulo="Colar CSV como texto">
    <label className="block text-sm">Conteúdo CSV<textarea className="input mt-2 min-h-40 font-mono text-xs" maxLength={50000} value={csvRascunho} onChange={e=>setCsvRascunho(e.target.value)} /></label>
    <p className="my-2 text-xs text-slate-400">{csvRascunho.length}/50.000 caracteres. O rascunho permanece na sessão. Usa a mesma validação da importação por arquivo.</p>
    <button type="button" className="btn" disabled={ocupado||processando||!csvRascunho.trim()} onClick={()=>void lerArquivo(new File([csvRascunho],'conteudo-colado.csv',{type:'text/csv'}))}>Validar CSV colado</button>
   </Expander>
   <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void lerArquivo(f);}} />
   {ocupado&&<p role="status">Preparando dados…</p>}
   {mensagem&&<Aviso><p role="status">{mensagem}</p></Aviso>}
   {calculando&&<Aviso>A aplicação aguarda o fim das atividades de cálculo. Você pode continuar a revisão; aplicar dados novos invalida os resultados anteriores.</Aviso>}
   {importacao&&<div ref={previaRef} tabIndex={-1} aria-label="Prévia da importação" className="space-y-3">
    <h4 className="break-words font-semibold">Prévia: {importacao.arquivo}</h4>
    {importacao.legado&&<Aviso>CSV antigo sem identificadores: somente títulos exatamente iguais e únicos na seleção são aceitos. Não se removem acentos nem se aproximam nomes. Listas antigas são separadas por vírgula; confira conceitos que contêm vírgulas antes de aplicar.</Aviso>}
    <p role="status">{validas.length} linhas {importacao.aplicada?'validadas na importação aplicada':'prontas para aplicar'} · {importacao.linhas.filter(l=>!l.valida).length} bloqueadas · {importacao.linhas.filter(l=>l.valida&&l.substituir).length} substituições possíveis.</p>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={substituir} onChange={e=>setSubstituir(e.target.checked)} disabled={importacao.aplicada} />Incluir substituição das ontologias existentes indicadas na prévia</label>
    <Tabela titulo="Prévia do catálogo importado" linhas={importacao.linhas.map(l=>({...l,artefatos:JSON.stringify(l.ontologia)}))} colunas={[{chave:'titulo',rotulo:'Título',className:'min-w-64'},{chave:'situacao',rotulo:'Validação',className:'min-w-48'},{chave:'colecao',rotulo:'Coleção'},{chave:'linha',rotulo:'Linha CSV'},{chave:'artefatos',rotulo:'Ontologia proposta',render:l=><DetalheOntologia valor={l.ontologia as OntologiaIA|undefined}/>}]} />
    <button type="button" className="btn btn-primary" disabled={ocupado||processando||calculando||!validas.length||importacao.aplicada||importacao.baseVersion!==baseVersion} onClick={()=>void aplicar(new Map(validas.map(l=>[l.id,l.ontologia!])), 'csv')}>Aplicar {validas.length} {validas.length===1?'linha validada':'linhas validadas'}</button>
    {importacao.aplicada&&<Aviso>Importação aplicada. Linhas bloqueadas não alteraram documentos.</Aviso>}
   </div>}
  </Card>
  <Expander titulo="Catálogo de artefatos aplicado à análise">
   {linhas.length?<Tabela titulo="Catálogo ontológico" descricao="Catálogo aplicado. Para reimportação use o CSV com identidade; as exportações desta tabela são para leitura." linhas={linhas} rotuloAbrir={l=>String(l['Título'])} onAbrir={l=>useEcoGradStore.getState().navegarDocumento(Number(l.indice))} colunas={[{chave:'Ano',rotulo:'Ano'},{chave:'Título',rotulo:'Título'},...COLUNAS_ONTOLOGIA.map(c=>({chave:c,rotulo:c}))]} />:<Aviso>Nenhuma ontologia aplicada. Prepare um lote ou escolha um CSV para revisar.</Aviso>}
  </Expander>
 </div>;
}

function DetalheOntologia({valor}:{valor?:OntologiaIA}){
 if(!valor)return <span>Sem extração válida</span>;
 const total=CHAVES_ONTOLOGIA.reduce((n,k)=>n+valor[k].length,0);
 return <details><summary className="cursor-pointer min-h-11">Ver {total} itens propostos</summary><dl className="space-y-2">{CHAVES_ONTOLOGIA.map((k,i)=><div key={k}><dt className="font-semibold">{COLUNAS_ONTOLOGIA[i]}</dt><dd className="whitespace-pre-wrap">{valor[k].join('; ')||'Nenhum item identificado'}</dd></div>)}</dl></details>;
}

function EvidenciasExtracao({item}:{item:ItemExtracao}) {
 if(item.estado!=='concluido')return <span>Sem resultado concluído.</span>;
 if(!item.fonte)return <span>Resultado legado sem evidências registradas. Confira a fonte antes de aplicar.</span>;
 return <div className="space-y-2 min-w-64">
  {/^https?:\/\//i.test(item.fonte.url)&&<a href={item.fonte.url} target="_blank" rel="noopener noreferrer" className="underline">Abrir fonte do documento</a>}
  {!item.evidencias&&<p>Resultado legado: fonte vinculada pela curadoria humana, sem evidências originais da IA.</p>}
  {item.evidencias?.length===0&&<p>Nenhum artefato identificado com apoio suficiente neste resumo.</p>}
  {(item.evidencias??[]).map(e=><div key={e.categoria+e.termo}><strong>{e.termo}</strong><p>{e.categoria.replaceAll('_',' ')}</p><blockquote className="border-l-2 pl-2">{e.trecho}</blockquote></div>)}
  <details><summary>{item.fonte.origem==='curadoria'?'Conferir resumo usado na curadoria':'Conferir resumo enviado'}</summary><p className="whitespace-pre-wrap">{item.fonte.resumo}</p></details>
 </div>;
}
