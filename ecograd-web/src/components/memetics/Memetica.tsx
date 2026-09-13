import { useSessionField } from '@/hooks/useSessionField';
import { TrabalhosDoTermo } from '@/components/results/TrabalhosDoTermo';
import { periodoTexto, resumoRegistros } from '@/lib/resultados';
import { useMemo, useRef } from 'react';
import { Dna } from 'lucide-react';
import { Aviso, Card, Expander, Kpi, Tabela } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { CatalogoOntologia } from './CatalogoOntologia';
import { EcologiaSNA } from './EcologiaSNA';
import { GraficoLongevidade } from './GraficoLongevidade';
import { calcularMetricasMemeticas, extrairMemesCompletos, tempoDeMeiaVida } from '@/lib/memetics';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

const OPCOES_FONTE = [
  'Palavras-chave e Títulos (Tradicional)',
  'Artefatos Extraídos pela IA (Ontologia)',
] as const;

/**
 * A Genética das Ideias: fecundidade, mortalidade infantil e longevidade.
 * Transcrição de `calcular_metricas_memeticas` e do painel de pages/1_Avançado.py:1370+.
 */
export function Memetica() {
  const catalogoRef = useRef<HTMLDivElement>(null);
  const [, setCatalogoAberto] = useSessionField('expander.Preparar artefatos e gerenciar catálogo (avançado)', false);
  const processando = useEcoGradStore((s)=>Boolean(s.ui['ontologia.processando']));
  const statusOntologia = useEcoGradStore((s)=>String(s.ui['ontologia.status'] ?? ''));
  const abrirCatalogo = () => {
    setCatalogoAberto(true);
    requestAnimationFrame(()=>{catalogoRef.current?.querySelector('summary')?.focus();catalogoRef.current?.scrollIntoView({block:'start'});});
  };
  const docs = useEcoGradStore((s) => s.docs);
  const [termoVisual, setTermoVisual] = useSessionField<string | null>('grafico.memes.termo', null);
  const [origemTermo, setOrigemTermo] = useSessionField('grafico.memes.origem', 'propagacao');
  const selecionarTermo = (nome:string) => {setOrigemTermo('propagacao');setTermoVisual(nome);};
  const selecionarNo = (nome:string) => {setOrigemTermo('rede');setTermoVisual(nome);};
  const fonte = useEcoGradStore((s) => s.fonteMemes);
  const setFonte = useEcoGradStore((s) => s.setFonteMemes);
  const fonteRotulo = fonte === 'Artefatos Extraídos' ? OPCOES_FONTE[1] : OPCOES_FONTE[0];
  const setFonteRotulo = (rotulo: string) => setFonte(rotulo.includes('IA') ? 'Artefatos Extraídos' : 'Palavras-chave');

  const metricas = useMemo(() => calcularMetricasMemeticas(docs, fonte), [docs, fonte]);
  const meiaVida = useMemo(() => tempoDeMeiaVida(metricas.longevidade), [metricas]);

  const cobertura = useMemo(()=>resumoRegistros(docs),[docs]);
  const comTermos = useMemo(()=>docs.filter((d)=>extrairMemesCompletos(d,fonte).length>0).length,[docs,fonte]);
  const semTitulo = metricas.fecundidade.filter((l)=>l.fecundidade===0).length;
  const grupoOutros = semTitulo ? 'Mais de um título ou sem título' : 'Mais de um título';
  const contexto = {fonteMemes:fonte, registrosComTermos:comTermos, termosSemTitulo:semTitulo, limiteInterpretacao:'Contagens por títulos distintos; intervalo observado não é sobrevivência nem extinção.'};
  const totalMemes = metricas.mortalidade + metricas.sobreviventes;
  const taxaMortalidade = totalMemes > 0 ? (metricas.mortalidade / totalMemes) * 100 : 0;

  const topVivos = useMemo(() => metricas.memesVivos.slice(0, 20), [metricas]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Dna size={22} /> Memética e Ontologia
        </h1>
        <p className="text-sm text-slate-400">
          Explore a presença de termos nos trabalhos, seus intervalos de ocorrência e suas conexões na seleção.
        </p>
      </header>

      {processando && <Aviso><p role="status">Extração em andamento. {statusOntologia}</p><button type="button" className="btn mt-2" onClick={abrirCatalogo}>Acompanhar ou interromper extração</button></Aviso>}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">1. Explore os termos e seus trabalhos</h2>

        <GrupoOpcoes
          rotulo="Fonte dos termos"
          opcoes={OPCOES_FONTE}
          valor={fonteRotulo}
          onChange={setFonteRotulo}
        />

        <Card className="space-y-2 text-sm text-slate-300">
          <p>Período observado: {periodoTexto(cobertura)} · {docs.length} registros · {comTermos} com termos nesta fonte · {cobertura.semAno} sem ano.</p>
          <p>A propagação usa toda a seleção. Contagens são títulos distintos associados, não citações nem ocorrências no texto. Títulos iguais são agregados. Sem ano, o registro ainda contribui para contagens; intervalos exigem datas válidas.</p>
          <p>{fonte === 'Artefatos Extraídos' ? 'A cobertura é parcial quando apenas parte dos documentos possui artefatos. Revise as extrações nos resumos; a ausência de artefatos não comprova ausência do conceito.' : 'A fonte inclui palavras-chave normalizadas e palavras dos títulos, sem palavras comuns; não representa apenas palavras-chave fornecidas pelos autores.'}</p>
          <p>Próximo passo: abra um termo em uma tabela para ler seus trabalhos. Para examinar conexões, construa a rede abaixo.</p>
          {semTitulo > 0 && <Aviso>{semTitulo} termos não têm título associado. O algoritmo original os inclui no grupo complementar a “Um título”; por isso esse grupo não equivale integralmente a repetição.</Aviso>}
          {fonte === 'Artefatos Extraídos' && <button type="button" className="btn" onClick={abrirCatalogo}>Preparar ou importar artefatos</button>}
        </Card>

        {metricas.fecundidade.length === 0 ? (
          <Aviso tipo="aviso">
            {fonte === 'Artefatos Extraídos'
              ? 'Não há artefatos extraídos nesta seleção. Use a fonte tradicional para explorar agora ou prepare um catálogo na seção avançada.'
              : 'Não há termos extraíveis dos títulos e palavras-chave. Confira os metadados no Dashboard ou use Editar seleção para escolher outra coleção.'}
            {fonte === 'Artefatos Extraídos' && <button type="button" className="btn mt-2" onClick={()=>setFonte('Palavras-chave')}>Explorar palavras-chave e títulos</button>}
          </Aviso>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi rotulo="Termos distintos" valor={totalMemes} />
              <Kpi
                rotulo="Em um título"
                valor={metricas.mortalidade}
                detalhe={`${taxaMortalidade.toFixed(1)}% têm exatamente um título associado`}
              />
              <Kpi rotulo={grupoOutros} valor={metricas.sobreviventes} detalhe={semTitulo ? `${semTitulo} sem título incluídos pelo modelo original` : "Títulos distintos associados ≥ 2"} />
              <Kpi
                rotulo="Intervalo mediano observado"
                valor={metricas.longevidade.length ? `${meiaVida.toFixed(1)} anos` : "Não calculável"}
                detalhe={`${metricas.longevidade.length} termos com ≥ 2 títulos e ano válido; não estima sobrevivência`}
              />
            </div>

            <Card>
              <h3 className="mb-2 text-sm font-semibold">Distribuição por títulos associados</h3>
              <Grafico
                leitura={{ titulo:'Distribuição das replicações', descricao:'Setores: termos com exatamente um título e grupo complementar. Títulos ausentes, quando existentes, são informados na cobertura e incluídos no grupo complementar pelo algoritmo original. As cores identificam categorias; as contagens completas estão na tabela.', linhas:[{grupo:grupoOutros,total:metricas.sobreviventes},{grupo:'Um título',total:metricas.mortalidade}], colunas:[{chave:'grupo',rotulo:'Categoria'},{chave:'total',rotulo:'Termos (n)'}], contexto }}
                altura={300}
                option={{
                  tooltip: { trigger: 'item' },
                  legend: { bottom: 0, textStyle: { color: TEMA_GRAFICO.texto } },
                  series: [
                    {
                      type: 'pie',
                      radius: ['45%', '70%'],
                      center: ['50%', '45%'],
                      data: [
                        { name: grupoOutros, value: metricas.sobreviventes, itemStyle: { color: '#2ECC71' } },
                        { name: 'Um título', value: metricas.mortalidade, itemStyle: { color: '#E74C3C' } },
                      ],
                      label: { color: '#FFFFFF', backgroundColor: '#0E1117', padding: [3, 5], borderRadius: 3, position: 'inside', formatter: '{d}%' },
                  labelLayout: {hideOverlap:true},
                      itemStyle: { borderColor: '#0E1117', borderWidth: 2 },
                    },
                  ],
                }}
              />
            </Card>

            <GraficoLongevidade longevidade={metricas.longevidade} onSelecionar={selecionarTermo} />

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-2">
                <h3 className="text-sm font-semibold">Termos associados a mais títulos</h3>
                <Tabela
              titulo="Memes mais fecundos"
                  contexto={{...contexto, limite:20}}
                  descricao="20 primeiros do ranking original. Contagens por títulos distintos; intervalos em anos, sem inferir extinção real."
                  onAbrir={(l)=>selecionarTermo(String(l.meme))}
                  altura="max-h-80"
                  linhas={topVivos as unknown as Array<Record<string, unknown>>}
                  colunas={[
                    { chave: 'meme', rotulo: 'Termo', className: 'max-w-xs truncate' },
                    { chave: 'fecundidade', rotulo: 'Títulos distintos (n)', barra: { max: topVivos[0]?.fecundidade ?? 1 } },
                  ]}
                />
              </Card>

              <Card className="space-y-2">
                <h3 className="text-sm font-semibold">Maior longevidade</h3>
                <Tabela
              titulo="Maior longevidade"
                  contexto={{...contexto, limite:20}}
                  descricao="20 primeiros do ranking original. Contagens por títulos distintos; intervalos em anos, sem inferir extinção real."
                  onAbrir={(l)=>selecionarTermo(String(l.meme))}
                  altura="max-h-80"
                  linhas={
                    [...metricas.longevidade]
                      .sort((a, b) => b.tempo_vida_anos - a.tempo_vida_anos || b.total_aparicoes - a.total_aparicoes)
                      .slice(0, 20) as unknown as Array<Record<string, unknown>>
                  }
                  colunas={[
                    { chave: 'meme', rotulo: 'Termo', className: 'max-w-xs truncate' },
                    // Anos são identificadores, não quantidades: sem separador de milhar
                    { chave: 'ano_nascimento', rotulo: 'Primeiro ano', render: (l) => String(l.ano_nascimento) },
                    { chave: 'ano_extincao', rotulo: 'Última aparição', render: (l) => String(l.ano_extincao) },
                    { chave: 'tempo_vida_anos', rotulo: 'Intervalo (anos)' },
                    { chave: 'total_aparicoes', rotulo: 'Títulos distintos (n)' },
                  ]}
                />
              </Card>
            </div>
          </>
        )}
      </section>

      <TrabalhosDoTermo termo={termoVisual} fonteMemes={fonte} redeMemetica={origemTermo==='rede'} onFechar={()=>setTermoVisual(null)} />
      <EcologiaSNA fonte={fonte} onSelecionarTermo={selecionarNo} />
      <Expander titulo="Métodos e limites da propagação">
        <p className="text-sm text-slate-300">Os nomes técnicos fecundidade, mortalidade e meia-vida são metáforas do modelo original. Aqui, fecundidade conta títulos distintos, mortalidade corresponde a exatamente um título e meia-vida é a mediana dos intervalos entre primeiro e último ano dos termos com mais de um título. Não se estima probabilidade de sobrevivência. Zero anos é válido quando as aparições datadas ocorrem no mesmo ano. Falta de observações posteriores não comprova extinção. Na rede, o extrator tem normalização própria; seus nomes e totais podem diferir dos gráficos de propagação. Os campos originais das exportações permanecem compatíveis.</p>
      </Expander>
      <div ref={catalogoRef}>
        <Expander titulo="Preparar artefatos e gerenciar catálogo (avançado)">
          <p className="mb-4 text-sm text-slate-300">Etapa opcional para analisar artefatos. Confira o catálogo existente, importe um CSV ou inicie explicitamente um lote. Abrir esta seção não envia resumos à IA.</p>
          <CatalogoOntologia />
        </Expander>
      </div>
    </div>
  );
}
