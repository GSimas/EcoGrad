import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Kpi, Tabela } from '@/components/ui/primitives';
import { Trabalhos, FonteTrabalho } from '@/components/results/Trabalhos';
import { Relacoes } from '@/components/results/Relacoes';
import { CoberturaAnalise } from '@/components/results/CoberturaAnalise';
import { orientandos } from '@/lib/resultados';
import { carregarIndiceOrientacoes, orientacoesDe, temOrientacoes } from '@/lib/orientacoes';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { ChevronRight, GraduationCap, Handshake, Layers3, Tag, UserRound, UsersRound } from 'lucide-react';
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
    const pessoas = [
      ...doc.autores.map((nome) => ({ nome, tipo: 'Autor' as TipoBusca, icone: UserRound })),
      ...(doc.orientador ? [{ nome: doc.orientador, tipo: 'Orientador' as TipoBusca, icone: GraduationCap }] : []),
      ...doc.co_orientadores.map((nome) => ({ nome, tipo: 'Co-orientador' as TipoBusca, icone: Handshake })),
    ];
    return <><section className="space-y-4" aria-label="Resumo e fonte do trabalho">
      <Card className="space-y-3">
        <p className="text-sm text-slate-300">{doc.ano ?? 'Ano não informado'} · Tipo registrado: {doc.nivel_academico || 'não informado'}</p>
        <p className="text-sm"><strong>Coleção:</strong> {doc.programa_origem || 'não informada'}</p>
        {tcc.includes(doc.programa_origem) && <p className="text-xs text-slate-300">Acervo de TCCs (graduação ou especialização). O tipo acima reproduz a base, inclusive possíveis inconsistências; não foi inferido pelo nome da coleção.</p>}
        <FonteTrabalho doc={doc} />
        <p className="break-words text-xs text-slate-400">Fonte informada no registro: {doc.url || 'ausente'}. O acesso ao texto completo depende do repositório.</p>
      </Card>
      <Card className="space-y-3"><h3 className="text-lg font-semibold">Resumo</h3><p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-200">{doc.resumo.trim() || 'Resumo não disponível no recorte local. Consulte a fonte original, quando houver link.'}</p></Card>
      <Card className="space-y-5">
        <header className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-eco-accent/15 text-eco-accent"><UsersRound size={20} aria-hidden="true" /></span>
          <div><h3 className="text-lg font-semibold">Autoria, orientação e temas</h3><p className="mt-1 text-xs text-slate-400">Explore as pessoas e os assuntos vinculados a este registro.</p></div>
        </header>
        {pessoas.length ? <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pessoas.map((p) => {
          const Icone = p.icone;
          return <li key={`${p.tipo}:${p.nome}`}><button type="button" className="eco-entity-link group flex h-full min-h-20 w-full items-center gap-3 rounded-lg border border-eco-border bg-eco-bg/45 p-3 text-left" onClick={() => navegar(p.tipo, p.nome)}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-eco-accent/10 text-eco-accent"><Icone size={18} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[.68rem] font-semibold uppercase tracking-wide text-slate-400">{p.tipo}</span><span className="mt-0.5 block break-words text-sm font-medium text-slate-100">{p.nome}</span></span>
            <ChevronRight size={17} className="shrink-0 text-slate-500" aria-hidden="true" />
          </button></li>;
        })}</ul> : <p className="rounded-lg border border-dashed border-eco-border p-4 text-sm text-slate-400">Autoria e orientação não informadas.</p>}
        <div className={`grid gap-3 ${doc.macrotema ? 'lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]' : ''}`}>
          <section className="rounded-lg border border-eco-border bg-eco-bg/35 p-4" aria-label="Palavras-chave do trabalho">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Tag size={17} className="text-eco-accent" aria-hidden="true" />Palavras-chave</h4>
            {doc.palavras_chave.length ? <div className="flex flex-wrap gap-2">{[...new Set(doc.palavras_chave)].map((p) => <button key={p} className="btn-chip min-h-10 text-left" type="button" onClick={() => navegar('Palavra-chave', p)}>{p}</button>)}</div> : <p className="text-sm text-slate-400">Palavras-chave não informadas.</p>}
          </section>
          {doc.macrotema && <section className="rounded-lg border border-eco-border bg-eco-bg/35 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Layers3 size={17} className="text-eco-accent" aria-hidden="true" />Classificação temática da base</h4>
            <button className="eco-entity-link flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-eco-accent/30 bg-eco-accent/10 px-3 py-2 text-left text-sm font-medium text-eco-accent" type="button" onClick={() => navegar('Macrotema', doc.macrotema)}><span>{doc.macrotema}</span><ChevronRight size={17} className="shrink-0" aria-hidden="true" /></button>
          </section>}
        </div>
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
    {(tipo === 'Autor' || tipo === 'Orientador' || tipo === 'Co-orientador') && <OrientacoesNoAcervo termo={termo} />}
    <div className={`grid gap-4 ${tipo !== 'Orientador' && tipo !== 'Co-orientador' ? 'lg:grid-cols-2' : ''}`}>
      {tipo !== 'Orientador' && tipo !== 'Co-orientador' && <Relacoes docs={docs} tipo="Orientador" titulo="Orientadores dos trabalhos associados" />}
      <Relacoes docs={docs} tipo={tipo === 'Autor' ? 'Co-orientador' : 'Palavra-chave'} titulo={tipo === 'Autor' ? 'Coorientadores dos trabalhos associados' : 'Palavras-chave dos trabalhos associados'} />
    </div>
  </section>;
}
/** Baixado uma vez por versão da base, só quando um perfil de pessoa aparece. */
function useIndiceOrientacoes() {
  const versao = useEcoGradStore((s) => s.baseVersion);
  return useQuery({
    queryKey: ['indice-orientacoes', versao],
    queryFn: ({ signal }) => carregarIndiceOrientacoes(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Quem esta pessoa orientou ou coorientou em qualquer coleção do acervo. Cobre o
 * caso de quem foi orientado numa coleção e orienta em outra que não foi carregada.
 */
function OrientacoesNoAcervo({ termo }: { termo: string }) {
  const navegar = useEcoGradStore((s) => s.navegarPara);
  const docs = useEcoGradStore((s) => s.docs);
  const { data: indice, isPending, isError } = useIndiceOrientacoes();
  const linhas = useMemo(() => (indice ? orientacoesDe(indice, termo) : []), [indice, termo]);
  const carregadas = useMemo(() => new Set(docs.map((d) => d.programa_origem)), [docs]);
  const autoresCarregados = useMemo(() => new Set(docs.flatMap((d) => d.autores.map((a) => a.trim()))), [docs]);
  const orientou = linhas.filter((l) => l.orientou > 0).length;
  const coorientou = linhas.filter((l) => l.coorientou > 0).length;
  const colecoes = new Set(linhas.flatMap((l) => l.colecoes));
  const fora = [...colecoes].filter((c) => !carregadas.has(c)).length;
  const papeis = [orientou > 0 && `orientou ${plural(orientou, 'pessoa', 'pessoas')}`, coorientou > 0 && `coorientou ${plural(coorientou, 'pessoa', 'pessoas')}`].filter(Boolean).join(' e ');
  const resumoPapeis = papeis.charAt(0).toUpperCase() + papeis.slice(1);
  const tabela = linhas.map((l) => ({
    nome: l.nome,
    relacao: [l.orientou && `Orientou (${l.orientou})`, l.coorientou && `Coorientou (${l.coorientou})`].filter(Boolean).join(' · '),
    colecoes: l.colecoes.map((c) => (carregadas.has(c) ? c : `${c} (não carregada)`)).join('; '),
    periodo: l.periodo,
  }));

  return <section className="card space-y-4" aria-label="Orientações em todo o acervo">
    <header className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-eco-accent/12 text-eco-accent"><GraduationCap size={19} aria-hidden="true" /></span>
      <div><h3 className="text-lg font-semibold">Orientações em todo o acervo {indice && <span className="text-eco-accent">({linhas.length})</span>}</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">Pessoas que este nome orientou ou coorientou em qualquer coleção de graduação ou pós-graduação, inclusive nas que não foram carregadas. A correspondência é pelo nome exato: nomes iguais podem representar pessoas diferentes.</p></div>
    </header>
    {isPending ? <p role="status" className="text-sm text-slate-400">Carregando orientações de todas as coleções…</p>
      : isError ? <p role="alert" className="text-sm text-amber-200">Não foi possível carregar as orientações das outras coleções. As relações da seleção carregada continuam disponíveis.</p>
      : linhas.length === 0 ? <p className="text-sm text-slate-300">Nenhuma orientação ou coorientação registrada para este nome em nenhuma coleção do acervo.</p>
      : <>
        <p className="text-sm text-slate-200">
          {resumoPapeis}, em {plural(colecoes.size, 'coleção', 'coleções')}
          {fora > 0 ? `, ${fora === 1 ? '1 delas' : `${fora} delas`} fora da seleção carregada.` : ', todas na seleção carregada.'}
        </p>
        <div className="eco-related-table"><Tabela titulo={`Orientações de ${termo} em todo o acervo`} linhas={tabela}
          colunas={[
            { chave: 'nome', rotulo: 'Pessoa', render: (l) => autoresCarregados.has(String(l.nome))
              ? <button type="button" className="eco-entity-link group flex min-h-11 w-full min-w-48 items-center gap-2 rounded-lg border border-eco-border bg-eco-bg/40 px-3 py-2 text-left" onClick={() => navegar('Autor', String(l.nome))}><span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-100">{String(l.nome)}</span><ChevronRight size={16} className="shrink-0 text-slate-500" aria-hidden="true" /></button>
              : <span className="block min-w-48 break-words text-sm text-slate-200">{String(l.nome)}</span> },
            { chave: 'relacao', rotulo: 'Relação (trabalhos)' },
            { chave: 'colecoes', rotulo: 'Coleções' },
            { chave: 'periodo', rotulo: 'Período' },
          ]} /></div>
        <p className="text-xs text-slate-400">Nomes com link abrem o dossiê porque aparecem na seleção carregada; os demais estão só em coleções não carregadas.</p>
      </>}
  </section>;
}

function Orientandos({ docs, termo, co }: { docs: readonly Documento[]; termo: string; co: boolean }) {
  const navegar = useEcoGradStore((s) => s.navegarPara);
  const linhas = useMemo(() => orientandos(docs), [docs]);
  // Quem também orienta ou coorienta algum trabalho da base carregada, não só neste recorte.
  const base = useEcoGradStore((s) => s.docs);
  const orientadores = useMemo(() => new Set(base.flatMap((d) => [d.orientador, ...d.co_orientadores]).map((n) => n?.trim()).filter(Boolean)), [base]);
  // Com o índice do acervo, também conta quem orienta em coleções não carregadas.
  const { data: indice } = useIndiceOrientacoes();
  const ehOrientador = (nome: unknown) => orientadores.has(String(nome).trim()) || (!!indice && temOrientacoes(indice, String(nome).trim()));
  const rotulo = co ? 'Coorientandos' : 'Orientandos';
  return <section className="card space-y-4" aria-label={rotulo}>
    <header className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-eco-accent/12 text-eco-accent"><UsersRound size={19} aria-hidden="true" /></span>
      <div><h3 className="text-lg font-semibold">{rotulo} <span className="text-eco-accent">({linhas.length})</span></h3><p className="mt-1 text-xs leading-relaxed text-slate-400">Todos os autores dos trabalhos em que este nome aparece como {co ? 'coorientador' : 'orientador'}, do mais recente ao mais antigo. O capelo marca quem também aparece como orientador ou coorientador em qualquer coleção do acervo. Nomes iguais podem representar pessoas diferentes; confira as fontes.</p></div>
    </header>
    <div className="eco-related-table"><Tabela titulo={`${rotulo} de ${termo}`} linhas={linhas} vazio="Nenhuma autoria preenchida nestes trabalhos."
      colunas={[
        { chave: 'nome', rotulo: co ? 'Coorientando' : 'Orientando', render: (l) => <button type="button" className="eco-entity-link group flex min-h-11 w-full min-w-48 items-center gap-2 rounded-lg border border-eco-border bg-eco-bg/40 px-3 py-2 text-left" onClick={() => navegar('Autor', l.nome)}>{ehOrientador(l.nome)
          ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-eco-action/20 text-eco-action" title="Também orientador ou coorientador"><GraduationCap size={15} aria-hidden="true" /></span>
          : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-eco-accent/10 text-eco-accent"><UserRound size={14} aria-hidden="true" /></span>}<span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-100">{l.nome}{ehOrientador(l.nome) && <span className="sr-only"> (também orientador ou coorientador)</span>}</span><ChevronRight size={16} className="shrink-0 text-slate-500" aria-hidden="true" /></button> },
        { chave: 'trabalhos', rotulo: 'Trabalhos (n)' },
        { chave: 'niveis', rotulo: 'Tipo registrado' },
        { chave: 'periodo', rotulo: 'Período' },
      ]} /></div>
  </section>;
}
