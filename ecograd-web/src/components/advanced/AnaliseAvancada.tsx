import { Microscope } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { RecorteAtivo } from '@/components/layout/RecorteAtivo';
import { ABAS_AVANCADA, ROTULOS_ABA, type AbaAvancada } from '@/lib/navigation';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import { MapaTematico } from '@/components/exploration/MapaTematico';
import { EspacoTopologico } from '@/components/exploration/EspacoTopologico';
import { FurosEstruturais } from '@/components/exploration/FurosEstruturais';
import { BoxplotEspecializacao } from '@/components/exploration/BoxplotEspecializacao';
import { MetricasGlobais } from '@/components/exploration/MetricasGlobais';
import { ExportarRede } from '@/components/exploration/ExportarRede';
import { BaseComSNA } from '@/components/exploration/BaseComSNA';
import { RadarForesight } from '@/components/foresight/RadarForesight';
import { PropagacaoMemetica } from '@/components/memetics/PropagacaoMemetica';
import { EcologiaSNA } from '@/components/memetics/EcologiaSNA';
import type { ReactNode } from 'react';

/** Uma frase por aba, para a escolha não depender só do rótulo. */
const RESUMO_ABA: Record<AbaAvancada, string> = {
  temas: 'Quais assuntos existem na seleção, com que volume, em que anos e ligados a quem.',
  tempo: 'Como o vocabulário mudou entre períodos e o que os modelos temporais dizem sobre ele.',
  rede: 'Como temas, pessoas e conceitos se conectam, e que forma essa rede tem.',
  dados: 'Especialização por nível acadêmico e os dados da análise para levar embora.',
};

const CONTEUDO_ABA: Record<AbaAvancada, ReactNode> = {
  temas: <><MapaTematico /><PropagacaoMemetica /></>,
  tempo: <RadarForesight />,
  rede: <><EspacoTopologico /><FurosEstruturais /><EcologiaSNA /><MetricasGlobais /></>,
  dados: <><BoxplotEspecializacao /><BaseComSNA /><ExportarRede /></>,
};

/**
 * Análise Avançada — a tela estrutural, temporal e conceitual do EcoGrad.
 *
 * Reúne o que antes eram três páginas separadas (Exploração Global, Foresight e
 * Memética) em abas agrupadas por pergunta, e não por origem: a propagação dos
 * termos fica junto da análise temática, e a rede memética junto do espaço
 * topológico, porque é assim que elas são lidas.
 *
 * As abas do Radix montam só o painel ativo. Os gráficos pesados — e há muitos
 * aqui — passam a carregar sob demanda, em vez de todos de uma vez.
 */
export function AnaliseAvancada() {
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);
  const docs = useEcoGradStore((s) => s.docs);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Microscope size={22} aria-hidden /> Análise Avançada
        </h1>
        <p className="text-sm text-slate-400">Base: {rotulo} · {docs.length.toLocaleString('pt-BR')} registros</p>
      </header>

      <RecorteAtivo />

      <Card className="space-y-2 text-sm text-slate-300">
        <p>Todos os índices desta página são relativos ao recorte ativo — mudam quando as coleções mudam. Nenhum deles mede qualidade, impacto ou mérito acadêmico, e nenhum substitui a leitura dos trabalhos.</p>
        <p>Os cálculos mais pesados têm botão próprio, para que a página abra rápido e você escolha o que rodar. Eles seguem em segundo plano se você trocar de aba.</p>
      </Card>

      <Tabs
        chaveSessao="avancada"
        abas={ABAS_AVANCADA.map((aba) => ({
          valor: aba,
          rotulo: ROTULOS_ABA[aba],
          conteudo: (
            <div className="space-y-10">
              <p className="text-sm text-slate-400">{RESUMO_ABA[aba]}</p>
              {CONTEUDO_ABA[aba]}
            </div>
          ),
        }))}
      />
    </div>
  );
}
