import { useMemo } from 'react';
import { Database } from 'lucide-react';
import { Aviso, Card, Tabela, TextoDoAcervo, type ColunaTabela } from '@/components/ui/primitives';
import { linhasBaseSNA, maximosBaseSNA, type LinhaBaseSNA } from '@/lib/base-sna';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { CabecalhoBloco } from '@/components/ui/BlocoEmJanela';

/**
 * Base de dados completa com métricas SNA.
 * Transcrição de `Principal.py:1195-1239`. As barras nas colunas de grau,
 * betweenness e closeness substituem o `st.column_config.ProgressColumn`.
 */
export function BaseComSNA() {
  const docs = useEcoGradStore((s) => s.docs);
  const sna = useEcoGradStore((s) => s.snaGlobal);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);

  const linhas = useMemo(() => linhasBaseSNA(docs, sna), [docs, sna]);
  const maximos = useMemo(() => maximosBaseSNA(linhas), [linhas]);

  const colunas: Array<ColunaTabela<LinhaBaseSNA>> = [
    { chave: 'Título', rotulo: 'Título completo', className: 'max-w-md' },
    // Anos são identificadores, não quantidades: sem separador de milhar.
    { chave: 'Ano', rotulo: 'Ano', render: (l: LinhaBaseSNA) => l.Ano === null ? 'Sem ano' : String(l.Ano) },
    { chave: 'Nível', rotulo: 'Nível acadêmico' },
    { chave: 'Autores', rotulo: 'Autores', className: 'max-w-xs' },
    { chave: 'Orientador', rotulo: 'Orientador', className: 'max-w-xs' },
    { chave: 'Co-orientadores', rotulo: 'Co-orientadores', className: 'max-w-xs' },
    { chave: 'Palavras-chave', rotulo: 'Palavras-chave', className: 'max-w-xs' },
    { chave: 'Macrotema', rotulo: 'Macrotema', className: 'max-w-xs' },
    { chave: 'Coleção', rotulo: 'Coleção de origem', className: 'max-w-xs' },
    { chave: 'Grau (SNA)', rotulo: 'Grau absoluto (conexões)', barra: { max: maximos.grau } },
    { chave: 'Betweenness (SNA)', rotulo: 'Betweenness (índice)', barra: { max: maximos.betweenness } },
    { chave: 'Closeness (SNA)', rotulo: 'Closeness (índice)', barra: { max: maximos.closeness } },
    { chave: 'Comunidade (SNA)', rotulo: 'Comunidade (identificador)', render: (l: LinhaBaseSNA) => String(l['Comunidade (SNA)']) },
    { chave: 'Ranking Global (SNA)', rotulo: 'Posição por betweenness', render: (l: LinhaBaseSNA) => String(l['Ranking Global (SNA)']) },
    {
      chave: 'Resumo',
      rotulo: 'Resumo',
      className: 'max-w-md',
      render: (l: LinhaBaseSNA) => l.Resumo
        ? <details><summary className="min-h-11 cursor-pointer text-eco-accent">Ver resumo</summary><TextoDoAcervo texto={l.Resumo} className="whitespace-pre-line" /></details>
        : 'Sem resumo',
    },
    {
      chave: 'Fonte',
      rotulo: 'Fonte no repositório',
      className: 'max-w-xs',
      render: (l: LinhaBaseSNA) => l.Fonte
        ? <a className="text-eco-accent underline-offset-2 hover:underline" href={l.Fonte} target="_blank" rel="noreferrer">Abrir no repositório</a>
        : 'Sem link',
    },
  ];

  return (
    <section className="space-y-4">
      <CabecalhoBloco titulo="Base de dados completa com métricas SNA" icone={<Database size={18} aria-hidden />}>
        <p>Um registro por linha, com os metadados originais e a posição do documento no grafo global.</p>
        <div className="space-y-2">
          <p>As métricas são as do nó do <strong>documento</strong> no grafo global: <strong>grau absoluto</strong> conta autores, orientador, palavras-chave, macrotema e artefatos ligados àquele registro — ou seja, mede sobretudo quão preenchidos estão os metadados dele.</p>
          <p><strong>Betweenness</strong> e <strong>closeness</strong> situam o documento na rede inteira; <strong>comunidade</strong> é o agrupamento do Louvain; <strong>posição por betweenness</strong> é o ranking global, em que 1 é o nó de maior intermediação de toda a rede — documentos, pessoas e termos disputam o mesmo ranking.</p>
          <p>Todas mudam quando o recorte muda, e nenhuma mede impacto, citação, qualidade ou relevância do trabalho. Um registro com muitas palavras-chave sobe no grau sem que isso diga nada sobre o conteúdo.</p>
          <p>A tabela exporta em CSV e JSON com o contexto da análise, sempre com todas as linhas filtradas — não apenas a página visível.</p>
        </div>
      </CabecalhoBloco>

      {!sna && (
        <Aviso tipo="aviso">
          {statusSNA === 'calculando'
            ? 'A rede global ainda está sendo calculada. As colunas de SNA aparecem como zero até ela terminar; os metadados já estão completos.'
            : 'A rede global não está disponível nesta sessão, então as colunas de SNA aparecem como zero. Os metadados não dependem dela.'}
        </Aviso>
      )}


      <Card>
        <Tabela
          titulo="Base de dados completa com métricas SNA"
          descricao="Um registro por linha, na ordem da base carregada. Contagens em unidades; betweenness e closeness são índices adimensionais; comunidade e posição são identificadores. Abrir leva o trabalho ao Motor de Busca."
          contexto={{ redeCalculada: statusSNA === 'pronto', metricasDoNo: 'Documento' }}
          altura="max-h-[640px]"
          onAbrir={(l) => navegarPara('Documento', String(l.Título))}
          linhas={linhas}
          colunas={colunas}
        />
      </Card>
    </section>
  );
}
