import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { Aviso, Card } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { SelectBusca } from '@/components/ui/MultiSelect';
import { useSessionField } from '@/hooks/useSessionField';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { construirRedeRadial, opcaoRedeRadial, PAPEL_COORIENTADOR, type ModoRadial } from '@/lib/rede-radial';
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

  const option = useMemo<EChartsOption>(() => opcaoRedeRadial(rede, focais), [rede, focais]);

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
          descricaoEmDica
          dicaExtra={<p>
            Mostrando {rede.nos.length} de {rede.totalNos} {rede.totalNos === 1 ? 'nó' : 'nós'} com pelo menos uma ligação,
            escolhidos pelo maior grau ponderado, e {rede.arestas.length} de {rede.totalArestas}{' '}
            {rede.totalArestas === 1 ? 'par' : 'pares'}. O corte é visual: os totais descrevem a rede completa.
            Arraste para mover o diagrama e use a roda do mouse para aproximar. Clique em um ponto para destacar
            a vizinhança dele, clique de novo no mesmo ponto para abrir o dossiê no Motor de Busca, ou clique fora
            para limpar o destaque.
          </p>}
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
