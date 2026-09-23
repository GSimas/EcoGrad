import { useMemo } from 'react';
import { BookOpenText, Layers, Trophy } from 'lucide-react';
import { BlocoEmJanela } from '@/components/ui/BlocoEmJanela';
import { Carrossel } from '@/components/ui/Carrossel';
import { AnalisesOcultas, Kpi, Expander } from '@/components/ui/primitives';
import type { AnaliseOculta } from '@/lib/relevancia';
import { Destaques } from './Destaques';
import { FichaTecnica } from './FichaTecnica';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import { Trabalhos } from '@/components/results/Trabalhos';
import { CoberturaAnalise } from '@/components/results/CoberturaAnalise';
import { CoberturaTemporal } from '@/components/results/CoberturaTemporal';
import { Relacoes } from '@/components/results/Relacoes';
import { ComparacaoColecoes, TiposFontePorColecao } from './ComparacaoColecoes';
import { resumoRegistros, periodoTexto } from '@/lib/resultados';
import { RecorteAtivo } from '@/components/layout/RecorteAtivo';

/** Indicadores e temas à vista; destaques, trabalhos e fontes abrem em janelas a partir de três botões. */
export function Dashboard() {
  const { docs, conjuntos, contagens, niveis } = useDadosDerivados();
  const snaGlobal = useEcoGradStore((s) => s.snaGlobal);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);

  const recortada = useEcoGradStore((s) => s.recorte.some((i) => i.tipo !== 'Coleção'));
  const ppg = useEcoGradStore((s) => s.programasSelecionados);
  const tcc = useEcoGradStore((s) => s.cursosTccSelecionados);
  const nomes = useMemo(() => [...new Set([...ppg, ...tcc, ...docs.map((d) => d.programa_origem)])].sort(), [docs, ppg, tcc]);
  const cobertura = useMemo(() => resumoRegistros(docs), [docs]);
  const docsPpg = useMemo(() => docs.filter((d) => ppg.includes(d.programa_origem) && !tcc.includes(d.programa_origem)), [docs, ppg, tcc]);

  /**
   * Colunas que o mapa de cobertura teria. Com uma só, o heatmap vira uma
   * tira e o gráfico de volume, uma barra: os números já estão na cobertura
   * em texto, logo acima. Um único ano não permite intervalo contínuo, então
   * `resumoRegistros` basta para decidir sem refazer o cálculo do mapa.
   */
  const colunasCobertura = cobertura.anos + (cobertura.semAno > 0 ? 1 : 0);
  const ocultas: AnaliseOculta[] = [
    ...(colunasCobertura > 1 ? [] : [{
      nome: 'Cobertura de metadados por ano',
      motivo: colunasCobertura === 0 ? 'não há registros a mapear' : 'os registros cabem em uma única coluna do mapa',
    }]),
    ...(nomes.length > 1 ? [] : [{
      nome: 'Comparar coleções',
      motivo: 'há uma só coleção no recorte, sem par a comparar',
    }]),
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{recortada ? 'Explore o recorte selecionado' : 'Explore a produção das coleções'}</h1>
        <p className="text-sm text-slate-400">Base: {rotulo}</p>
      </header>

      <RecorteAtivo />

      {/* Indicadores num carrossel lateral; a cobertura do recorte vira a dica "i" do cabeçalho. */}
      <Carrossel rotulo="Indicadores do recorte" cabecalho={<CoberturaAnalise docs={docs} emDica />}>
        <Kpi rotulo="Registros carregados" valor={docs.length} detalhe="Não necessariamente trabalhos únicos" />
        <Kpi
          rotulo="Trabalhos únicos"
          valor={cobertura.trabalhosUnicos}
          detalhe={`${cobertura.comFonte - cobertura.fontesDistintas} registros repetem um link`}
          ajuda="Links distintos do repositório somados aos registros sem link, que não são deduplicáveis e contam um cada. Nada é fundido por semelhança de título; não é deduplicação científica."
        />
        <Kpi rotulo={recortada ? 'Coleções de origem' : 'Coleções selecionadas'} valor={nomes.length}
          detalhe={recortada ? 'Baixadas para alcançar o recorte' : undefined} />
        <Kpi rotulo="Período observado" valor={periodoTexto(cobertura)} detalhe={`${cobertura.semAno} registros sem ano`} />
        <Kpi rotulo="Resumos disponíveis" valor={`${cobertura.comResumo}/${docs.length}`} />
        <Kpi
          rotulo="Autores"
          valor={conjuntos.autores.size}
          detalhe="Nomes distintos na autoria"
          ajuda="Contagem de nomes, não de pessoas: homônimos colapsam num nome só e grafias diferentes da mesma pessoa contam separado."
        />
        <Kpi
          rotulo="Orientadores"
          valor={conjuntos.orientadores.size}
          detalhe="Nomes distintos na orientação"
          ajuda="Contagem de nomes, não de pessoas. Quem também coorienta aparece nos dois blocos."
        />
        <Kpi
          rotulo="Coorientadores"
          valor={conjuntos.coorientadores.size}
          detalhe="Nomes distintos na coorientação"
          ajuda="Contagem de nomes, não de pessoas. Quem também orienta aparece nos dois blocos."
        />
        <Kpi
          rotulo="Palavras-chave"
          valor={conjuntos.keywords.size}
          detalhe="Termos distintos declarados"
          ajuda="Termos como vieram da base, sem unificação de sinônimos, plural ou grafia."
        />
        <Kpi
          rotulo="Macrotemas"
          valor={contagens.macrotemas.size}
          detalhe="Classes atribuídas pelo pipeline"
          ajuda="Macrotemas são atribuídos por `pipeline_ufsc.py` (NMF + Gemini), não declarados pelos autores."
        />
      </Carrossel>

      {/* Três blocos longos viram botões: a página mostra o essencial e cada
          leitura detalhada abre numa janela, sem empurrar o resto para baixo. */}
      <div role="group" aria-label="Aprofundar a análise" className="grid gap-3 md:grid-cols-3">
        <BlocoEmJanela titulo="Destaques do Ecossistema" icone={<Trophy size={20} aria-hidden="true" />}
          descricao="Rankings por volume, genealogia acadêmica, intermediação e diagrama radial.">
          <Destaques
            docs={docs}
            snaGlobal={snaGlobal}
            contagens={contagens}
            conjuntos={conjuntos}
            niveis={niveis}
            statusSNA={statusSNA}
            semCabecalho
          />
        </BlocoEmJanela>
        <BlocoEmJanela titulo="Trabalhos para ler" icone={<BookOpenText size={20} aria-hidden="true" />}
          descricao={`${docs.length.toLocaleString('pt-BR')} registros, dos mais recentes aos mais antigos, com filtros por texto e coleção.`}>
          <Trabalhos docs={docs} sessionKey="dashboard.trabalhos" mostrarResumo={false} semCabecalho />
        </BlocoEmJanela>
        <BlocoEmJanela titulo="Fontes, cobertura e comparação das coleções" icone={<Layers size={20} aria-hidden="true" />}
          descricao="Contexto institucional, tipos de fonte, cobertura de metadados por ano e comparação entre coleções.">
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Fontes e contexto institucional</h2>
              {tcc.length > 0 && <p className="text-sm text-slate-300">O catálogo de TCCs inclui graduação ou especialização; há {tcc.length} {tcc.length === 1 ? 'coleção selecionada' : 'coleções selecionadas'}. Essas coleções não recebem nota de programa CAPES. Tipos inconsistentes ou “Outros” são mantidos como registrados na base.</p>}
              {ppg.length > 0 ? <Expander titulo="Consultar vínculos CAPES e síntese por IA" lazy><FichaTecnica docs={docsPpg} programas={ppg.filter((n) => !tcc.includes(n))} /></Expander> : <p className="text-sm text-slate-300">Não há coleção de pós-graduação selecionada para a ficha institucional. O Panorama UFSC continua disponível no menu.</p>}
            </section>
            <div className="space-y-2">
              <Expander titulo="Tipos e repetições de fonte por coleção" lazy>
                <TiposFontePorColecao docs={docs} nomes={nomes} />
              </Expander>
              {colunasCobertura > 1 && <Expander titulo="Cobertura de metadados por ano" lazy>
                <CoberturaTemporal docs={docs} />
              </Expander>}
              {nomes.length > 1 && <Expander titulo="Comparar coleções" lazy>
                <ComparacaoColecoes docs={docs} nomes={nomes} tcc={tcc} ppg={ppg} />
              </Expander>}
            </div>
            <AnalisesOcultas itens={ocultas} />
          </div>
        </BlocoEmJanela>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Relacoes docs={docs} tipo="Palavra-chave" titulo="Temas para começar a exploração" />
        <Relacoes docs={docs} tipo="Orientador" titulo="Orientadores presentes no recorte" />
      </div>
    </div>
  );
}
