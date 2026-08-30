import { useMemo } from 'react';
import { Microscope, Search } from 'lucide-react';
import { Aviso, Card, Kpi } from '@/components/ui/primitives';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { SelectBusca } from '@/components/ui/MultiSelect';
import { Dossie } from './Dossie';
import { useDadosDerivados, useGrafoHistorico, usePerfisSimilaridade } from '@/hooks/useDadosDerivados';
import { docsDoTermo, opcoesPorTipo } from '@/lib/entities';
import { calcularRaioX } from '@/lib/ql';
import { contar } from '@/lib/foresight-math';
import { formatarDecimal } from '@/lib/utils';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { TipoBusca } from '@/types';

const TIPOS: TipoBusca[] = [
  'Documento',
  'Autor',
  'Orientador',
  'Co-orientador',
  'Palavra-chave',
  'Macrotema',
];

/** Motor de Busca e Dossiê (Principal.py:601-1190). */
export function MotorBusca() {
  const { docs, indices } = useDadosDerivados();
  const snaGlobal = useEcoGradStore((s) => s.snaGlobal);
  const buscaTipo = useEcoGradStore((s) => s.buscaTipo);
  const buscaTermo = useEcoGradStore((s) => s.buscaTermo);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);

  const perfis = usePerfisSimilaridade(docs);
  const grafoHistorico = useGrafoHistorico(docs);

  const opcoes = useMemo(() => opcoesPorTipo(indices, buscaTipo), [indices, buscaTipo]);
  const docsAlvo = useMemo(
    () => (buscaTermo ? docsDoTermo(indices, buscaTipo, buscaTermo) : []),
    [indices, buscaTipo, buscaTermo],
  );

  const contagemPks = useMemo(
    () => contar(docs.flatMap((d) => d.palavras_chave).filter(Boolean)),
    [docs],
  );

  const metricas = buscaTermo ? snaGlobal?.[buscaTermo] : undefined;

  const raioX = useMemo(
    () => calcularRaioX(docsAlvo, docs, metricas?.Clustering ?? 0, contagemPks),
    [docsAlvo, docs, metricas, contagemPks],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Search size={22} /> Motor de Busca e Dossiê
        </h1>
        <p className="text-sm text-slate-400">
          Busca unificada por Documento, Autor, Orientador, Co-orientador, Palavra-chave e Macrotema.
        </p>
      </header>

      <Card className="space-y-4">
        <GrupoOpcoes
          rotulo="Procurar por entidade"
          opcoes={TIPOS}
          valor={buscaTipo}
          onChange={(t) => navegarPara(t, null)}
        />
        <SelectBusca
          rotulo="Selecione"
          opcoes={opcoes}
          valor={buscaTermo}
          onChange={(v) => navegarPara(buscaTipo, v)}
        />
      </Card>

      {!buscaTermo && (
        <Aviso>
          Selecione uma entidade acima para abrir o dossiê completo — com Raio-X de Especialização,
          evolução histórica, lexicometria, órbita animada e recomendações por Jaccard.
        </Aviso>
      )}

      {buscaTermo && docsAlvo.length === 0 && (
        <Aviso tipo="aviso">Nenhum documento associado a &quot;{buscaTermo}&quot; nesta base.</Aviso>
      )}

      {buscaTermo && docsAlvo.length > 0 && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="space-y-4">
              <p className="text-lg font-semibold text-eco-accent">{buscaTermo}</p>

              {raioX && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Microscope size={16} /> Raio-X de Especialização
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Kpi
                      rotulo={`Peculiaridade NMF${raioX.amostraMultipla ? ' (Média)' : ''}`}
                      valor={`${raioX.purezaMedia.toFixed(1)}%`}
                      detalhe={`Perfil: ${raioX.perfil}`}
                    />
                    <Kpi
                      rotulo="Densidade Local (SNA)"
                      valor={raioX.densidade.toFixed(2)}
                      detalhe={raioX.densidade > 0.8 ? 'Forte coesão / panelinha' : 'Conexões esparsas'}
                    />
                    <Kpi
                      rotulo={`Raridade IDF${raioX.amostraMultipla ? ' (Média)' : ''}`}
                      valor={`${raioX.raridadePct.toFixed(1)}%`}
                      detalhe={raioX.raridadePct > 60 ? 'Vocabulário raro / nicho' : 'Vocabulário comum'}
                    />
                  </div>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <p className="text-sm font-medium text-slate-200">Posição na Rede</p>
              {metricas ? (
                <>
                  <div className="sucesso text-xs">
                    Cluster {String(metricas.Comunidade)} · Rank #{String(metricas['Ranking Global'])}
                  </div>
                  <div className="grid gap-2">
                    <Kpi rotulo="Grau (Conexões)" valor={metricas['Grau Absoluto']} />
                    <Kpi rotulo="Betweenness" valor={formatarDecimal(metricas.Betweenness)} />
                    <Kpi rotulo="Closeness" valor={formatarDecimal(metricas.Closeness)} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Métricas SNA ainda não disponíveis — aguarde o cálculo da rede no Dashboard.
                </p>
              )}
            </Card>
          </div>

          <Dossie
            termo={buscaTermo}
            tipo={buscaTipo}
            docsAlvo={docsAlvo}
            dadosCompletos={docs}
            snaGlobal={snaGlobal}
            perfis={perfis}
            grafoHistorico={grafoHistorico}
          />
        </div>
      )}
    </div>
  );
}
