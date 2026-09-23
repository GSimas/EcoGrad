import { Select } from '@/components/ui/Select';
import { useId, useMemo } from 'react';
import { Tabela } from '@/components/ui/primitives';
import { useSessionField } from '@/hooks/useSessionField';
import { compararColecoes, intervaloComum } from '@/lib/resultados';
import type { Documento } from '@/types';
/**
 * Tipos de trabalho, nomes distintos e repetições de link de cada coleção, no
 * período integral: independe da janela escolhida na comparação.
 */
export function TiposFontePorColecao({ docs, nomes }: { docs: readonly Documento[]; nomes: string[] }) {
  const linhas = useMemo(() => compararColecoes(docs, nomes, null), [docs, nomes]);
  return <section className="space-y-3" aria-label="Tipos e repetições de fonte por coleção">
    <ul className="space-y-3 text-xs text-slate-300">{linhas.map((c) => <li key={c.nome}><strong>{c.nome || 'Origem não informada'}</strong><p>{Object.entries(c.tipos).map(([t, n]) => `${t}: ${n}`).join(' · ') || 'Sem registros.'}</p><p>Nomes distintos: {c.autores} autores · {c.orientadores} orientadores · {c.coorientadores} coorientadores · {c.palavras} palavras-chave. Nomes iguais não confirmam identidade de pessoas.</p><p>{c.fontesDistintas} links distintos · {c.comFonte - c.fontesDistintas} repetições de links. Classificações originais preservadas, inclusive “Outros”.</p></li>)}</ul>
  </section>;
}

export function ComparacaoColecoes({ docs, nomes, tcc, ppg }: { docs: readonly Documento[]; nomes: string[]; tcc: string[]; ppg: string[] }) {
  const id = useId();
  const [modo, setModo] = useSessionField('dashboard.comparacao.periodo', 'integral');
  const comum = useMemo(() => intervaloComum(docs, nomes), [docs, nomes]);
  const usarComum = modo === 'comum' && !!comum;
  const linhas = useMemo(() => compararColecoes(docs, nomes, usarComum ? comum : null), [docs, nomes, usarComum, comum]);
  const fracao = (n: number, total: number) => `${n}/${total}${total ? ` (${(100 * n / total).toFixed(1)}%)` : ' (sem registros)'}`;
  return <section className="space-y-4" aria-label="Comparar coleções">
    <p className="text-sm text-slate-300">Compare volumes e cobertura antes de interpretar diferenças. Coleções de TCC e de pós-graduação têm finalidades e classificações distintas; o tamanho do acervo não é uma medida de qualidade.</p>
    <div className="block max-w-xl space-y-1 text-sm"><label htmlFor={id}>Período da comparação</label><Select id={id} valor={usarComum ? 'comum' : 'integral'} onChange={setModo} opcoes={[{ valor: 'integral', rotulo: 'Todo o período de cada coleção' }, { valor: 'comum', rotulo: comum ? `Janela comum: ${comum[0]}–${comum[1]}` : 'Janela comum indisponível', desabilitada: !comum }]} /></div>
    <p className="text-xs text-slate-400">{usarComum ? 'A janela comum é a interseção dos intervalos observados, não a garantia de registros em todos os anos. Registros sem ano ficam fora desta comparação.' : 'Os volumes podem cobrir períodos diferentes. A janela comum exige ao menos um ano informado em cada coleção e intervalos sobrepostos.'} Este filtro muda somente a comparação; busca, dossiês e cálculos continuam usando toda a análise.</p>
    <Tabela titulo="Comparação de coleções" linhas={linhas}
      contexto={{periodoComparacao:usarComum?comum:'Integral', catalogos:{ppg,tcc}}}
      descricao="Registros incluídos e preenchimento dos metadados, em números absolutos. Percentuais usam os registros incluídos de cada coleção. Ordenar não é classificar qualidade."
      colunas={[
        {chave:'nome',rotulo:'Coleção e catálogo',render:(c)=><><span className="block">{c.nome || 'Origem não informada'}</span><span className="block text-xs">{tcc.includes(c.nome)?ppg.includes(c.nome)?'Nome presente nos dois catálogos; origem por registro não distinguida':'TCCs (graduação/especialização)':ppg.includes(c.nome)?'Pós-graduação':'Catálogo não identificado'}</span></>},
        {chave:'total',rotulo:'Registros incluídos (n)'},{chave:'totalOriginal',rotulo:'Registros carregados (n)'},
        {chave:'inicio',rotulo:'Primeiro ano',render:(c)=>c.inicio??'Não informado'}, {chave:'fim',rotulo:'Último ano',render:(c)=>c.fim??'Não informado'},
        {chave:'anos',rotulo:'Anos com registros (n)'}, {chave:'semAnoOriginal',rotulo:'Registros sem ano (n)'},
        {chave:'comResumo',rotulo:'Com resumo (n)',render:(c)=>fracao(c.comResumo,c.total)},
        {chave:'comPalavras',rotulo:'Com palavras-chave (n)',render:(c)=>fracao(c.comPalavras,c.total)},
        {chave:'comOrientador',rotulo:'Com orientador (n)',render:(c)=>fracao(c.comOrientador,c.total)},
        {chave:'comFonte',rotulo:'Com fonte (n)',render:(c)=>fracao(c.comFonte,c.total)},
      ]} />
    <p className="text-xs text-slate-400">Coleções podem se sobrepor: somar as linhas não fornece o total de trabalhos únicos. A tabela não compara notas CAPES nem estima a produção ausente. Os cálculos científicos não foram normalizados por esta janela.</p>
  </section>;
}
