import { useSessionField } from '@/hooks/useSessionField';
import { mesmaSelecao } from '@/lib/selecao';
import { useQuery } from '@tanstack/react-query';
import { Plug, Rocket } from 'lucide-react';
import { ColecoesPicker, DetalhesCobertura, resumoCobertura } from './ColecoesPicker';
import { ObjetivosUso } from './ObjetivosUso';
import { carregarCobertura } from '@/lib/colecoes';
import { objetivoPorId } from '@/lib/objetivos';
import { TutorialModal } from './TutorialModal';
import { Aviso, Carregando } from '@/components/ui/primitives';
import { PanoramaCapes } from '@/components/dashboard/PanoramaCapes';
import { carregarCatalogoProgramas, carregarCatalogoTCC } from '@/lib/data-loader';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { carregarDados } from '@/services/calculos';
import { Atividade } from '@/components/ui/Atividade';

/**
 * Tela de seleção de coleções.
 * O Panorama Global da CAPES é independente da seleção e carrega sozinho,
 * exatamente como no Streamlit (Principal.py:167).
 */
export function SelecaoInicial({ edicao = false, onVoltar }: { edicao?: boolean; onVoltar?: () => void }) {
  const programasAtivos = useEcoGradStore((s) => s.programasSelecionados);
  const cursosAtivos = useEcoGradStore((s) => s.cursosTccSelecionados);
  const salvarProgramas = useEcoGradStore((s) => s.setProgramas);
  const salvarCursos = useEcoGradStore((s) => s.setCursosTcc);
  const [rascunho, setRascunho] = useSessionField('selecao.rascunho', { programas: programasAtivos, cursosTcc: cursosAtivos });
  const programas = edicao ? rascunho.programas : programasAtivos;
  const cursosTcc = edicao ? rascunho.cursosTcc : cursosAtivos;
  const setProgramas = (v: string[]) => edicao ? setRascunho((s) => ({ ...s, programas: v })) : salvarProgramas(v);
  const setCursosTcc = (v: string[]) => edicao ? setRascunho((s) => ({ ...s, cursosTcc: v })) : salvarCursos(v);
  const [objetivo] = useSessionField('entrada.objetivo', 'panorama');
  const cobertura = useQuery({ queryKey: ['colecoes-cobertura', 2], queryFn: ({ signal }) => carregarCobertura(signal), staleTime: 0 });
  const carregando = useEcoGradStore((s) => s.carregando);
  const catalogoPPG = useQuery({
    queryKey: ['catalogo-programas'],
    queryFn: ({ signal }) => carregarCatalogoProgramas(signal),
  });

  const catalogoTCC = useQuery({
    queryKey: ['catalogo-tcc'],
    queryFn: ({ signal }) => carregarCatalogoTCC(signal),
  });

  const opcoesPPG = catalogoPPG.data ? Object.keys(catalogoPPG.data).sort((a, b) => a.localeCompare(b, 'pt-BR')) : [];
  const opcoesTCC = catalogoTCC.data
    ? [...new Set(catalogoTCC.data.map((t) => t.curso).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    : [];

  const selecionadas = [...programas.map((nome) => ({ nome, tipo: 'ppg' })), ...cursosTcc.map((nome) => ({ nome, tipo: 'tcc' }))];
  const semRegistros = !cobertura.isError && selecionadas.length > 0 && selecionadas.every((s) => cobertura.data?.colecoes.some((c) => c.nome === s.nome && c.tipo === s.tipo && c.total === 0));
  const carregar = () => {
    if (semRegistros) return;
    if (edicao && mesmaSelecao({ programas, cursosTcc }, { programas: programasAtivos, cursosTcc: cursosAtivos })) onVoltar?.();
    else carregarDados(programas, cursosTcc, edicao ? undefined : objetivoPorId(objetivo).id);
  };

  const temSelecao = programas.length > 0 || cursosTcc.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-1 pb-6 pt-2 sm:px-3">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Plug size={22} className="shrink-0" /> {edicao ? 'Coleções da análise' : 'Escolha o recorte da sua pesquisa'}
        </h1>
        <p className="text-sm text-slate-400">
          {edicao ? 'Altere as coleções e aplique quando estiver pronto. O rascunho fica salvo ao fechar esta janela. A análise atual só muda ao aplicar.' : 'Escolha um objetivo, confira as coleções e revise a cobertura antes de carregar os documentos.'}
        </p>
      </header>

      <TutorialModal><button type="button" className="btn">Ajuda para escolher e explorar</button></TutorialModal>
      {!edicao && <fieldset disabled={carregando}><ObjetivosUso /></fieldset>}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{edicao ? 'Confira as coleções' : '2. Quais coleções respondem à sua pergunta?'}</h2>
        <p className="text-sm text-slate-300">Os catálogos de teses/dissertações e de TCCs são acervos diferentes. O catálogo de TCCs também inclui especializações. Preserve os qualificadores de modalidade, campus e identificador ao escolher entre nomes parecidos.</p>
        <p className="text-xs text-slate-400">Cobertura do recorte local do EcoGrad, não o total atual da UFSC ou da CAPES. Anos e tipos reproduzem os metadados da base; a data da coleta não está informada. “Outros” não foi reclassificado como tese ou TCC.</p>
        {cobertura.isLoading && <Carregando texto="Conferindo a cobertura das coleções..." />}
        {cobertura.isError && <Aviso tipo="aviso">A cobertura não pôde ser confirmada. Você pode selecionar coleções, mas os números da prévia não estão disponíveis.<button type="button" className="btn ml-2" onClick={() => void cobertura.refetch()}>Atualizar prévia</button></Aviso>}
        {cobertura.data && !cobertura.isError && <p className="text-xs text-slate-400">Versão da base: {cobertura.data.version.slice(0, 12)} · Presença de metadados não garante sua qualidade nem acesso ao texto completo.</p>}
      </section>

      {(catalogoPPG.isError || catalogoTCC.isError) && (
        <Aviso tipo="erro">
          Não foi possível carregar um dos catálogos. Sua seleção foi mantida.
          <button type="button" className="btn ml-2" onClick={() => { void catalogoPPG.refetch(); void catalogoTCC.refetch(); }}>Tentar novamente</button>
        </Aviso>
      )}

      <fieldset disabled={carregando} className="grid min-w-0 gap-6 md:grid-cols-2">
        {catalogoPPG.isLoading ? (
          <Carregando texto="Carregando catálogo de Pós-Graduação..." />
        ) : (
          <ColecoesPicker
            rotulo="Pós-Graduação (Teses e Dissertações)"
            tipo="ppg"
            colecoes={cobertura.isError ? undefined : cobertura.data?.colecoes}
            opcoes={opcoesPPG.map((nome) => ({ nome, specs: [catalogoPPG.data![nome]] }))}
            selecionados={programas}
            onChange={setProgramas}
          />
        )}
        {catalogoTCC.isLoading ? (
          <Carregando texto="Carregando catálogo de TCCs..." />
        ) : (
          <ColecoesPicker
            rotulo="TCCs (graduação e especialização)"
            tipo="tcc"
            colecoes={cobertura.isError ? undefined : cobertura.data?.colecoes}
            opcoes={opcoesTCC.map((nome) => ({ nome, specs: [...new Set(catalogoTCC.data!.filter((c) => c.curso === nome).map((c) => c.setSpec))] }))}
            selecionados={cursosTcc}
            onChange={setCursosTcc}
          />
        )}
      </fieldset>

      {temSelecao && <section className="space-y-3 rounded-xl border border-eco-accent/40 p-4" aria-label="Revisão da seleção">
        <h2 className="text-lg font-semibold">{edicao ? 'Revisar alterações' : '3. Revise antes de carregar'}</h2>
        <p className="text-sm">{programas.length} coleções de pós-graduação · {cursosTcc.length} de TCCs</p>
        {(['ppg', 'tcc'] as const).flatMap((tipo) => (tipo === 'ppg' ? programas : cursosTcc).map((nome) => {
          const c = cobertura.isError ? undefined : cobertura.data?.colecoes.find((c) => c.tipo === tipo && c.nome === nome);
          return <div key={tipo + nome} className="space-y-2 border-t border-eco-border pt-3">
            <p className="text-sm font-semibold break-words">{nome}</p><p className="text-sm text-slate-300">{resumoCobertura(c)}</p>
            {c && <details><summary className="cursor-pointer py-2 text-sm text-eco-accent">Conferir metadados de {nome}</summary><DetalhesCobertura c={c} /></details>}
            <button type="button" className="btn text-xs" disabled={carregando} onClick={() => tipo === 'ppg' ? setProgramas(programas.filter((n) => n !== nome)) : setCursosTcc(cursosTcc.filter((n) => n !== nome))}>Remover {nome}</button>
          </div>;
        }))}
        {cobertura.data && !cobertura.isError && <p className="text-xs text-slate-300">Download das coleções escolhidas: aproximadamente {(cobertura.data.colecoes.filter(c => (c.tipo === 'ppg' ? programas : cursosTcc).includes(c.nome)).reduce((total, c) => total + c.downloadBytes, 0) / 1024 / 1024).toFixed(2)} MiB comprimidos, além dos catálogos. Apenas as coleções selecionadas serão baixadas; arquivos já disponíveis no cache podem ser reutilizados. Coleções podem conter registros sobrepostos; somar volumes não produz um total de trabalhos únicos.</p>}
        {!edicao && <p className="text-sm text-slate-300">Objetivo: {objetivoPorId(objetivo).titulo}. Após carregar, abriremos a ferramenta correspondente, ou a página de um link direto que você esteja retomando.</p>}
      </section>}

      <Atividade id="dados" />

      {semRegistros && <Aviso>As coleções selecionadas não têm registros neste recorte. Escolha uma coleção com registros para iniciar a análise.</Aviso>}
      {temSelecao ? (
        carregando ? (
          <p className="text-sm text-slate-400">Aguarde o carregamento ou cancele a atividade para alterar a seleção.</p>
        ) : (
          <button type="button" className="btn btn-primary w-full py-3" disabled={semRegistros} onClick={carregar}>
            <Rocket size={16} className="shrink-0" /> {edicao ? 'Aplicar seleção' : 'Carregar e explorar a seleção'}
          </button>
        )
      ) : (
        <Aviso>💡 Aguardando seleção de coleções acima para habilitar a análise detalhada.</Aviso>
      )}

      {edicao && <button type="button" className="btn" disabled={carregando} onClick={() => setRascunho({ programas: programasAtivos, cursosTcc: cursosAtivos })}>Descartar alterações do rascunho</button>}
      {edicao ? <button type="button" className="btn" onClick={onVoltar}>Voltar à análise</button> : <><hr className="border-eco-border" /><PanoramaCapes /></>}
    </div>
  );
}
