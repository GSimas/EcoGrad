import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Aviso, Card } from '@/components/ui/primitives';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { SelectBusca } from '@/components/ui/MultiSelect';
import { Dossie } from './Dossie';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { docsDoTermo, opcoesPorTipo } from '@/lib/entities';
import { resolverDocumento } from '@/lib/resultados';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { useSessionField } from '@/hooks/useSessionField';
import type { TipoBusca } from '@/types';

const TIPOS: TipoBusca[] = [
  'Documento',
  'Autor',
  'Orientador',
  'Co-orientador',
  'Palavra-chave',
  'Macrotema',
];

const TODOS = 'Todos';
const ordemNome = new Intl.Collator('pt-BR').compare;

/** Motor de Busca e Dossiê (Principal.py:601-1190). */
export function MotorBusca() {
  const { docs, indices } = useDadosDerivados();
  const snaGlobal = useEcoGradStore((s) => s.snaGlobal);
  const buscaTipo = useEcoGradStore((s) => s.buscaTipo);
  const buscaTermo = useEcoGradStore((s) => s.buscaTermo);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);

  const referencia = useEcoGradStore((s) => s.ui['dossie.documento']);
  const navegarDocumento = useEcoGradStore((s) => s.navegarDocumento);
  const candidatos = useMemo(() => buscaTipo === 'Documento' && buscaTermo !== null ? docs.map((doc, indice) => ({ doc, indice })).filter(({ doc }) => doc.titulo === buscaTermo) : [], [docs, buscaTipo, buscaTermo]);

  const opcoes = useMemo(() => opcoesPorTipo(indices, buscaTipo), [indices, buscaTipo]);

  // "Todos" é um modo da tela, não um tipo: ao escolher um item, o dossiê abre
  // com o tipo real dele, e histórico e sessão seguem validando só tipos reais.
  const [todos, setTodos] = useSessionField('busca.todos', false);
  const catalogoTodos = useMemo(() => {
    if (!todos) return new Map<string, { tipo: TipoBusca; nome: string }>();
    // ponytail: filtro linear sobre todos os tipos a cada tecla; indexar por prefixo se ficar lento
    const itens = TIPOS.flatMap((tipo) => opcoesPorTipo(indices, tipo).map((nome) => ({ rotulo: `${nome} (${tipo})`, tipo, nome })));
    itens.sort((a, b) => ordemNome(a.nome, b.nome) || ordemNome(a.tipo, b.tipo));
    return new Map(itens.map((i) => [i.rotulo, { tipo: i.tipo, nome: i.nome }]));
  }, [todos, indices]);
  const opcoesTodos = useMemo(() => [...catalogoTodos.keys()], [catalogoTodos]);
  const docsAlvo = useMemo(
    () => {
      if (buscaTermo === null) return [];
      if (buscaTipo === 'Documento') { const d = resolverDocumento(docs, buscaTermo, referencia); return d ? [d] : []; }
      return docsDoTermo(indices, buscaTipo, buscaTermo);
    },
    [docs, indices, buscaTipo, buscaTermo, referencia],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Search size={22} /> Motor de Busca e Dossiê
        </h1>
        <p className="text-sm text-slate-400">
          Busca unificada por Documento, Autor, Orientador, Co-orientador, Palavra-chave e Macrotema.
        </p>
      </header>

      <Card className="space-y-4">
        <GrupoOpcoes
          rotulo="Procurar por entidade"
          opcoes={[TODOS, ...TIPOS]}
          valor={todos ? TODOS : buscaTipo}
          onChange={(t) => {
            setTodos(t === TODOS);
            navegarPara(t === TODOS ? buscaTipo : t as TipoBusca, null);
          }}
        />
        {todos ? (
          <SelectBusca
            key={TODOS}
            sessionKey={TODOS}
            rotulo="Selecione qualquer item (documento, pessoa, palavra-chave ou macrotema)"
            opcoes={opcoesTodos}
            valor={buscaTermo !== null ? `${buscaTermo} (${buscaTipo})` : null}
            onChange={(v) => {
              const item = v ? catalogoTodos.get(v) : undefined;
              navegarPara(item?.tipo ?? buscaTipo, item?.nome ?? null);
            }}
          />
        ) : (
          <SelectBusca
            key={buscaTipo}
            sessionKey={buscaTipo}
            rotulo={`Selecione ${buscaTipo.toLowerCase()}`}
            opcoes={opcoes}
            valor={buscaTermo}
            onChange={(v) => navegarPara(buscaTipo, v)}
          />
        )}
      </Card>

      {buscaTermo === null && (
        <Aviso>
          Escolha um tipo, digite parte do nome ou título e confirme uma opção do catálogo. Em Todos, a lista reúne itens de qualquer tipo. O dossiê reúne trabalhos, resumos e fontes; gráficos e análises ficam logo acima dos trabalhos associados.
        </Aviso>
      )}

      {buscaTermo !== null && docsAlvo.length === 0 && candidatos.length <= 1 && (
        <Aviso tipo="aviso">Nenhum documento associado a &quot;{buscaTermo}&quot; nesta base.</Aviso>
      )}

      {candidatos.length > 1 && <section className="space-y-3" aria-label="Escolher registro do título">
        <h2 className="text-lg font-semibold">Este título aparece em {candidatos.length} registros</h2>
        <p className="text-sm text-slate-300">Escolha pela coleção, ano, autoria e fonte. Os registros não foram fundidos.</p>
        <div className="space-y-2">{candidatos.map(({ doc, indice }) => <button type="button" key={indice} className="btn flex w-full flex-col items-start text-left" aria-pressed={docsAlvo[0] === doc} onClick={() => navegarDocumento(indice)}><span>{doc.programa_origem || 'Origem não informada'} · {doc.ano ?? 'Sem ano'}</span><span>{doc.autores.join('; ') || 'Autoria não informada'}</span><span className="break-all text-xs">{doc.url || 'Sem link de fonte'}</span></button>)}</div>
      </section>}
      {buscaTermo !== null && docsAlvo.length > 0 && (
        <div className="space-y-6">
          <h2 className="break-words text-xl font-semibold">{buscaTipo}: {buscaTermo || 'Trabalho sem título'}</h2>

          <Dossie
            termo={buscaTermo}
            tipo={buscaTipo}
            docsAlvo={docsAlvo}
            dadosCompletos={docs}
            snaGlobal={snaGlobal}
          />
        </div>
      )}
    </div>
  );
}
