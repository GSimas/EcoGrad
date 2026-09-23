import { Download } from 'lucide-react';
import { Aviso, Card } from '@/components/ui/primitives';
import { Atividade } from '@/components/ui/Atividade';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { emExecucao, useAtividade, useSnaWorker } from '@/hooks/useSnaWorker';
import { useSessionField } from '@/hooks/useSessionField';
import { baixarArquivo, formatarNumero } from '@/lib/utils';
import { EXTENSAO_GRAFO, FORMATOS_GRAFO, MIME_GRAFO, type FormatoGrafo } from '@/lib/exportar-grafo';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import { CabecalhoBloco } from '@/components/ui/BlocoEmJanela';

/** Nome de arquivo derivado da análise ativa, sem acentos nem espaços. */
function nomeArquivo(rotulo: string, formato: FormatoGrafo): string {
  const base = rotulo
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `ecograd-rede-${base || 'selecao'}.${EXTENSAO_GRAFO[formato]}`;
}

/**
 * Exportação da rede em GEXF, GraphML e JSON node-link.
 * Transcrição de `preparar_exportacao_grafo` (backend.py:1289) e do bloco de
 * download de `pages/1_Avançado.py:460-480`.
 */
export function ExportarRede() {
  const docs = useEcoGradStore((s) => s.docs);
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);
  const { exportarGrafoGlobal } = useSnaWorker();
  const task = useAtividade('exportar-grafo');
  const exportando = emExecucao(task);
  const [formato, setFormato] = useSessionField<FormatoGrafo>('exportacao.grafo.formato', 'GEXF (Gephi)');

  const ultima = task?.resultado?.type === 'exportar-grafo' ? task.resultado : null;

  const exportar = () => {
    exportarGrafoGlobal(docs, formato, (r) => {
      if (r.type !== 'exportar-grafo') return;
      baixarArquivo(r.conteudo, nomeArquivo(rotulo, r.formato), MIME_GRAFO[r.formato]);
    });
  };

  return (
    <section className="space-y-4">
      <CabecalhoBloco titulo="Exportação da rede" icone={<Download size={18} aria-hidden />}>
        <p>Leva o grafo global da seleção para Gephi, Cytoscape ou qualquer ferramenta que leia GEXF, GraphML ou JSON node-link.</p>
        <p>O arquivo é montado em segundo plano e o download começa sozinho ao terminar. Redes grandes levam alguns segundos.</p>
        <div className="space-y-2">
          <p>Sai a <strong>rede global completa</strong> da seleção ativa: um nó por documento, autor, orientador, palavra-chave, macrotema e artefato da ontologia, e uma aresta para cada vínculo entre o documento e essas entidades. Não é o recorte visual dos grafos desenhados na tela, que limitam o desenho aos nós de maior grau.</p>
          <p>Cada nó leva o atributo <code>tipo</code>, que é a categoria usada em todo o EcoGrad. O grafo é não-dirigido e sem pesos: uma aresta existe ou não existe, e repetições do mesmo par não a duplicam. Métricas de centralidade <strong>não</strong> vão no arquivo — recalcule-as na ferramenta de destino, para que sejam as dela.</p>
          <p>O identificador do nó é o texto da entidade como está nos metadados, com as fusões de pessoa desta sessão já aplicadas. Homônimos continuam colapsados num nó só, e grafias diferentes da mesma pessoa continuam separadas, salvo o que você tenha unificado.</p>
          <p>GEXF e GraphML são XML e abrem direto no Gephi. JSON node-link segue o formato do <code>networkx.node_link_data</code>, que o Cytoscape e o D3 leem.</p>
        </div>
      </CabecalhoBloco>

      <Card className="space-y-4">
        <GrupoOpcoes rotulo="Formato do arquivo" opcoes={FORMATOS_GRAFO} valor={formato} onChange={setFormato} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={exportar} disabled={exportando || docs.length === 0}>
            <Download size={14} />
            {exportando ? 'Preparando o arquivo…' : `Baixar a rede em ${formato}`}
          </button>
        </div>
        <Atividade id="exportar-grafo" />
        {ultima && !exportando && (
          <p className="text-sm text-slate-300" role="status">
            Último arquivo gerado: {ultima.formato}, com {formatarNumero(ultima.nos)} nós e {formatarNumero(ultima.arestas)} conexões.{' '}
            <button type="button" className="text-eco-accent underline-offset-2 hover:underline" onClick={() => baixarArquivo(ultima.conteudo, nomeArquivo(rotulo, ultima.formato), MIME_GRAFO[ultima.formato])}>
              Baixar novamente
            </button>
          </p>
        )}
        {docs.length === 0 && <Aviso tipo="aviso">Não há documentos na seleção carregada, então não há rede a exportar.</Aviso>}
      </Card>

    </section>
  );
}
