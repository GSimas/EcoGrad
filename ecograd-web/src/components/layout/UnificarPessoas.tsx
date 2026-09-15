import { useEffect, useMemo, useState } from 'react';
import { Merge, Undo2 } from 'lucide-react';
import { Janela } from './Janela';
import { cn } from '@/lib/utils';
import { variacaoDoMesmoNome } from '@/lib/unificacao';
import { grupoDe, usePessoas } from '@/services/pessoas';
import { PAPEIS_PESSOA, type TipoBusca } from '@/types';

export interface Candidato { nome: string; tipo: TipoBusca; registros: number }

/** Só nomes de pessoa se fundem: palavra-chave e macrotema descrevem o conteúdo. */
export const ehPessoa = (tipo: TipoBusca) => (PAPEIS_PESSOA as readonly string[]).includes(tipo) || tipo === 'Pessoa';

/**
 * Sugere qual grafia liderar: a mais completa costuma ser a mais informativa, e
 * em caso de empate vence a que tem mais registros.
 */
function sugerirCanonico(candidatos: readonly Candidato[]) {
  return [...candidatos].sort((a, b) => b.nome.length - a.nome.length || b.registros - a.registros)[0]?.nome ?? '';
}

/** Grafias distintas escolhidas, com o total de registros de cada uma. */
function agrupar(candidatos: readonly Candidato[]) {
  const por = new Map<string, number>();
  for (const c of candidatos) por.set(c.nome, (por.get(c.nome) ?? 0) + c.registros);
  return [...por].map(([nome, registros]) => ({ nome, registros })).sort((a, b) => b.registros - a.registros);
}

/**
 * Fusão de grafias que representam a mesma pessoa. A escolha vale para toda a
 * análise e fica salva neste navegador — é conhecimento sobre o acervo, não
 * sobre o recorte carregado.
 */
export function UnificarPessoas({ candidatos, classe, desabilitado = false, aoUnificar }: {
  candidatos: readonly Candidato[];
  classe?: string;
  desabilitado?: boolean;
  aoUnificar?: (canonico: string) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const grupos = usePessoas((s) => s.grupos);
  const erro = usePessoas((s) => s.erro);
  const unificar = usePessoas((s) => s.unificar);
  const desfazer = usePessoas((s) => s.desfazer);

  const grafias = useMemo(() => agrupar(candidatos), [candidatos]);
  const [canonico, setCanonico] = useState('');
  // A sugestão acompanha a seleção enquanto a janela está fechada; depois de
  // aberta, a escolha do usuário manda.
  useEffect(() => { if (!aberta) setCanonico(sugerirCanonico(candidatos)); }, [aberta, candidatos]);

  const suficiente = grafias.length >= 2;
  // Todas precisam ser variações da grafia mais completa; basta uma destoar
  // para o aviso aparecer.
  const parecidos = suficiente && grafias.every((g) => variacaoDoMesmoNome(g.nome, canonico || grafias[0].nome));
  const total = grafias.reduce((s, g) => s + g.registros, 0);

  const confirmar = () => {
    unificar(canonico, grafias.map((g) => g.nome));
    setAberta(false);
    aoUnificar?.(canonico);
  };

  return <Janela
    titulo="Unificar pessoas"
    descricao="Junte grafias diferentes da mesma pessoa num nome só. Vale para toda a análise e fica salvo neste navegador."
    aberta={aberta}
    onOpenChange={setAberta}
    larga
    trigger={<button type="button" className={cn(classe ?? 'btn', 'disabled:cursor-not-allowed disabled:opacity-60')} disabled={desabilitado || (!suficiente && grupos.length === 0)}
      title={suficiente ? 'Unificar as pessoas selecionadas' : grupos.length ? 'Revisar as pessoas já unificadas' : 'Selecione duas ou mais pessoas para unificar'}>
      <Merge size={16} className="shrink-0" /> {suficiente ? `Unificar ${grafias.length} pessoas` : grupos.length ? `Pessoas unificadas (${grupos.length})` : 'Unificar pessoas'}
    </button>}
  >
    <div className="space-y-5">
      {!suficiente && <p className="info">Selecione duas ou mais pessoas na busca para criar uma fusão. Abaixo estão as que já valem neste navegador.</p>}
      {suficiente && <section className="space-y-2">
        <h3 className="text-sm font-semibold">Qual nome deve valer?</h3>
        <p className="text-xs text-slate-400">As demais grafias passam a apontar para ele em todo o EcoGrad: busca, dossiês, indicadores e redes. A fusão é reversível e não altera as fontes originais.</p>
        <ul className="space-y-1.5">
          {grafias.map((g) => {
            const jaFundido = grupoDe(grupos, g.nome);
            return <li key={g.nome}>
              <label className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', g.nome === canonico ? 'border-eco-accent bg-eco-accent/10' : 'border-eco-border bg-eco-panel')}>
                <input type="radio" name="canonico" className="mt-1 shrink-0" checked={g.nome === canonico} onChange={() => setCanonico(g.nome)} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{g.nome}</span>
                  <span className="block text-xs text-slate-400">
                    {g.registros.toLocaleString('pt-BR')} {g.registros === 1 ? 'registro' : 'registros'}
                    {jaFundido && jaFundido.canonico !== g.nome && ` · hoje já aponta para “${jaFundido.canonico}”`}
                  </span>
                </span>
              </label>
            </li>;
          })}
        </ul>
      </section>}

      {suficiente && !parecidos && <p className="aviso">Os nomes escolhidos não são variações de uma mesma grafia. Confira nas fontes antes de fundir: nomes distintos costumam ser pessoas distintas.</p>}
      {erro && <p role="alert" className="aviso">O navegador não permitiu salvar as fusões. Elas valem nesta página até você recarregar.</p>}

      <div className="flex flex-wrap gap-3">
        {suficiente && <button type="button" className="btn btn-primary" onClick={confirmar} disabled={!canonico}>
          <Merge size={16} className="shrink-0" /> Unificar em “{canonico}” ({total.toLocaleString('pt-BR')} registros)
        </button>}
        <button type="button" className="btn" onClick={() => setAberta(false)}>{suficiente ? 'Cancelar' : 'Fechar'}</button>
      </div>

      {grupos.length > 0 && <section className="space-y-2 border-t border-eco-border pt-4">
        <h3 className="text-sm font-semibold">Fusões salvas neste navegador</h3>
        <ul className="space-y-2">
          {grupos.map((g) => <li key={g.canonico} className="rounded-lg border border-eco-border bg-eco-panel p-3">
            <p className="break-words text-sm font-medium text-eco-accent">{g.canonico}</p>
            <p className="mt-1 break-words text-xs text-slate-400">Reúne: {g.grafias.filter((x) => x !== g.canonico).join(' · ')}</p>
            <button type="button" className="btn mt-2 text-xs" onClick={() => desfazer(g.canonico)}>
              <Undo2 size={13} className="shrink-0" /> Desfazer esta fusão
            </button>
          </li>)}
        </ul>
      </section>}
    </div>
  </Janela>;
}
