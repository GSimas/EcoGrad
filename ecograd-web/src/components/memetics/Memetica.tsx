import { useMemo, useState } from 'react';
import { Dna } from 'lucide-react';
import { Aviso, Card, Kpi, Tabela } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { CatalogoOntologia } from './CatalogoOntologia';
import { EcologiaSNA } from './EcologiaSNA';
import { GraficoLongevidade } from './GraficoLongevidade';
import { calcularMetricasMemeticas, tempoDeMeiaVida, type FonteMemes } from '@/lib/memetics';
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
  const docs = useEcoGradStore((s) => s.docs);
  const [fonteRotulo, setFonteRotulo] = useState<(typeof OPCOES_FONTE)[number]>(OPCOES_FONTE[0]);
  const fonte: FonteMemes = fonteRotulo.includes('IA') ? 'Artefatos Extraídos' : 'Palavras-chave';

  const metricas = useMemo(() => calcularMetricasMemeticas(docs, fonte), [docs, fonte]);
  const meiaVida = useMemo(() => tempoDeMeiaVida(metricas.longevidade), [metricas]);

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
          Como as ideias se replicam, sobrevivem e morrem dentro do ecossistema acadêmico.
        </p>
      </header>

      <CatalogoOntologia />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">A Genética das Ideias (Visão Geral de Propagação)</h2>

        <GrupoOpcoes
          rotulo="Prisma da análise de propagação memética"
          opcoes={OPCOES_FONTE}
          valor={fonteRotulo}
          onChange={setFonteRotulo}
        />

        {metricas.fecundidade.length === 0 ? (
          <Aviso tipo="aviso">
            {fonte === 'Artefatos Extraídos'
              ? '⚠️ Não há artefatos suficientes extraídos para gerar os gráficos. Gere a ontologia usando o processamento acima.'
              : '⚠️ Dados insuficientes para calcular métricas meméticas.'}
          </Aviso>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi rotulo="Memes Totais" valor={totalMemes} />
              <Kpi
                rotulo="Mortalidade Infantil"
                valor={metricas.mortalidade}
                detalhe={`${taxaMortalidade.toFixed(1)}% apareceram uma única vez`}
              />
              <Kpi rotulo="Memes Sobreviventes" valor={metricas.sobreviventes} detalhe="Replicaram-se ≥ 2 vezes" />
              <Kpi
                rotulo="Tempo de Meia-Vida"
                valor={`${meiaVida.toFixed(1)} anos`}
                detalhe="Mediana do tempo de vida dos memes replicados"
              />
            </div>

            <Card>
              <h3 className="mb-2 text-sm font-semibold">Fecundidade vs. Mortalidade Infantil</h3>
              <Grafico
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
                        { name: 'Sobreviventes (>1 aparição)', value: metricas.sobreviventes, itemStyle: { color: '#2ECC71' } },
                        { name: 'Mortos (1 aparição)', value: metricas.mortalidade, itemStyle: { color: '#E74C3C' } },
                      ],
                      label: { color: TEMA_GRAFICO.texto },
                      itemStyle: { borderColor: '#0E1117', borderWidth: 2 },
                    },
                  ],
                }}
              />
            </Card>

            <GraficoLongevidade longevidade={metricas.longevidade} />

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-2">
                <h3 className="text-sm font-semibold">Memes mais fecundos</h3>
                <Tabela
                  altura="max-h-80"
                  linhas={topVivos as unknown as Array<Record<string, unknown>>}
                  colunas={[
                    { chave: 'meme', rotulo: 'Meme', className: 'max-w-xs truncate' },
                    { chave: 'fecundidade', rotulo: 'Nº de Aparições', barra: { max: topVivos[0]?.fecundidade ?? 1 } },
                  ]}
                />
              </Card>

              <Card className="space-y-2">
                <h3 className="text-sm font-semibold">Maior longevidade</h3>
                <Tabela
                  altura="max-h-80"
                  linhas={
                    [...metricas.longevidade]
                      .sort((a, b) => b.tempo_vida_anos - a.tempo_vida_anos || b.total_aparicoes - a.total_aparicoes)
                      .slice(0, 20) as unknown as Array<Record<string, unknown>>
                  }
                  colunas={[
                    { chave: 'meme', rotulo: 'Meme', className: 'max-w-xs truncate' },
                    // Anos são identificadores, não quantidades: sem separador de milhar
                    { chave: 'ano_nascimento', rotulo: 'Nascimento', render: (l) => String(l.ano_nascimento) },
                    { chave: 'ano_extincao', rotulo: 'Última aparição', render: (l) => String(l.ano_extincao) },
                    { chave: 'tempo_vida_anos', rotulo: 'Vida (anos)' },
                    { chave: 'total_aparicoes', rotulo: 'Aparições' },
                  ]}
                />
              </Card>
            </div>
          </>
        )}
      </section>

      <EcologiaSNA fonte={fonte} />
    </div>
  );
}
