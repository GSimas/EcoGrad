import { useSessionField } from '@/hooks/useSessionField';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, Landmark } from 'lucide-react';
import { Aviso, Card, Carregando, Expander, Kpi, Tabela } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO, barrasHorizontais } from '@/components/ui/Chart';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { carregarCatalogoCapes, filtrarProgramasCapes, niveisPrograma, programaEmFuncionamento } from '@/lib/capes';
import { FonteCapes } from './FonteCapes';
import type { ProgramaCapes } from '@/types';

/**
 * Panorama Global da Pós-Graduação (UFSC) a partir da Plataforma Sucupira.
 * Independente da base carregada — sempre visível na tela inicial.
 * Transcrição de Principal.py:167-235.
 */
export function PanoramaCapes() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['catalogo-capes', 2],
    queryFn: ({ signal }) => carregarCatalogoCapes(signal),
  });

  const [fNivel, setFNivel] = useSessionField<string[] | null>('capes.nivel', null);
  const [fModalidade, setFModalidade] = useSessionField<string[] | null>('capes.modalidade', null);
  const [fNota, setFNota] = useSessionField<string[] | null>('capes.nota', null);

  const ativos = useMemo<ProgramaCapes[]>(() => {
    if (!data) return [];
    return Object.values(data.programas).filter(programaEmFuncionamento);
  }, [data]);

  const opcoesNivel = useMemo(() => [...new Set(ativos.flatMap(niveisPrograma))].sort(), [ativos]);
  const opcoesModalidade = useMemo(
    () => [...new Set(ativos.map((p) => p.Modalidade).filter(Boolean))].sort(),
    [ativos],
  );
  const opcoesNota = useMemo(
    () => [...new Set(ativos.map((p) => p.Nota).filter(Boolean))].sort().reverse(),
    [ativos],
  );

  const nivelSel = fNivel ?? opcoesNivel;
  const modalidadeSel = fModalidade ?? opcoesModalidade;
  const notaSel = fNota ?? opcoesNota;

  const restaurarFiltros = () => { setFNivel(null); setFModalidade(null); setFNota(null); };
  const filtrados = useMemo(() => filtrarProgramasCapes(ativos, {
    niveis: fNivel, modalidades: fModalidade, notas: fNota,
  }), [ativos, fNivel, fModalidade, fNota]);

  const porGrandeArea = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of filtrados) {
      const a = p['Grande Área'] || 'Não informado';
      c.set(a, (c.get(a) ?? 0) + 1);
    }
    return [...c.entries()].sort((x, y) => y[1] - x[1]);
  }, [filtrados]);

  const porNota = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of filtrados) c.set(p.Nota || 'N/I', (c.get(p.Nota || 'N/I') ?? 0) + 1);
    return [...c.entries()].sort((x, y) => x[0].localeCompare(y[0]));
  }, [filtrados]);

  if (isLoading) return <Carregando texto="Carregando catálogo da CAPES..." />;

  if (!data) {
    return (
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Landmark size={20} /> Panorama Global da Pós-Graduação (UFSC)
        </h2>
        <Aviso tipo="aviso">
          Panorama CAPES indisponível no momento
          {error instanceof Error
            ? `: ${error.message}`
            : '. O catálogo ainda não está disponível.'}
        </Aviso>
        <button type="button" className="btn" disabled={isFetching} onClick={() => void refetch()}>
          {isFetching ? 'Consultando CAPES...' : 'Tentar novamente'}
        </button>
      </section>
    );
  }

  const contexto = { fonte: data.fonte, baseVersao: null, colecoes: null, registrosCarregados: null, periodoObservado: null, entidade: null, pagina: 'Panorama CAPES', filtros: { nivel: nivelSel, modalidade: modalidadeSel, nota: notaSel }, limites: 'Programas em funcionamento, contados por código. Não é uma correspondência com coleções locais. A data da consulta não é a data de atualização da CAPES.' };
  const excelencia = filtrados.filter((p) => p.Nota === '6' || p.Nota === '7').length;
  const grandesAreas = new Set(filtrados.map((p) => p['Grande Área'])).size;

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Landmark size={20} /> Panorama Global da Pós-Graduação (UFSC)
        </h2>
        <p className="text-sm text-slate-400">
          Visão macro institucional baseada nos dados oficiais da Plataforma Sucupira (CAPES).
        </p>
      </div>

      <FonteCapes catalogo={data} />
      <p className="text-sm text-slate-400">
        {ativos.length} programas em funcionamento de {data.fonte.totalProgramas} registros oficiais.
        {' '}O panorama inclui somente situação “Em funcionamento” ou “Ativo”; demais situações ficam fora das contagens.
        {' '}Programas de mesmo nome e códigos diferentes são contados separadamente.
      </p>
      {isError && <Aviso tipo="aviso">Não foi possível atualizar a consulta. Os últimos dados obtidos continuam visíveis, com a data indicada acima.</Aviso>}
      <button type="button" className="btn self-start" disabled={isFetching} onClick={() => void refetch()}>
        {isFetching ? 'Consultando CAPES...' : 'Atualizar consulta CAPES'}
      </button>

      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Filter size={16} aria-hidden /> Filtros do Panorama</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <MultiSelect
            acoesSelecao
            rotulo="Nível"
            opcoes={opcoesNivel}
            selecionados={nivelSel}
            onChange={setFNivel}
          />
          <MultiSelect
            acoesSelecao
            rotulo="Modalidade"
            opcoes={opcoesModalidade}
            selecionados={modalidadeSel}
            onChange={setFModalidade}
          />
          <MultiSelect
            acoesSelecao
            rotulo="Nota CAPES"
            opcoes={opcoesNota}
            selecionados={notaSel}
            onChange={setFNota}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn" onClick={restaurarFiltros}>Restaurar filtros</button>
          <p role="status" className="text-sm text-slate-300">Exibindo {filtrados.length} de {ativos.length} programas em funcionamento.</p>
        </div>
        <p className="mt-2 text-xs text-slate-400">Selecione ao menos uma opção em cada filtro. Programas com mestrado e doutorado contam uma única vez. Conceitos não numéricos são apresentados como recebidos da CAPES, sem conversão para nota numérica.</p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Programas (PPGs)" valor={filtrados.length} />
        <Kpi rotulo="Excelência (6/7)" valor={excelencia} />
        <Kpi rotulo="Grandes Áreas" valor={grandesAreas} />
        <Kpi rotulo="Modalidades" valor={new Set(filtrados.map((p) => p.Modalidade)).size} />
      </div>

      {filtrados.length === 0 ? (
        <Aviso>Nenhum programa corresponde à seleção atual. Selecione opções em todos os filtros ou use “Restaurar filtros”.</Aviso>
      ) : <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Grafico leitura={{ titulo: 'Programas por grande área', descricao: 'Barras: número de programas em funcionamento (n) por grande área, após os filtros. Códigos distintos contam separadamente.', linhas: porGrandeArea.map(([area,total])=>({area,total})), colunas:[{chave:'area',rotulo:'Grande área'},{chave:'total',rotulo:'Programas (n)'}], contexto }} option={barrasHorizontais(porGrandeArea, 'Distribuição por Grande Área', undefined, 'Programas (n)')} larguraMinima={460} altura={400} />
        </Card>
        <Card>
          <Grafico
            leitura={{ titulo: 'Programas por conceito CAPES', descricao: 'Setores: número de programas (n) por conceito oficial, após os filtros. Conceitos não numéricos são preservados.', linhas: porNota.map(([nota,total])=>({nota,total})), colunas:[{chave:'nota',rotulo:'Conceito CAPES'},{chave:'total',rotulo:'Programas (n)'}], contexto }}
            altura={400}
            option={{
              title: { text: 'Conceito CAPES', left: 'center', textStyle: { fontSize: 13, color: TEMA_GRAFICO.texto } },
              tooltip: { trigger: 'item' },
              legend: { bottom: 0, textStyle: { color: TEMA_GRAFICO.texto } },
              series: [
                {
                  type: 'pie',
                  radius: ['40%', '65%'],
                  center: ['50%', '48%'],
                  data: porNota.map(([nome, valor]) => ({ name: `Nota ${nome}`, value: valor })),
                  label: { color: '#FFFFFF', backgroundColor: '#0E1117', padding: [3, 5], borderRadius: 3, position: 'inside', formatter: '{d}%' },
                  labelLayout: {hideOverlap:true},
                  itemStyle: { borderColor: '#0E1117', borderWidth: 2 },
                },
              ],
            }}
          />
        </Card>
      </div>

      <Expander titulo={`Tabela Completa de Programas (${filtrados.length})`}>
        <Tabela
              titulo="Programas CAPES"
              contexto={contexto}
          altura="max-h-[420px]"
          colunas={[
            { chave: 'Nome', rotulo: 'Nome' },
            { chave: 'Código', rotulo: 'Código' },
            { chave: 'Grande Área', rotulo: 'Grande Área' },
            { chave: 'Nota', rotulo: 'Nota' },
            { chave: 'Modalidade', rotulo: 'Modalidade' },
            { chave: 'Grau Acadêmico', rotulo: 'Grau' },
          ]}
          linhas={[...filtrados].sort((a, b) => a.Nome.localeCompare(b.Nome, 'pt-BR')) as unknown as Array<Record<string, unknown>>}
        />
      </Expander>
      </>}
    </section>
  );
}
