import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Aviso, Card } from '@/components/ui/primitives';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { SelectBusca } from '@/components/ui/MultiSelect';
import { Dossie } from './Dossie';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { docsDoTermo } from '@/lib/entities';
import { resolverDocumento } from '@/lib/resultados';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { useSessionField } from '@/hooks/useSessionField';
import { CATEGORIAS, ORIGENS, PAPEIS, TODOS, categoriaDe, categoriaPorId, categoriaTem, etiqueta, idPorRotulo, montarCatalogo, type Categoria } from '@/lib/busca-categorias';

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

  const [categoriaEscolhida, setCategoria] = useSessionField<Categoria>('busca.categoria', 'tudo');
  const [papel, setPapel] = useSessionField<string>('busca.papel', TODOS);
  const [origem, setOrigem] = useSessionField<string>('busca.origem', TODOS);

  // Chegar num dossiê fora da categoria aberta — por um atalho de papel ou um
  // link antigo — reposiciona a barra em vez de deixá-la mentindo.
  const categoria = buscaTermo !== null && !categoriaTem(categoriaEscolhida, buscaTipo)
    ? categoriaDe(buscaTipo)
    : categoriaEscolhida;

  const catalogo = useMemo(() => montarCatalogo(indices, categoria, papel, origem), [indices, categoria, papel, origem]);
  const opcoes = useMemo(() => [...catalogo.keys()], [catalogo]);

  const docsAlvo = useMemo(
    () => {
      if (buscaTermo === null) return [];
      if (buscaTipo === 'Documento') { const d = resolverDocumento(docs, buscaTermo, referencia); return d ? [d] : []; }
      return docsDoTermo(indices, buscaTipo, buscaTermo);
    },
    [docs, indices, buscaTipo, buscaTermo, referencia],
  );

  const chave = `${categoria}:${papel}:${origem}`;
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Search size={22} /> Motor de Busca e Dossiê
        </h1>
        <p className="text-sm text-slate-400">
          Busca unificada por documentos, pessoas e temas. A etiqueta ao lado de cada item mostra de onde ele vem.
        </p>
      </header>

      <Card className="space-y-4">
        <GrupoOpcoes
          rotulo="Procurar por"
          opcoes={CATEGORIAS.map((c) => c.rotulo)}
          valor={categoriaPorId(categoria).rotulo}
          onChange={(r) => { setCategoria(idPorRotulo(r)); navegarPara(buscaTipo, null); }}
        />
        {(categoria === 'pessoas' || categoria === 'temas') && (
          <GrupoOpcoes
            rotulo={categoria === 'pessoas' ? 'Papel no recorte' : 'Origem do tema'}
            opcoes={[...(categoria === 'pessoas' ? PAPEIS : ORIGENS)]}
            valor={categoria === 'pessoas' ? papel : origem}
            onChange={(v) => { (categoria === 'pessoas' ? setPapel : setOrigem)(v); navegarPara(buscaTipo, null); }}
          />
        )}
        <SelectBusca
          key={chave}
          sessionKey={chave}
          rotulo={categoria === 'documentos' ? 'Selecione um documento'
            : categoria === 'pessoas' ? 'Selecione uma pessoa'
              : categoria === 'temas' ? 'Selecione um tema' : 'Selecione qualquer item'}
          opcoes={opcoes}
          valor={buscaTermo !== null ? `${buscaTermo} (${etiqueta(buscaTipo, buscaTermo, indices)})` : null}
          onChange={(v) => {
            const item = v ? catalogo.get(v) : undefined;
            navegarPara(item?.tipo ?? buscaTipo, item?.nome ?? null);
          }}
        />
      </Card>

      {buscaTermo === null && (
        <Aviso>
          Escolha uma categoria, digite parte do nome ou título e confirme uma opção do catálogo. Pessoas reúnem autoria, orientação e coorientação num dossiê só. Em Temas, palavras-chave vêm do autor e macrotemas são classificação da base: rótulos iguais podem representar conjuntos diferentes de trabalhos.
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
