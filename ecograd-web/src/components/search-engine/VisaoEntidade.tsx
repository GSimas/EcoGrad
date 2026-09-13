import { useMemo, type ReactNode } from 'react';
import { Card, Kpi, Tabela } from '@/components/ui/primitives';
import { Trabalhos, FonteTrabalho } from '@/components/results/Trabalhos';
import { Relacoes } from '@/components/results/Relacoes';
import { CoberturaAnalise } from '@/components/results/CoberturaAnalise';
import { orientandos } from '@/lib/resultados';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { Documento, TipoBusca } from '@/types';
const JUSTIFICATIVA: Record<TipoBusca, string> = {
  Documento: 'Metadados do registro selecionado no recorte local.',
  Autor: 'Trabalhos em que este nome aparece na autoria. Nomes iguais podem representar pessoas diferentes; confira as fontes.',
  Orientador: 'Trabalhos em que este nome aparece como orientador. A relação não comprova vínculo institucional atual nem disponibilidade para orientação.',
  'Co-orientador': 'Trabalhos em que este nome aparece como coorientador. A relação não comprova vínculo institucional atual nem disponibilidade para orientação.',
  'Palavra-chave': 'Trabalhos que contêm esta palavra-chave nos metadados. Os pesquisadores abaixo se relacionam ao tema por esses registros.',
  Macrotema: 'Trabalhos que receberam esta classificação temática na base. Ela não é necessariamente uma palavra-chave fornecida pelo autor.',
};
export function VisaoEntidade({ tipo, docs, termo, analises }: { tipo: TipoBusca; docs: readonly Documento[]; termo: string; analises?: ReactNode }) {
  const tcc = useEcoGradStore((s) => s.cursosTccSelecionados);
  const navegar = useEcoGradStore((s) => s.navegarPara);
  const colecoes = [...new Set(docs.map((d) => d.programa_origem).filter(Boolean))];
  if (tipo === 'Documento') {
    const doc = docs[0];
    if (!doc) return null;
    const pessoas = [...doc.autores.map((nome) => ({ nome, tipo: 'Autor' as TipoBusca })), ...(doc.orientador ? [{ nome: doc.orientador, tipo: 'Orientador' as TipoBusca }] : []), ...doc.co_orientadores.map((nome) => ({ nome, tipo: 'Co-orientador' as TipoBusca }))];
    return <><section className="space-y-4" aria-label="Resumo e fonte do trabalho">
      <Card className="space-y-3">
        <p className="text-sm text-slate-300">{doc.ano ?? 'Ano não informado'} · Tipo registrado: {doc.nivel_academico || 'não informado'}</p>
        <p className="text-sm"><strong>Coleção:</strong> {doc.programa_origem || 'não informada'}</p>
        {tcc.includes(doc.programa_origem) && <p className="text-xs text-slate-300">Acervo de TCCs (graduação ou especialização). O tipo acima reproduz a base, inclusive possíveis inconsistências; não foi inferido pelo nome da coleção.</p>}
        <FonteTrabalho doc={doc} />
        <p className="break-words text-xs text-slate-400">Fonte informada no registro: {doc.url || 'ausente'}. O acesso ao texto completo depende do repositório.</p>
      </Card>
      <Card className="space-y-3"><h3 className="text-lg font-semibold">Resumo</h3><p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-200">{doc.resumo.trim() || 'Resumo não disponível no recorte local. Consulte a fonte original, quando houver link.'}</p></Card>
      <Card className="space-y-4">
        <h3 className="text-lg font-semibold">Autoria, orientação e temas</h3>
        {pessoas.length ? <ul className="space-y-2">{pessoas.map((p, i) => <li key={i}><button type="button" className="min-h-11 text-left text-sm text-eco-accent hover:underline" onClick={() => navegar(p.tipo, p.nome)}>{p.tipo}: {p.nome}</button></li>)}</ul> : <p className="text-sm">Autoria e orientação não informadas.</p>}
        {doc.palavras_chave.length ? <div className="flex flex-wrap gap-2" aria-label="Palavras-chave do trabalho">{[...new Set(doc.palavras_chave)].map((p) => <button key={p} className="btn min-h-11 text-left" type="button" onClick={() => navegar('Palavra-chave', p)}>{p}</button>)}</div> : <p className="text-sm">Palavras-chave não informadas.</p>}
        {doc.macrotema && <p className="text-sm">Classificação temática da base: <button className="min-h-11 text-left text-eco-accent hover:underline" type="button" onClick={() => navegar('Macrotema', doc.macrotema)}>{doc.macrotema}</button></p>}
      </Card>
    </section>{analises}</>;
  }
  return <section className="space-y-5" aria-label={`Trabalhos e relações de ${termo}`}>
    <p className="text-sm leading-relaxed text-slate-300">{JUSTIFICATIVA[tipo]}</p>
    <div className="grid gap-3 sm:grid-cols-2"><Kpi rotulo="Registros associados" valor={docs.length} /><Kpi rotulo="Coleções representadas" valor={colecoes.length} detalhe={`${colecoes.filter((n) => tcc.includes(n)).length} do catálogo de TCCs`} /></div>
    <CoberturaAnalise docs={docs} />
    {analises}
    <Trabalhos docs={docs} sessionKey="dossie.trabalhos" titulo="Trabalhos associados" />
    {(tipo === 'Orientador' || tipo === 'Co-orientador') && <Orientandos docs={docs} termo={termo} co={tipo === 'Co-orientador'} />}
    <div className="grid gap-4 lg:grid-cols-2">
      {tipo !== 'Orientador' && tipo !== 'Co-orientador' && <Relacoes docs={docs} tipo="Orientador" titulo="Orientadores dos trabalhos associados" />}
      <Relacoes docs={docs} tipo={tipo === 'Autor' ? 'Co-orientador' : 'Palavra-chave'} titulo={tipo === 'Autor' ? 'Coorientadores dos trabalhos associados' : 'Palavras-chave dos trabalhos associados'} />
    </div>
  </section>;
}
function Orientandos({ docs, termo, co }: { docs: readonly Documento[]; termo: string; co: boolean }) {
  const navegar = useEcoGradStore((s) => s.navegarPara);
  const linhas = useMemo(() => orientandos(docs), [docs]);
  const rotulo = co ? 'Coorientandos' : 'Orientandos';
  return <section className="card space-y-3" aria-label={rotulo}>
    <h3 className="text-lg font-semibold">{rotulo} ({linhas.length})</h3>
    <p className="text-xs text-slate-400">Todos os autores dos trabalhos em que este nome aparece como {co ? 'coorientador' : 'orientador'}, do mais recente ao mais antigo. Nomes iguais podem representar pessoas diferentes; confira as fontes.</p>
    <Tabela titulo={`${rotulo} de ${termo}`} linhas={linhas} vazio="Nenhuma autoria preenchida nestes trabalhos."
      colunas={[
        { chave: 'nome', rotulo: co ? 'Coorientando' : 'Orientando', render: (l) => <button type="button" className="min-h-11 text-left text-eco-accent hover:underline" onClick={() => navegar('Autor', l.nome)}>{l.nome}</button> },
        { chave: 'trabalhos', rotulo: 'Trabalhos (n)' },
        { chave: 'niveis', rotulo: 'Tipo registrado' },
        { chave: 'periodo', rotulo: 'Período' },
      ]} />
  </section>;
}
