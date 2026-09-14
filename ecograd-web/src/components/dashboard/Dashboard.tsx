import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { Kpi, Expander } from '@/components/ui/primitives';
import { Destaques } from './Destaques';
import { FichaTecnica } from './FichaTecnica';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { Atividade } from '@/components/ui/Atividade';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import { Trabalhos } from '@/components/results/Trabalhos';
import { CoberturaAnalise } from '@/components/results/CoberturaAnalise';
import { Relacoes } from '@/components/results/Relacoes';
import { ComparacaoColecoes } from './ComparacaoColecoes';
import { resumoRegistros, periodoTexto } from '@/lib/resultados';
import { formatarDecimal } from '@/lib/utils';

/** Resultados do recorte, trabalhos e comparação; métodos disponíveis sob demanda. */
export function Dashboard() {
  const { docs, conjuntos, contagens, niveis } = useDadosDerivados();
  const snaGlobal = useEcoGradStore((s) => s.snaGlobal);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const maturidade = useEcoGradStore((s) => s.maturidade);
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);

  const ppg = useEcoGradStore((s) => s.programasSelecionados);
  const tcc = useEcoGradStore((s) => s.cursosTccSelecionados);
  const navegar = useEcoGradStore((s) => s.navegarPara);
  const nomes = useMemo(() => [...new Set([...ppg, ...tcc, ...docs.map((d) => d.programa_origem)])].sort(), [docs, ppg, tcc]);
  const cobertura = useMemo(() => resumoRegistros(docs), [docs]);
  const docsPpg = useMemo(() => docs.filter((d) => ppg.includes(d.programa_origem) && !tcc.includes(d.programa_origem)), [docs, ppg, tcc]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Explore a produção das coleções</h1>
        <p className="text-sm text-slate-400">Base: {rotulo}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Registros carregados" valor={docs.length} detalhe="Não necessariamente trabalhos únicos" />
        <Kpi
          rotulo="Trabalhos únicos"
          valor={cobertura.trabalhosUnicos}
          detalhe={`${cobertura.comFonte - cobertura.fontesDistintas} registros repetem um link`}
          ajuda="Links distintos do repositório somados aos registros sem link, que não são deduplicáveis e contam um cada. Nada é fundido por semelhança de título; não é deduplicação científica."
        />
        <Kpi rotulo="Coleções selecionadas" valor={nomes.length} />
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
      </div>
      <CoberturaAnalise docs={docs} />
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn" onClick={() => navegar('Documento', null)}>Buscar um trabalho pelo título</button>
        <button type="button" className="btn" onClick={() => navegar('Palavra-chave', null)}>Investigar um tema</button>
        <button type="button" className="btn" onClick={() => navegar('Orientador', null)}>Buscar orientador pelo nome</button>
      </div>
      {nomes.length > 1 && <ComparacaoColecoes docs={docs} nomes={nomes} tcc={tcc} ppg={ppg} />}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Fontes e contexto institucional</h2>
        {tcc.length > 0 && <p className="text-sm text-slate-300">O catálogo de TCCs inclui graduação ou especialização; há {tcc.length} {tcc.length === 1 ? 'coleção selecionada' : 'coleções selecionadas'}. Essas coleções não recebem nota de programa CAPES. Tipos inconsistentes ou “Outros” são mantidos como registrados na base.</p>}
        {ppg.length > 0 ? <Expander titulo="Consultar vínculos CAPES e síntese por IA" lazy><FichaTecnica docs={docsPpg} programas={ppg.filter((n) => !tcc.includes(n))} /></Expander> : <p className="text-sm text-slate-300">Não há coleção de pós-graduação selecionada para a ficha institucional. O Panorama CAPES continua disponível no menu.</p>}
      </section>
      <Expander titulo="Indicadores e métodos da rede" lazy>
      <p className="mb-4 text-sm text-slate-300">Indicadores descritivos do conjunto carregado. Centralidade, volume e comunidade não são avaliações de mérito das pessoas ou trabalhos. Nomes podem representar homônimos.</p>
      <Atividade id="sna-global" />
      <Atividade id="maturidade" />

      {statusSNA === 'pronto' && maturidade && (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Activity size={18} /> Maturidade e Robustez Topológica
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  rotulo="Assortatividade"
                  valor={formatarDecimal(maturidade.Assortatividade, 3)}
                  detalhe={maturidade.Assortatividade < 0 ? 'Rede disassortativa (hubs ligam periferia)' : 'Hubs se conectam entre si'}
                />
                <Kpi
                  rotulo="Rich-Club (top 20%)"
                  valor={formatarDecimal(maturidade.Rich_Club, 3)}
                  detalhe="Probabilidade de conexão entre os maiores hubs"
                />
                <Kpi
                  rotulo="Expoente γ"
                  valor={formatarDecimal(maturidade.Gamma, 3)}
                  detalhe="Estimativa do expoente; isoladamente não comprova regime livre de escala"
                />
                <Kpi
                  rotulo="Spearman (Grau × Bet.)"
                  valor={formatarDecimal(maturidade.Spearman, 3)}
                  detalhe="Correlação entre hubs e brokers"
                />
              </div>
            </section>
      )}
      </Expander>
      <Destaques
        docs={docs}
        snaGlobal={snaGlobal}
        contagens={contagens}
        conjuntos={conjuntos}
        niveis={niveis}
        statusSNA={statusSNA}
      />
      <Trabalhos docs={docs} sessionKey="dashboard.trabalhos" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Relacoes docs={docs} tipo="Palavra-chave" titulo="Temas para começar a exploração" />
        <Relacoes docs={docs} tipo="Orientador" titulo="Orientadores presentes no recorte" />
      </div>
    </div>
  );
}
