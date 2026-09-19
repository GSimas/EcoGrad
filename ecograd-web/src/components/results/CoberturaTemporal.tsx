import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { Aviso, Card } from '@/components/ui/primitives';
import { Grafico } from '@/components/ui/Chart';
import { calcularCoberturaTemporal, opcaoCoberturaTemporal, SEM_ANO } from '@/lib/cobertura-temporal';
import type { Documento } from '@/types';


/** Largura mínima por coluna de ano, para as células não virarem tiras. */
const LARGURA_POR_ANO = 46;

interface Props {
  docs: readonly Documento[];
}

/**
 * Heatmap ano × campo: quanto de cada metadado existe em cada ano do recorte.
 *
 * Serve de leitura prévia para todo o resto da ferramenta — uma queda temática
 * num ano pode ser queda real ou pode ser o ano em que os metadados faltam.
 */
export function CoberturaTemporal({ docs }: Props) {
  const cobertura = useMemo(() => calcularCoberturaTemporal(docs), [docs]);

  const option = useMemo<EChartsOption>(() => opcaoCoberturaTemporal(cobertura), [cobertura]);

  if (cobertura.anos.length === 0) {
    return <Aviso>Nenhum registro no recorte, então não há cobertura de metadados para mapear.</Aviso>;
  }

  const criterios = cobertura.campos.map((c) => `${c.rotulo}: ${c.criterio}`).join(' ');

  return (
    <Card className="space-y-3">
      <Grafico
        altura={26 * cobertura.campos.length + 190}
        larguraMinima={Math.max(520, cobertura.anos.length * LARGURA_POR_ANO + 160)}
        option={option}
        leitura={{
          titulo: 'Cobertura de metadados por ano',
          descricao:
            'Cada célula é a porcentagem dos registros daquele ano que têm o campo preenchido; '
            + 'as barras abaixo mostram quantos registros existem no ano. '
            + 'Serve para separar queda real de lacuna de metadado: um tema que some num ano pode ter sumido, '
            + 'ou aquele ano pode ser o que veio sem palavras-chave. '
            + 'Presença de metadado não comprova qualidade nem acesso ao texto completo, e a data da coleta não está informada. '
            + `Critérios — ${criterios}`,
          linhas: cobertura.celulas.map((c) => ({
            ano: c.ano,
            campo: c.campo,
            preenchidos: c.preenchidos,
            total: c.total,
            percentual: c.total === 0 ? '—' : `${Math.round(c.percentual)}%`,
          })),
          colunas: [
            { chave: 'ano', rotulo: 'Ano' },
            { chave: 'campo', rotulo: 'Campo' },
            { chave: 'preenchidos', rotulo: 'Registros com o campo (n)' },
            { chave: 'total', rotulo: 'Registros no ano (n)' },
            { chave: 'percentual', rotulo: 'Cobertura' },
          ],
          contexto: {
            totalRegistros: cobertura.totalRegistros,
            registrosSemAno: cobertura.semAno,
            anosNoEixo: cobertura.anos.filter((a) => a !== SEM_ANO).length,
            anosSemNenhumRegistro: cobertura.anosVazios,
            eixoContinuo: cobertura.intervaloContinuo
              ? 'O eixo cobre o intervalo inteiro; anos sem registro aparecem em branco.'
              : 'O intervalo era largo demais para o eixo: só os anos observados são listados, e a série não deve ser lida como contínua.',
            campos: cobertura.campos.map((c) => c.rotulo),
            coorientacaoNaoAvaliada: 'Ausência de coorientador é característica do trabalho, não lacuna de metadado.',
          },
        }}
      />
      {cobertura.anosVazios.length > 0 && (
        <p className="text-xs text-amber-200">
          {cobertura.anosVazios.length === 1
            ? `${cobertura.anosVazios[0]} não tem nenhum registro no recorte e aparece como coluna em branco.`
            : `${cobertura.anosVazios.length} anos do intervalo não têm nenhum registro e aparecem como colunas em branco: ${cobertura.anosVazios.join(', ')}.`}
          {' '}Ausência de registro no recorte local não comprova ausência de produção no repositório.
        </p>
      )}
      {!cobertura.intervaloContinuo && cobertura.anos.length > 2 && (
        <p className="text-xs text-amber-200">
          O intervalo entre o primeiro e o último ano é largo demais para caber no eixo, provavelmente por um ano
          fora de escala nos metadados. Só os anos observados estão listados, então os espaçamentos do eixo não
          representam distância no tempo.
        </p>
      )}
      {cobertura.semAno > 0 && (
        <p className="text-xs text-slate-400">
          {cobertura.semAno} {cobertura.semAno === 1 ? 'registro não tem ano' : 'registros não têm ano'} e
          {' '}{cobertura.semAno === 1 ? 'aparece' : 'aparecem'} na coluna “{SEM_ANO}”, no fim do eixo. Eles entram
          em todos os totais do recorte, mas não podem ser situados em nenhuma série temporal.
        </p>
      )}
      {cobertura.pior && cobertura.pior.percentual < 90 && (
        <p className="text-xs text-amber-200">
          Menor cobertura entre os anos com ao menos 5 registros: {cobertura.pior.campo.toLowerCase()} em{' '}
          {cobertura.pior.ano}, com {cobertura.pior.preenchidos} de {cobertura.pior.total}{' '}
          ({Math.round(cobertura.pior.percentual)}%). Considere esse ponto antes de comparar volumes ou temas ao longo do tempo.
        </p>
      )}
    </Card>
  );
}
