import { useEffect, useMemo } from 'react';
import { amostraSintese } from '@/lib/ia-contexto';
import { gerarSintese, interromperSintese } from '@/services/ia';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { baixarArquivo } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Landmark, Sparkles } from 'lucide-react';
import { Aviso, Card, Carregando, Expander } from '@/components/ui/primitives';
import { carregarCatalogoCapes, encontrarFichaCapes } from '@/lib/capes';
import { fichaDocumentada } from '@/lib/colecoes';
import { carregarCatalogoProgramas } from '@/lib/data-loader';
import { EvidenciaColecao } from '@/components/layout/ColecoesPicker';
import { FonteCapes } from './FonteCapes';
import type { Documento } from '@/types';

/**
 * Ficha Técnica (dados oficiais da CAPES) + Síntese epistemológica da IA.
 * Transcrição de Principal.py:358-418.
 */
export function FichaTecnica({ docs, programas }: { docs: readonly Documento[]; programas: readonly string[] }) {
  const capes = useQuery({
    queryKey: ['catalogo-capes', 2],
    queryFn: ({ signal }) => carregarCatalogoCapes(signal),
  });

  const colecoes = useQuery({ queryKey: ['catalogo-programas'], queryFn: ({ signal }) => carregarCatalogoProgramas(signal) });

  const amostra=useMemo(()=>amostraSintese(docs),[docs]);
  const id=JSON.stringify([programas,amostra.texto]);
  const sintese=useEcoGradStore(s=>s.ia.sinteses[id]);
  const executando=sintese?.estado==='executando';
  const legado=useQuery<string>({queryKey:['sintese',programas.join('|'),amostra.texto],enabled:false});
  useEffect(()=>{if(!sintese&&typeof legado.data==='string'&&legado.data.trim()&&!legado.data.startsWith('Não foi possível')){
    const s=useEcoGradStore.getState();s.setIA({sinteses:{...s.ia.sinteses,[id]:{texto:legado.data,estado:'concluida',amostra:amostra.texto,programas:[...programas]}}});
  }},[legado.data,sintese,id,amostra.texto,programas]);

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Landmark size={18} /> Ficha Técnica e Perfil Institucional
      </h3>

      {capes.isLoading && <Carregando texto="Cruzando com o catálogo oficial da CAPES..." />}

      {capes.data && <FonteCapes catalogo={capes.data} />}
      {capes.isError && (
        <Aviso tipo="aviso">
          {capes.data ? 'Não foi possível atualizar a consulta. Exibindo os últimos dados obtidos.' : 'Consulta CAPES indisponível. Isso não significa que o programa não exista no catálogo.'}
          <button type="button" className="btn ml-2" disabled={capes.isFetching} onClick={() => void capes.refetch()}>Tentar novamente</button>
        </Aviso>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {programas.map((nome) => {
          if (!capes.data) return null;
          const correspondencia = encontrarFichaCapes(nome, capes.data);
          const specs = colecoes.data?.[nome] ? [colecoes.data[nome]] : [];
          const documentada = fichaDocumentada(nome, specs, capes.data);
          if (!documentada) {
            const ambiguo = correspondencia.status === 'ambigua';
            const candidatos = correspondencia.status === 'exata' ? [correspondencia.programa] : correspondencia.status === 'ambigua' ? correspondencia.candidatos : correspondencia.sugestoes;
            return (
              <Card key={nome}>
                <p className="font-semibold text-slate-200">{nome}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {ambiguo
                    ? 'Correspondência ambígua: há programas diferentes com este nome. Nenhuma nota foi atribuída à coleção.'
                    : 'Vínculo da coleção com o código CAPES não verificado ou pendente de revisão. Mesmo um nome coincidente não confirma a identidade. Nenhuma nota foi atribuída.'}
                </p>
                {candidatos.length > 0 && (
                  <div className="mt-3 space-y-2 text-xs text-slate-300">
                    <p className="font-semibold">Registros para conferência — não são vínculos confirmados:</p>
                    <ul className="space-y-2">
                      {candidatos.map((p) => <li key={p.Código}>{p.Nome} · Código {p.Código} · {p.Modalidade} · {p['Grau Acadêmico']} · {p.Situação}</li>)}
                    </ul>
                  </div>
                )}
              </Card>
            );
          }
          const ficha = documentada.programa;
          return (
            <Card key={nome}>
              <p className="font-semibold text-eco-accent">
                {ficha.Nome} ({ficha.Código}) · Nota CAPES: {ficha.Nota}
              </p>
              <div className="mt-3"><EvidenciaColecao nome={nome} specs={specs} tipo="ppg" /></div>
              <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                <Linha rotulo="Grande Área" valor={ficha['Grande Área']} />
                <Linha rotulo="Modalidade" valor={`${ficha.Modalidade} (${ficha['Grau Acadêmico']})`} />
                <Linha rotulo="Área de Avaliação" valor={ficha['Área de Avaliação']} />
                <Linha rotulo="Situação" valor={ficha.Situação} />
                <Linha rotulo="Área de Conhecimento" valor={ficha['Área de Conhecimento']} />
                <Linha rotulo="Ensino" valor={ficha['Modalidade de Ensino']} />
              </dl>
            </Card>
          );
        })}
      </div>

      <Card className="space-y-3">
        <h3 className="flex items-center gap-2 font-semibold"><Sparkles size={16}/>Síntese da amostra por IA</h3>
        <p className="text-sm text-slate-300">Etapa opcional. Envia ao Google Gemini os nomes das coleções e títulos/palavras-chave de até 25 documentos, espaçados na ordem da seleção (salto {amostra.salto}). Amostra atual: {amostra.quantidade} de {amostra.total} registros, {amostra.texto.length} caracteres. {amostra.truncada?'O texto foi cortado em 20.000 caracteres, podendo terminar no meio de um registro.':'Não houve corte por tamanho.'} Não envia resumos, chat ou dados CAPES. A amostra não é aleatória nem garante representação de todas as coleções.</p>
        <Expander titulo="Conferir amostra da síntese"><pre className="whitespace-pre-wrap break-words text-xs">{amostra.texto}</pre></Expander>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={executando||!docs.length} onClick={()=>void gerarSintese(id,[...programas],amostra.texto,amostra)}>{sintese?'Gerar síntese novamente':'Gerar síntese da amostra'}</button>
          {executando&&<button type="button" className="btn" onClick={()=>interromperSintese(id)}>Interromper síntese</button>}
          {sintese?.texto&&<button type="button" className="btn" onClick={()=>baixarArquivo(JSON.stringify({...sintese,baseVersion:useEcoGradStore.getState().baseVersion},null,2),'ecograd-sintese.json')}>Exportar síntese com amostra</button>}
        </div>
        {executando&&<p role="status">Gerando síntese. Você pode navegar; a solicitação continua nesta sessão.</p>}
        {sintese?.erro&&<Aviso tipo="aviso"><p role="status">{sintese.erro}</p></Aviso>}
        {sintese?.texto&&<Aviso><p><strong>{sintese.estado==='concluida'?'Síntese gerada':'Última síntese concluída'}:</strong> {sintese.texto}</p><p className="mt-2">Descrição da amostra, não avaliação oficial ou resumo exaustivo da produção. Confira os trabalhos na fonte.</p></Aviso>}
      </Card>
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-slate-400">{rotulo}</dt>
      <dd className="text-slate-300">{valor}</dd>
    </div>
  );
}
