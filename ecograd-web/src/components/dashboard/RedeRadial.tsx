import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { Aviso, Card } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { SelectBusca } from '@/components/ui/MultiSelect';
import { useSessionField } from '@/hooks/useSessionField';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { construirRedeRadial, PAPEL_COORIENTADOR, type ModoRadial } from '@/lib/rede-radial';
import { correspondeBusca, termosBusca } from '@/lib/utils';
import type { Documento, TipoBusca } from '@/types';

const OPCOES = ['Orientação conjunta', 'Palavras-chave (coocorrência)', 'Macrotemas (coocorrência)'] as const;
type Opcao = (typeof OPCOES)[number];

const MODO_DA_OPCAO: Record<Opcao, ModoRadial> = {
  'Orientação conjunta': 'supervisao',
  'Palavras-chave (coocorrência)': 'palavras',
  'Macrotemas (coocorrência)': 'macrotemas',
};

/** Quantos nós o desenho circular ainda consegue rotular sem virar borrão. */
const LIMITE_NOS = 60;

interface Props {
  docs: readonly Documento[];
}

/**
 * Diagrama radial de relações: nós dispostos em círculo, agrupados em arcos, e
 * arestas curvas ligando quem aparece junto no mesmo registro.
 *
 * Duas leituras, escolhidas pelo usuário: orientação conjunta (orientador e
 * coorientadores do mesmo trabalho) e coocorrência de palavras-chave.
 */
export function RedeRadial({ docs }: Props) {
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  const [opcao, setOpcao] = useSessionField<Opcao>('destaques.radial.modo', OPCOES[0]);
  const escolha: Opcao = OPCOES.includes(opcao) ? opcao : OPCOES[0];
  const modo = MODO_DA_OPCAO[escolha];

  const rede = useMemo(
    () => construirRedeRadial(docs, modo, { limiteNos: LIMITE_NOS }),
    [docs, modo],
  );

  // Destaque: o clique fixa um nó; a busca destaca os que casam com o texto.
  // O clique tem precedência, e clicar fora volta ao destaque da busca.
  const [selecionado, setSelecionado] = useState<string | null>(null);
  // Mesmo campo de sessão em que o `SelectBusca` guarda o texto digitado
  // ('busca.texto.' + sessionKey), um por modo.
  const [busca] = useSessionField('busca.texto.radial.' + modo, '');
  const nomesNos = useMemo(
    () => rede.nos.map((n) => n.id).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rede],
  );

  const trocarOpcao = (valor: Opcao) => {
    setOpcao(valor);
    setSelecionado(null);
  };

  const encontrados = useMemo(() => {
    const termos = termosBusca(busca);
    return termos.length ? rede.nos.filter((n) => correspondeBusca(n.id, termos)).map((n) => n.id) : [];
  }, [rede, busca]);

  const focais = useMemo(
    () => new Set(selecionado ? [selecionado] : encontrados),
    [selecionado, encontrados],
  );

  /** Coorientador abre o perfil de coorientador; quem tem os dois papéis, o de orientador. */
  const tipoDoNo = (grupo: string | undefined): TipoBusca => {
    if (modo === 'palavras') return 'Palavra-chave';
    if (modo === 'macrotemas') return 'Macrotema';
    return grupo === PAPEL_COORIENTADOR ? 'Co-orientador' : 'Orientador';
  };

  const option = useMemo<EChartsOption>(() => {
    const maiorGrau = Math.max(1, ...rede.nos.map((n) => n.grauPonderado));
    const maiorPeso = Math.max(1, ...rede.arestas.map((a) => a.peso));
    const indiceGrupo = new Map(rede.grupos.map((g, i) => [g, i]));

    const destacando = focais.size > 0;
    const vizinhos = new Set<string>();
    for (const a of rede.arestas) {
      if (focais.has(a.origem)) vizinhos.add(a.destino);
      if (focais.has(a.destino)) vizinhos.add(a.origem);
    }

    return {
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { dataType?: string; data?: Record<string, unknown> };
          if (p.dataType === 'edge') {
            const d = p.data as { source: string; target: string; value: number };
            return `${d.source}\n${d.target}\n${d.value} ${d.value === 1 ? 'registro em comum' : 'registros em comum'}`;
          }
          const d = p.data as { name: string; grupo: string; ocorrencias: number; value: number };
          return `${d.name}\n${d.grupo}\n${d.ocorrencias} ${d.ocorrencias === 1 ? 'registro' : 'registros'}\nGrau ponderado no desenho: ${d.value}`;
        },
      },
      // Legenda desligada explicitamente, e não apenas omitida: o `Grafico`
      // sempre injeta um componente `legend` para forçar `selectedMode: false`,
      // e um `legend` sem `data` faz o ECharts preencher a lista sozinho a
      // partir de `series.categories` e desenhá-la no topo, por cima dos
      // rótulos do círculo. A legenda real é HTML, passada em `rodape` —
      // fora do canvas ela não é sobreposta quando o usuário arrasta o
      // diagrama, e os nomes dos macrotemas não saem cortados.
      legend: { show: false },
      series: [{
        type: 'graph',
        layout: 'circular',
        // O círculo é desenhado dentro desta caixa. As margens dão espaço aos
        // rótulos, que saem para fora do círculo e são longos (nomes
        // completos). A legenda não entra nessa conta: ela é HTML, fora daqui.
        left: '13%',
        right: '13%',
        top: 28,
        bottom: 28,
        // Sem rotação os rótulos se empilham; com ela o diagrama fica igual ao
        // desenho radial clássico, com os nomes saindo do círculo.
        circular: { rotateLabel: true },
        categories: rede.grupos.map((g, i) => ({
          name: g,
          itemStyle: { color: TEMA_GRAFICO.paleta[i % TEMA_GRAFICO.paleta.length] },
        })),
        data: rede.nos.map((n) => ({
          id: n.id,
          name: n.id,
          value: n.grauPonderado,
          grupo: n.grupo,
          ocorrencias: n.ocorrencias,
          category: indiceGrupo.get(n.grupo) ?? 0,
          symbolSize: 6 + 18 * Math.sqrt(n.grauPonderado / maiorGrau),
          ...(!destacando ? {} : focais.has(n.id) ? {
            itemStyle: { borderColor: TEMA_GRAFICO.texto, borderWidth: 2 },
            label: { fontSize: 13, fontWeight: 'bold' as const },
          } : vizinhos.has(n.id) ? {} : {
            itemStyle: { opacity: 0.15 },
            label: { color: 'rgba(148, 163, 184, 0.3)' },
          }),
        })),
        links: rede.arestas.map((a) => ({
          source: a.origem,
          target: a.destino,
          value: a.peso,
          lineStyle: {
            width: 0.6 + 3 * (a.peso / maiorPeso),
            ...(!destacando ? {} : focais.has(a.origem) || focais.has(a.destino)
              ? { opacity: 0.85, width: 1.5 + 3 * (a.peso / maiorPeso) }
              : { opacity: 0.04 }),
          },
        })),
        roam: true,
        label: {
          show: true,
          position: 'right',
          color: TEMA_GRAFICO.texto,
          fontSize: 10,
          formatter: (p: unknown) => {
            const nome = (p as { name: string }).name;
            return nome.length > 28 ? `${nome.slice(0, 28)}…` : nome;
          },
        },
        // Rótulo de nó destacado nunca é escondido pela sobreposição.
        labelLayout: (p: { dataIndex?: number }) => ({ hideOverlap: !focais.has(rede.nos[p.dataIndex ?? -1]?.id ?? '') }),
        lineStyle: { color: 'source', curveness: 0.3, opacity: 0.22 },
        emphasis: {
          // Com um destaque fixo, o hover não isola outra vizinhança por cima dele.
          focus: destacando ? 'none' : 'adjacency',
          label: { show: true, fontSize: 12 },
          lineStyle: { width: 3, opacity: 0.85 },
        },
      }],
    };
  }, [rede, focais]);

  const rotuloEntidade = modo === 'supervisao' ? 'Pessoa' : modo === 'macrotemas' ? 'Macrotema' : 'Palavra-chave';
  const rotuloGrupo = modo === 'supervisao' ? 'Papel' : modo === 'macrotemas' ? 'Grupo' : 'Macrotema dominante';

  const descricao = modo === 'macrotemas'
    ? 'Cada ponto é um macrotema; a curva liga dois temas quando a mesma pessoa tem trabalhos nos dois. '
      + 'Espessura da curva é o número de pessoas em comum. Um registro tem um único macrotema, então dois temas '
      + 'nunca ocorrem juntos num mesmo trabalho: o que este diagrama mostra é quem atravessa fronteiras temáticas, '
      + 'não proximidade de conteúdo entre as áreas.'
    : modo === 'supervisao'
    ? 'Cada ponto é um orientador ou coorientador; a curva liga quem assina a orientação do mesmo registro. '
      + 'Espessura da curva é o número de registros em comum, e o arco indica o papel da pessoa no recorte. '
      + 'Isso descreve corresponsabilidade de orientação como a base registra — não é coautoria de publicação, '
      + 'não confirma identidade e nomes homônimos aparecem como um único ponto.'
    : 'Cada ponto é uma palavra-chave; a curva liga termos declarados no mesmo registro. '
      + 'Espessura da curva é o número de registros em comum, e o arco é o macrotema que mais acompanha o termo. '
      + 'Coocorrência descreve vizinhança no vocabulário declarado; não demonstra relação causal nem proximidade conceitual.';

  if (rede.nos.length === 0) {
    return (
      <Card className="space-y-3">
        <GrupoOpcoes opcoes={OPCOES} valor={escolha} onChange={trocarOpcao} rotulo="O que ligar no diagrama" />
        <Aviso>
          {modo === 'supervisao'
            ? 'Nenhum registro do recorte tem orientador e coorientador juntos, então não há par de orientação para desenhar.'
            : modo === 'macrotemas'
              ? 'Nenhuma pessoa do recorte tem trabalhos em dois macrotemas diferentes, então não há ligação para desenhar.'
              : 'Nenhum registro do recorte declara duas ou mais palavras-chave, então não há coocorrência para desenhar.'}
        </Aviso>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <GrupoOpcoes opcoes={OPCOES} valor={escolha} onChange={trocarOpcao} rotulo="O que ligar no diagrama" />
      <p className="text-xs text-slate-500">
        Mostrando {rede.nos.length} de {rede.totalNos} {rede.totalNos === 1 ? 'nó' : 'nós'} com pelo menos uma ligação,
        escolhidos pelo maior grau ponderado, e {rede.arestas.length} de {rede.totalArestas}{' '}
        {rede.totalArestas === 1 ? 'par' : 'pares'}. O corte é visual: as contagens acima descrevem a rede completa.
        Arraste para mover o diagrama e use a roda do mouse para aproximar. Clique em um ponto para destacar
        a vizinhança dele, clique de novo no mesmo ponto para abrir o dossiê no Motor de Busca, ou clique fora
        para limpar o destaque.
      </p>
      <div className="space-y-1">
        <SelectBusca
          key={modo}
          sessionKey={`radial.${modo}`}
          rotulo={modo === 'supervisao' ? 'Buscar orientador ou coorientador no diagrama' : modo === 'macrotemas' ? 'Buscar macrotema no diagrama' : 'Buscar palavra-chave no diagrama'}
          placeholder={modo === 'supervisao' ? 'Digite parte do nome' : 'Digite parte do termo'}
          opcoes={nomesNos}
          valor={nomesNos.includes(busca) ? busca : null}
          onChange={() => setSelecionado(null)}
        />
        {busca.trim() && (
          <p role="status" className="text-xs text-slate-400">
            {encontrados.length === 0
              ? `Nenhum dos ${rede.nos.length} nós desenhados corresponde a “${busca.trim()}”. Itens fora do corte visual não aparecem no diagrama.`
              : `${encontrados.length} ${encontrados.length === 1 ? 'item destacado' : 'itens destacados'}, com a vizinhança.`}
          </p>
        )}
      </div>
      <Card>
        <Grafico
          key={modo}
          mesclar
          altura={620}
          larguraMinima={520}
          option={option}
          rodape={(
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label={`Legenda de ${rotuloGrupo}`}>
              {rede.grupos.map((grupo, i) => (
                <li key={grupo} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: TEMA_GRAFICO.paleta[i % TEMA_GRAFICO.paleta.length] }}
                  />
                  <span className="text-slate-300">{grupo}</span>
                </li>
              ))}
            </ul>
          )}
          onEvents={{
            click: (params: unknown) => {
              const p = params as { dataType?: string; data?: { name?: string; grupo?: string } };
              if (p.dataType !== 'node' || !p.data?.name) return;
              if (selecionado === p.data.name) navegarPara(tipoDoNo(p.data.grupo), p.data.name);
              else setSelecionado(p.data.name);
            },
          }}
          onReady={(instancia) => {
            // Clique no vazio (sem elemento sob o cursor) limpa o destaque fixo.
            // O zrender não dispara `click` ao fim de um arrasto, então mover o
            // diagrama não apaga a seleção.
            (instancia as { getZr: () => { on: (e: string, h: (ev: { target?: unknown }) => void) => void } })
              .getZr()
              .on('click', (ev) => {
                if (!ev.target) setSelecionado(null);
              });
          }}
          leitura={{
            titulo: modo === 'supervisao' ? 'Rede radial de orientação conjunta' : modo === 'macrotemas' ? 'Rede radial de macrotemas ligados por pessoas' : 'Rede radial de coocorrência de palavras-chave',
            descricao,
            linhas: rede.arestas
              .slice()
              .sort((a, b) => b.peso - a.peso || a.origem.localeCompare(b.origem, 'pt-BR'))
              .map((a) => ({ origem: a.origem, destino: a.destino, peso: a.peso })),
            colunas: [
              { chave: 'origem', rotulo: rotuloEntidade },
              { chave: 'destino', rotulo: `${rotuloEntidade} ligada` },
              { chave: 'peso', rotulo: 'Registros em comum' },
            ],
            contexto: {
              modo,
              agrupamento: rotuloGrupo,
              limiteNos: LIMITE_NOS,
              nosDesenhados: rede.nos.length,
              nosNaRedeCompleta: rede.totalNos,
              paresDesenhados: rede.arestas.length,
              paresNaRedeCompleta: rede.totalArestas,
              registrosComPar: rede.registrosComPar,
              registrosNoRecorte: docs.length,
            },
          }}
        />
      </Card>
    </div>
  );
}
