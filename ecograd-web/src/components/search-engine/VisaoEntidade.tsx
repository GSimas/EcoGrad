import { useMemo, useState, type ReactNode } from 'react';
import { classeDoTipo } from '@/lib/tipos-cor';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BotaoEntidade, Card, Dica, Kpi, Tabela, TextoDoAcervo } from '@/components/ui/primitives';
import { Trabalhos, FonteTrabalho } from '@/components/results/Trabalhos';
import { Relacoes } from '@/components/results/Relacoes';
import { carregarIndiceOrientacoes, orientacoesDe, orientacoesLocais, temOrientacoes } from '@/lib/orientacoes';
import { carregarIndiceBusca, itemDoAcervo } from '@/lib/busca-global';
import { abrirEscolhaDoAcervo } from '@/services/abrir-item';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { BookOpenText, ChartColumn, ChevronRight, GraduationCap, Handshake, Layers3, Tag, UserRound, UsersRound } from 'lucide-react';
import { BlocoEmJanela } from '@/components/ui/BlocoEmJanela';
import { CarregarDoAcervo } from './CarregarDoAcervo';
import { NOTA_EXPORTACAO, NOTA_FILTROS } from '@/components/ui/Tabela';
import { PAPEIS_PESSOA, type Documento, type PapelPessoa, type TipoBusca } from '@/types';
export const JUSTIFICATIVA: Record<TipoBusca, string> = {
  Documento: 'Metadados do registro selecionado no recorte local.',
  Pessoa: 'Todos os trabalhos em que este nome aparece, em qualquer papel. Nomes iguais podem representar pessoas diferentes; confira as fontes.',
  Autor: 'Trabalhos em que este nome aparece na autoria. Nomes iguais podem representar pessoas diferentes; confira as fontes.',
  Orientador: 'Trabalhos em que este nome aparece como orientador. A relação não comprova vínculo institucional atual nem disponibilidade para orientação.',
  'Co-orientador': 'Trabalhos em que este nome aparece como coorientador. A relação não comprova vínculo institucional atual nem disponibilidade para orientação.',
  'Palavra-chave': 'Trabalhos que contêm esta palavra-chave nos metadados. Os pesquisadores abaixo se relacionam ao tema por esses registros.',
  Macrotema: 'Trabalhos que receberam esta classificação temática na base. Ela não é necessariamente uma palavra-chave fornecida pelo autor.',
};
/**
 * Gráficos e trabalhos associados abrem em janelas a partir de dois botões; a
 * página do dossiê fica com a ficha, os indicadores e as relações.
 */
function BotoesDossie({ graficos, trabalhos, orientados }: { graficos?: ReactNode; trabalhos?: { docs: readonly Documento[] }; orientados?: string }) {
  if (!graficos && !trabalhos) return null;
  return <div role="group" aria-label="Aprofundar o dossiê" className={`grid gap-3 sm:grid-cols-2 ${orientados ? 'lg:grid-cols-3' : ''}`}>
    {graficos && <BlocoEmJanela titulo="Gráficos" icone={<ChartColumn size={20} aria-hidden="true" />}
      descricao="Evolução histórica, lexicometria, órbita de relacionamentos, frequências e relações (QL) e itens semelhantes — os que descrevem este item.">
      {graficos}
    </BlocoEmJanela>}
    {trabalhos && <BlocoEmJanela titulo="Trabalhos associados" icone={<BookOpenText size={20} aria-hidden="true" />}
      descricao={`${trabalhos.docs.length.toLocaleString('pt-BR')} ${trabalhos.docs.length === 1 ? 'registro associado' : 'registros associados'}, com filtros por texto e coleção.`}>
      <Trabalhos docs={trabalhos.docs} sessionKey="dossie.trabalhos" titulo="Trabalhos associados" mostrarResumo={false} semCabecalho />
    </BlocoEmJanela>}
    {orientados && <BlocoEmJanela titulo="Orientados" icone={<UsersRound size={20} aria-hidden="true" />}
      descricao="Pessoas que este nome orientou ou coorientou, em qualquer coleção do acervo.">
      <Orientados key={orientados} termo={orientados} />
    </BlocoEmJanela>}
  </div>;
}

export function VisaoEntidade({ tipo, docs, termo, analises, graficos }: { tipo: TipoBusca; docs: readonly Documento[]; termo: string; analises?: ReactNode; graficos?: ReactNode }) {
  const tcc = useEcoGradStore((s) => s.cursosTccSelecionados);
  const navegar = useEcoGradStore((s) => s.navegarPara);
  const base = useEcoGradStore((s) => s.docs);
  // Papéis que este nome exerce na base inteira — e não só nos `docs` do recorte
  // atual, que num dossiê de papel trariam apenas aquele papel de volta.
  const papeis = useMemo(() => {
    const conta = new Map<PapelPessoa, number>();
    const soma = (p: PapelPessoa) => conta.set(p, (conta.get(p) ?? 0) + 1);
    for (const d of base) {
      if (d.autores.includes(termo)) soma('Autor');
      if (d.orientador === termo) soma('Orientador');
      if (d.co_orientadores.includes(termo)) soma('Co-orientador');
    }
    return PAPEIS_PESSOA.flatMap((p) => (conta.get(p) ? [[p, conta.get(p)!] as const] : []));
  }, [base, termo]);
  const colecoes = [...new Set(docs.map((d) => d.programa_origem).filter(Boolean))];
  const registrosPorColecao = [...docs.reduce((m, d) => (d.programa_origem ? m.set(d.programa_origem, (m.get(d.programa_origem) ?? 0) + 1) : m), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
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
        <div className="flex flex-wrap gap-2"><FonteTrabalho doc={doc} /></div>
        <p className="break-words text-xs text-slate-400">Fonte informada no registro: {doc.url || 'ausente'}. O acesso ao texto completo depende do repositório.</p>
      </Card>
      <Card className="space-y-3"><h3 className="text-lg font-semibold">Resumo</h3><TextoDoAcervo texto={doc.resumo} className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-200" vazio="Resumo não disponível no recorte local. Consulte a fonte original, quando houver link." /></Card>
      <Card className="space-y-5">
        <header className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-eco-accent/15 text-eco-accent"><UsersRound size={20} aria-hidden="true" /></span>
          <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">Autoria, orientação e temas</h3><Dica rotulo="Como ler: autoria, orientação e temas"><p>Explore as pessoas e os assuntos vinculados a este registro.</p></Dica></div>
        </header>
        {pessoas.length ? <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pessoas.map((p) => {
          const Icone = p.icone;
          return <li key={`${p.tipo}:${p.nome}`}><button type="button" className={`eco-entity-link group flex h-full min-h-20 w-full items-center gap-3 rounded-lg border border-eco-border bg-eco-bg/45 p-3 text-left ${classeDoTipo(p.tipo)}`} onClick={() => navegar(p.tipo, p.nome)}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-eco-accent/10 text-eco-accent"><Icone size={18} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[.68rem] font-semibold uppercase tracking-wide text-slate-400">{p.tipo}</span><span className="mt-0.5 block break-words text-sm font-medium text-slate-100">{p.nome}</span></span>
            <ChevronRight size={17} className="shrink-0 text-slate-500" aria-hidden="true" />
          </button></li>;
        })}</ul> : <p className="rounded-lg border border-dashed border-eco-border p-4 text-sm text-slate-400">Autoria e orientação não informadas.</p>}
        <div className={`grid gap-3 ${doc.macrotema ? 'lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]' : ''}`}>
          <section className="rounded-lg border border-eco-border bg-eco-bg/35 p-4" aria-label="Palavras-chave do trabalho">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Tag size={17} className="text-eco-accent" aria-hidden="true" />Palavras-chave</h4>
            {doc.palavras_chave.length ? <div className="flex flex-wrap gap-2">{[...new Set(doc.palavras_chave)].map((p) => <button key={p} className="btn-chip eco-tipo-tema min-h-10 text-left" type="button" onClick={() => navegar('Palavra-chave', p)}>{p}</button>)}</div> : <p className="text-sm text-slate-400">Palavras-chave não informadas.</p>}
          </section>
          {doc.macrotema && <section className="rounded-lg border border-eco-border bg-eco-bg/35 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Layers3 size={17} className="text-eco-accent" aria-hidden="true" />Classificação temática da base</h4>
            <button className="eco-entity-link eco-tipo-tema flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium" type="button" onClick={() => navegar('Macrotema', doc.macrotema)}><span>{doc.macrotema}</span><ChevronRight size={17} className="shrink-0" aria-hidden="true" /></button>
          </section>}
        </div>
      </Card>
    </section><BotoesDossie graficos={graficos} />{analises}</>;
  }
  const ehPapel = (PAPEIS_PESSOA as readonly string[]).includes(tipo);
  return <section className="space-y-5" aria-label={`Trabalhos e relações de ${termo}`}>
    {tipo === 'Pessoa' && papeis.length > 0 && <section className="card space-y-3" aria-label="Papéis no recorte">
      <div className="flex items-center gap-2"><h3 className="text-base font-semibold">Papéis no recorte</h3><Dica rotulo="Como ler: papéis no recorte"><p>Os trabalhos associados reúnem todos os papéis. Abra um papel para ver só a parte dele. Um mesmo trabalho pode contar em mais de um papel.</p></Dica></div>
      <ul className="flex flex-wrap gap-2">{papeis.map(([papel, n]) => <li key={papel}>
        <button type="button" className="btn-chip min-h-10" onClick={() => navegar(papel, termo)}>{papel} · {n} {n === 1 ? 'registro' : 'registros'}</button>
      </li>)}</ul>
    </section>}

    {ehPapel && papeis.length > 1 && <p className="info">
      Este nome também aparece como {papeis.filter(([p]) => p !== tipo).map(([p]) => p.toLowerCase()).join(' e ')} no recorte.
      <button type="button" className="btn ml-2 text-xs" onClick={() => navegar('Pessoa', termo)}>Ver todos os trabalhos da pessoa</button>
    </p>}
    <CarregarDoAcervo tipo={tipo} termo={termo} registrosNaAnalise={docs.length} />
    <div className="grid gap-3 sm:grid-cols-2"><Kpi rotulo="Registros associados" valor={docs.length} /><Kpi rotulo="Coleções representadas" valor={colecoes.length} detalhe={`${colecoes.filter((n) => tcc.includes(n)).length} do catálogo de TCCs`}>
      <ul className="mt-2 max-h-48 space-y-1.5 overflow-auto border-t border-eco-border pr-1 pt-2 text-xs" aria-label="Coleções representadas e registros em cada uma">
        {registrosPorColecao.map(([nome, n]) => <li key={nome} className="flex items-start justify-between gap-3">
          <span className="min-w-0 break-words text-slate-200">{nome}{tcc.includes(nome) && <span className="text-slate-400"> · TCC</span>}</span>
          <span className="shrink-0 tabular-nums text-slate-400">{n} {n === 1 ? 'registro' : 'registros'}</span>
        </li>)}
      </ul>
    </Kpi></div>
    <BotoesDossie graficos={graficos} trabalhos={{ docs }} orientados={ehPapel || tipo === 'Pessoa' ? termo : undefined} />
    {analises}
    <div className={`grid gap-4 ${tipo !== 'Orientador' && tipo !== 'Co-orientador' ? 'lg:grid-cols-2' : ''}`}>
      {tipo !== 'Orientador' && tipo !== 'Co-orientador' && <Relacoes docs={docs} tipo="Orientador" titulo="Orientadores dos trabalhos associados" />}
      <Relacoes docs={docs} tipo={tipo === 'Autor' || tipo === 'Pessoa' ? 'Co-orientador' : 'Palavra-chave'} titulo={tipo === 'Autor' || tipo === 'Pessoa' ? 'Coorientadores dos trabalhos associados' : 'Palavras-chave dos trabalhos associados'} />
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
 * Quem esta pessoa orientou ou coorientou, em todo o acervo. Enquanto o índice do
 * acervo baixa, ou se ele falhar, mostra só as coleções carregadas.
 */
function Orientados({ termo }: { termo: string }) {
  const pessoa = termo.trim();
  const navegar = useEcoGradStore((s) => s.navegarPara);
  const base = useEcoGradStore((s) => s.docs);
  const carregando = useEcoGradStore((s) => s.carregando);
  const mensagem = useEcoGradStore((s) => s.mensagemCarregamento);
  const erroCarregamento = useEcoGradStore((s) => s.erroCarregamento);
  const queryClient = useQueryClient();
  const { data: indice, isError } = useIndiceOrientacoes();
  const [abrindo, setAbrindo] = useState<{ nome: string; erro?: string } | null>(null);

  const local = useMemo(() => orientacoesLocais(base, pessoa), [base, pessoa]);
  const linhas = useMemo(() => orientacoesDe(indice ?? local, pessoa), [indice, local, pessoa]);
  const carregadas = useMemo(() => new Set(base.map((d) => d.programa_origem)), [base]);
  // Nome sem espaços nas pontas (como no índice) → nome exato usado pelo Motor de Busca.
  const autoresCarregados = useMemo(() => new Map(base.flatMap((d) => d.autores.map((a) => [a.trim(), a] as const))), [base]);
  const orientadoresCarregados = useMemo(() => new Set(base.flatMap((d) => [d.orientador, ...d.co_orientadores]).map((n) => n?.trim()).filter(Boolean)), [base]);
  const ehOrientador = (nome: string) => orientadoresCarregados.has(nome) || (!!indice && temOrientacoes(indice, nome));

  const abrir = async (nome: string) => {
    const exato = autoresCarregados.get(nome);
    if (exato) {
      navegar('Autor', exato);
      return;
    }
    // Fora da seleção: carrega só as coleções da pessoa, pelo mesmo caminho da busca da apresentação.
    setAbrindo({ nome });
    try {
      const catalogo = await queryClient.fetchQuery({ queryKey: ['indice-busca'], queryFn: ({ signal }) => carregarIndiceBusca(signal), staleTime: Infinity });
      const item = itemDoAcervo(catalogo, 'Autor', nome);
      if (!item) throw new Error('o nome não aparece como autor no catálogo do acervo.');
      abrirEscolhaDoAcervo({ itens: [item], colecoes: [] });
    } catch (e) {
      setAbrindo({ nome, erro: e instanceof Error ? e.message : String(e) });
    }
  };

  const orientou = linhas.filter((l) => l.orientou > 0).length;
  const coorientou = linhas.filter((l) => l.coorientou > 0).length;
  const colecoes = new Set(linhas.flatMap((l) => l.colecoes));
  const fora = [...colecoes].filter((c) => !carregadas.has(c)).length;
  const papeis = [orientou > 0 && `orientou ${plural(orientou, 'pessoa', 'pessoas')}`, coorientou > 0 && `coorientou ${plural(coorientou, 'pessoa', 'pessoas')}`].filter(Boolean).join(' e ');
  const tabela = linhas.map((l) => ({
    nome: l.nome,
    relacao: [l.orientou && `Orientou (${l.orientou})`, l.coorientou && `Coorientou (${l.coorientou})`].filter(Boolean).join(' · '),
    niveis: l.niveis,
    colecoes: l.colecoes.map((c) => (carregadas.has(c) ? c : `${c} (não carregada)`)).join('; '),
    periodo: l.periodo,
  }));
  const status = abrindo?.erro ? `Não foi possível abrir “${abrindo.nome}”: ${abrindo.erro}`
    : abrindo && carregando ? `Carregando as coleções de “${abrindo.nome}”. ${mensagem}`
      : abrindo && erroCarregamento ? `Não foi possível abrir “${abrindo.nome}”: ${erroCarregamento}`
        : abrindo ? `Localizando “${abrindo.nome}” no acervo…` : '';

  // Mora na janela "Orientados": o título dela nomeia o bloco, e as instruções vão para a dica.
  return <section className="space-y-4" aria-label="Orientados">
    <div className="flex items-center gap-2">
      <p className="text-sm font-semibold">{plural(linhas.length, 'pessoa orientada', 'pessoas orientadas')}</p>
      <Dica rotulo="Como ler: orientados"><p>Pessoas que este nome orientou ou coorientou em qualquer coleção do acervo, da mais recente à mais antiga. O capelo marca quem também orienta ou coorienta. Um nome de coleção não carregada também abre o dossiê: carregamos só as coleções da pessoa, o que substitui a análise atual. A correspondência é pelo nome exato; nomes iguais podem representar pessoas diferentes.</p><p>{NOTA_FILTROS} {NOTA_EXPORTACAO}</p></Dica>
    </div>
    {!indice && <p role={isError ? 'alert' : 'status'} className={isError ? 'text-sm text-amber-200' : 'text-sm text-slate-400'}>
      {isError ? 'Não foi possível consultar todo o acervo. Mostrando só as coleções carregadas.' : 'Consultando todo o acervo. Por enquanto, só as coleções carregadas.'}
    </p>}
    {linhas.length > 0 && <p className="text-sm text-slate-200">
      {papeis.charAt(0).toUpperCase() + papeis.slice(1)}, em {plural(colecoes.size, 'coleção', 'coleções')}
      {fora > 0 ? `, ${fora === 1 ? '1 delas' : `${fora} delas`} fora da seleção carregada.` : ', todas na seleção carregada.'}
    </p>}
    <div className="eco-related-table"><Tabela titulo={`Orientados de ${termo}`} linhas={tabela} notasNaDica
      vazio={indice ? 'Nenhuma orientação ou coorientação registrada para este nome em nenhuma coleção do acervo.' : 'Nenhuma orientação ou coorientação nas coleções carregadas.'}
      colunas={[
        { chave: 'nome', rotulo: 'Pessoa', render: (l) => {
          const nome = String(l.nome);
          return <BotaoEntidade tipo="Pessoa" nome={nome} onClick={() => void abrir(nome)} icone={ehOrientador(nome)
            ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-eco-action/20 text-eco-action" title="Também orientador ou coorientador"><GraduationCap size={15} aria-hidden="true" /><span className="sr-only">Também orientador ou coorientador:</span></span>
            : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-eco-accent/10 text-eco-accent"><UserRound size={14} aria-hidden="true" /></span>} />;
        } },
        { chave: 'relacao', rotulo: 'Relação (trabalhos)' },
        { chave: 'niveis', rotulo: 'Tipo registrado' },
        { chave: 'colecoes', rotulo: 'Coleções' },
        { chave: 'periodo', rotulo: 'Período' },
      ]} /></div>
    {status && <p role="status" className="text-xs text-slate-300">{status}</p>}
  </section>;
}
