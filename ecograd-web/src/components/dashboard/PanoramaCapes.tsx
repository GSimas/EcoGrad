import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark } from 'lucide-react';
import { Aviso, Card, Carregando, Expander, Kpi, Tabela } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO, barrasHorizontais } from '@/components/ui/Chart';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { carregarCatalogoCapes } from '@/lib/capes';
import type { ProgramaCapes } from '@/types';

/**
 * Panorama Global da Pós-Graduação (UFSC) a partir da Plataforma Sucupira.
 * Independente da base carregada — sempre visível na tela inicial.
 * Transcrição de Principal.py:167-235.
 */
export function PanoramaCapes() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['catalogo-capes'],
    queryFn: ({ signal }) => carregarCatalogoCapes(signal),
  });

  const [fNivel, setFNivel] = useState<string[]>(['Mestrado', 'Doutorado']);
  const [fModalidade, setFModalidade] = useState<string[] | null>(null);
  const [fNota, setFNota] = useState<string[] | null>(null);

  const ativos = useMemo<ProgramaCapes[]>(() => {
    if (!data) return [];
    // Mantém apenas programas em funcionamento (idem ao filtro de 'Situação')
    return Object.values(data).filter((p) => {
      const s = (p.Situação ?? '').toUpperCase();
      return s === '' || s.includes('FUNCIONAMENTO') || s.includes('ATIVO');
    });
  }, [data]);

  const opcoesModalidade = useMemo(
    () => [...new Set(ativos.map((p) => p.Modalidade).filter(Boolean))].sort(),
    [ativos],
  );
  const opcoesNota = useMemo(
    () => [...new Set(ativos.map((p) => p.Nota).filter(Boolean))].sort().reverse(),
    [ativos],
  );

  const modalidadeSel = fModalidade ?? opcoesModalidade;
  const notaSel = fNota ?? opcoesNota;

  const filtrados = useMemo(() => {
    return ativos.filter((p) => {
      if (fNivel.length > 0) {
        const grau = p['Grau Acadêmico'] ?? '';
        const casa =
          (fNivel.includes('Mestrado') && grau.includes('Mestrado')) ||
          (fNivel.includes('Doutorado') && grau.includes('Doutorado'));
        if (!casa) return false;
      }
      if (modalidadeSel.length > 0 && !modalidadeSel.includes(p.Modalidade)) return false;
      if (notaSel.length > 0 && !notaSel.includes(p.Nota)) return false;
      return true;
    });
  }, [ativos, fNivel, modalidadeSel, notaSel]);

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

  if (isError || !data || ativos.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Landmark size={20} /> Panorama Global da Pós-Graduação (UFSC)
        </h2>
        <Aviso tipo="aviso">
          Panorama CAPES indisponível no momento
          {error instanceof Error ? `: ${error.message}` : '.'} A função{' '}
          <code>capes-proxy</code> precisa estar publicada (rode <code>netlify dev</code> localmente).
        </Aviso>
      </section>
    );
  }

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

      <Card>
        <h3 className="mb-3 text-sm font-semibold">🔍 Filtros do Panorama</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <MultiSelect
            rotulo="Nível"
            opcoes={['Mestrado', 'Doutorado']}
            selecionados={fNivel}
            onChange={setFNivel}
          />
          <MultiSelect
            rotulo="Modalidade"
            opcoes={opcoesModalidade}
            selecionados={modalidadeSel}
            onChange={setFModalidade}
          />
          <MultiSelect
            rotulo="Nota CAPES"
            opcoes={opcoesNota}
            selecionados={notaSel}
            onChange={setFNota}
          />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Programas (PPGs)" valor={filtrados.length} />
        <Kpi rotulo="Excelência (6/7)" valor={excelencia} />
        <Kpi rotulo="Grandes Áreas" valor={grandesAreas} />
        <Kpi rotulo="Modalidades" valor={new Set(filtrados.map((p) => p.Modalidade)).size} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Grafico option={barrasHorizontais(porGrandeArea, 'Distribuição por Grande Área')} altura={400} />
        </Card>
        <Card>
          <Grafico
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
                  label: { color: TEMA_GRAFICO.texto },
                  itemStyle: { borderColor: '#0E1117', borderWidth: 2 },
                },
              ],
            }}
          />
        </Card>
      </div>

      <Expander titulo={`Tabela Completa de Programas (${filtrados.length})`}>
        <Tabela
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
    </section>
  );
}
