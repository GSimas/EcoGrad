import { Activity, Box, Boxes, Compass, Database, Dna, Download, FlaskConical, Microscope, Network, Radar as RadarIcon, Waves, Waypoints } from 'lucide-react';
import { Dica } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { BlocoEmJanela } from '@/components/ui/BlocoEmJanela';
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
import { SankeyTemporal } from '@/components/foresight/SankeyTemporal';
import { GridSearch } from '@/components/foresight/GridSearch';
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

interface Bloco {
  /** Chave de sessão da janela: guarda aberta/fechada, e atalhos de outra aba a usam. */
  chave: string;
  titulo: string;
  descricao: string;
  icone: ReactNode;
  conteudo: ReactNode;
}

/**
 * Cada bloco da aba vira um botão que abre o conteúdo numa janela, como no
 * Dashboard e no dossiê: a aba mostra o que dá para investigar, e cada leitura
 * pesada abre inteira, sem empurrar as outras para baixo.
 */
const BLOCOS_ABA: Record<AbaAvancada, Bloco[]> = {
  temas: [
    { chave: 'mapa-tematico', titulo: 'Análise Temática Estrutural', icone: <Compass size={20} aria-hidden />,
      descricao: 'Volumes, anos e posição de cada macrotema na rede, e os quadrantes temáticos de macrotemas e palavras-chave.', conteudo: <MapaTematico /> },
    { chave: 'propagacao', titulo: 'Propagação de termos e ontologia', icone: <Dna size={20} aria-hidden />,
      descricao: 'Presença dos termos nos trabalhos, o intervalo entre a primeira e a última ocorrência, e o catálogo de artefatos.', conteudo: <PropagacaoMemetica /> },
  ],
  tempo: [
    { chave: 'radar', titulo: 'Radar de Prospecção', icone: <RadarIcon size={20} aria-hidden />,
      descricao: 'Momentum temporal cruzado com novidade estrutural, em quadrantes que abrem os trabalhos de cada termo.', conteudo: <RadarForesight /> },
    { chave: 'sankey', titulo: 'Sankey Temporal de palavras-chave', icone: <Waves size={20} aria-hidden />,
      descricao: 'Quais termos as mesmas pessoas usaram ao passar de um período ao seguinte.', conteudo: <SankeyTemporal /> },
    { chave: 'grid-search', titulo: 'Avaliação histórica (Grid Search)', icone: <FlaskConical size={20} aria-hidden />,
      descricao: 'Compara 108 configurações do modelo em períodos históricos, pelo coeficiente de Matthews.', conteudo: <GridSearch mostrarAtividade={false} /> },
  ],
  rede: [
    { chave: 'espaco-3d', titulo: 'Espaço Topológico 3D', icone: <Box size={20} aria-hidden />,
      descricao: 'Grau × betweenness × closeness dos nós da dimensão escolhida, numa nuvem que gira.', conteudo: <EspacoTopologico /> },
    { chave: 'furos', titulo: 'Furos Estruturais (Burt)', icone: <Waypoints size={20} aria-hidden />,
      descricao: 'Orientadores que atravessam vocabulários distintos e os que se concentram em um só.', conteudo: <FurosEstruturais /> },
    { chave: 'ecologia', titulo: 'Ecologia memética (SNA)', icone: <Network size={20} aria-hidden />,
      descricao: 'A rede dos termos entre si: grafo interativo, centralidade e métricas estruturais.', conteudo: <EcologiaSNA /> },
    { chave: 'metricas-globais', titulo: 'Métricas do grafo global', icone: <Activity size={20} aria-hidden />,
      descricao: 'Densidade, eficiência, entropia, influência estrutural e ecologia profunda da rede de documentos.', conteudo: <MetricasGlobais /> },
  ],
  dados: [
    { chave: 'boxplot', titulo: 'Boxplot de Especialização (QL)', icone: <Boxes size={20} aria-hidden />,
      descricao: 'Quociente Locacional de até cinco entidades nos três níveis acadêmicos.', conteudo: <BoxplotEspecializacao /> },
    { chave: 'base-sna', titulo: 'Base de dados com métricas SNA', icone: <Database size={20} aria-hidden />,
      descricao: 'Um registro por linha, com os metadados originais e a posição do documento no grafo global.', conteudo: <BaseComSNA /> },
    { chave: 'exportar-rede', titulo: 'Exportação da rede', icone: <Download size={20} aria-hidden />,
      descricao: 'O grafo global em GEXF, GraphML ou JSON, para Gephi, Cytoscape e afins.', conteudo: <ExportarRede /> },
  ],
};

/**
 * Análise Avançada — a tela estrutural, temporal e conceitual do EcoGrad.
 *
 * Reúne o que antes eram três páginas separadas (Exploração Global, Foresight e
 * Memética) em abas agrupadas por pergunta, e não por origem: a propagação dos
 * termos fica junto da análise temática, e a rede memética junto do espaço
 * topológico, porque é assim que elas são lidas.
 *
 * Cada bloco só monta quando a janela dele abre. Os gráficos pesados — e há
 * muitos aqui — carregam sob demanda, em vez de todos de uma vez.
 */
export function AnaliseAvancada() {
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);
  const docs = useEcoGradStore((s) => s.docs);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Microscope size={22} aria-hidden /> Análise Avançada
          </h1>
          <Dica rotulo="Como ler: Análise Avançada">
            <p>Todos os índices desta página são relativos ao recorte ativo — mudam quando as coleções mudam. Nenhum deles mede qualidade, impacto ou mérito acadêmico, e nenhum substitui a leitura dos trabalhos.</p>
            <p>Os cálculos mais pesados têm botão próprio, para que a página abra rápido e você escolha o que rodar. Eles seguem em segundo plano se você trocar de aba ou fechar a janela.</p>
            <ul className="space-y-1">{ABAS_AVANCADA.map((aba) => <li key={aba}><strong>{ROTULOS_ABA[aba]}</strong> — {RESUMO_ABA[aba]}</li>)}</ul>
          </Dica>
        </div>
        <p className="text-sm text-slate-400">Base: {rotulo} · {docs.length.toLocaleString('pt-BR')} registros</p>
      </header>

      <RecorteAtivo />

      <Tabs
        chaveSessao="avancada"
        abas={ABAS_AVANCADA.map((aba) => ({
          valor: aba,
          rotulo: ROTULOS_ABA[aba],
          conteudo: (
            <div role="group" aria-label={`Análises de ${ROTULOS_ABA[aba]}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BLOCOS_ABA[aba].map((b) => (
                <BlocoEmJanela key={b.chave} chaveSessao={b.chave} titulo={b.titulo} descricao={b.descricao} icone={b.icone}>
                  {b.conteudo}
                </BlocoEmJanela>
              ))}
            </div>
          ),
        }))}
      />
    </div>
  );
}
