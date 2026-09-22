import { Globe2 } from 'lucide-react';
import { Card, Expander } from '@/components/ui/primitives';
import { RecorteAtivo } from '@/components/layout/RecorteAtivo';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import { MapaTematico } from './MapaTematico';
import { EspacoTopologico } from './EspacoTopologico';
import { FurosEstruturais } from './FurosEstruturais';
import { BoxplotEspecializacao } from './BoxplotEspecializacao';
import { MetricasGlobais } from './MetricasGlobais';
import { ExportarRede } from './ExportarRede';
import { BaseComSNA } from './BaseComSNA';

/**
 * Exploração Global — a tela estrutural do EcoGrad.
 *
 * Reúne o que no Streamlit vivia nas abas "Exploração Global" e na tabela final
 * de `Principal.py`: análise temática, espaço topológico, furos estruturais,
 * especialização por nível, métricas do grafo global, exportação da rede e a
 * base completa com SNA. O Sankey Temporal ficou no Foresight, porque lá
 * também no original ele dividia a aba com o Radar de Prospecção.
 */
export function ExploracaoGlobal() {
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);
  const docs = useEcoGradStore((s) => s.docs);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Globe2 size={22} aria-hidden /> Exploração Global
        </h1>
        <p className="text-sm text-slate-400">Base: {rotulo} · {docs.length.toLocaleString('pt-BR')} registros</p>
      </header>

      <RecorteAtivo />

      <Card className="space-y-2 text-sm text-slate-300">
        <p>Esta página descreve a <strong>estrutura</strong> da seleção carregada: como temas, pessoas e conceitos se posicionam na rede, e como a produção se distribui entre os níveis acadêmicos.</p>
        <p>Todos os índices aqui são relativos ao recorte ativo — mudam quando as coleções mudam. Nenhum deles mede qualidade, impacto ou mérito acadêmico, e nenhum substitui a leitura dos trabalhos. Os cálculos mais pesados têm botão próprio, para que a página abra rápido e você escolha o que rodar.</p>
      </Card>

      <Expander titulo="Por onde começar">
        <div className="space-y-2 text-sm text-slate-300">
          <p><strong>Análise Temática Estrutural</strong> dá o panorama: quais macrotemas existem, com que volume, em que anos e quem se especializou neles.</p>
          <p><strong>Espaço Topológico</strong> e <strong>Métricas de redes complexas</strong> descrevem a forma da rede inteira. <strong>Furos Estruturais</strong> olha para os orientadores e o vocabulário que eles atravessam.</p>
          <p><strong>Boxplot de Especialização</strong> compara entidades entre Teses, Dissertações e Outros. <strong>Exportação da rede</strong> leva o grafo para Gephi ou Cytoscape, e a <strong>base completa</strong> mostra registro por registro.</p>
        </div>
      </Expander>

      <MapaTematico />
      <EspacoTopologico />
      <FurosEstruturais />
      <BoxplotEspecializacao />
      <MetricasGlobais />
      <ExportarRede />
      <BaseComSNA />
    </div>
  );
}
