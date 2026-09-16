import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { interromperConversa } from '@/services/chat';
import { interromperExtracao, interromperSintese } from '@/services/ia';
import { navigatePage } from '@/services/navigation';
export function AtividadesIA(){
 const chat=useEcoGradStore(s=>s.chat.streaming);const ia=useEcoGradStore(s=>s.ia);
 const sinteses=Object.entries(ia.sinteses).filter(([,s])=>s.estado==='executando');
 const lote=ia.lote;const ativo=lote?.estado==='executando';
 if(!chat&&!sinteses.length&&!ativo)return null;
 return <section aria-label="Atividades de IA" className="m-4 space-y-3 rounded-lg border border-eco-border bg-eco-panel p-3 text-sm">
  <p role="status">Solicitações de IA em andamento. Navegar não interrompe a atividade.</p>
  {chat&&<div className="flex flex-wrap gap-2"><button className="btn" onClick={()=>useEcoGradStore.setState(s=>({ui:{...s.ui,'consultor.aberto':true}}))}>Abrir conversa em andamento</button><button className="btn" onClick={interromperConversa}>Interromper resposta do UFSCão</button></div>}
  {ativo&&<div className="flex flex-wrap gap-2"><button className="btn" onClick={()=>navigatePage('memetica')}>Abrir lote de ontologia ({lote.itens.filter(i=>i.estado==='concluido').length}/{lote.itens.length})</button><button className="btn" onClick={interromperExtracao}>Interromper lote de ontologia</button></div>}
  {sinteses.map(([id,s])=><div key={id} className="space-y-2"><p className="break-words">Síntese: {s.programas.join(', ')}</p><button className="btn" onClick={()=>interromperSintese(id)}>Interromper síntese em andamento</button></div>)}
 </section>;
}
