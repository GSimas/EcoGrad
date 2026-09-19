import { useMemo, useRef, useState } from 'react';
import { Check, FileDown, Square } from 'lucide-react';
import { Janela } from './Janela';
import { Aviso } from '@/components/ui/primitives';
import { useSessionField } from '@/hooks/useSessionField';
import { useNavigation } from '@/services/navigation';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { gerarPDF } from '@/lib/relatorio-pdf';
import { montarRelatorio, passosDoRelatorio, type ProgressoRelatorio } from '@/services/relatorio';
import {
  dossiesVisitados, SECOES_DASHBOARD, selecaoInicial, selecaoValida, selecaoVazia,
  type SelecaoRelatorio, type TemaRelatorio,
} from '@/lib/relatorio';
import { cn } from '@/lib/utils';

/** Caixa de marcação com a mesma aparência das listas do EcoGrad. */
function Item({ marcado, onToggle, titulo, descricao }: { marcado: boolean; onToggle: () => void; titulo: string; descricao: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={marcado} onClick={onToggle}
      className={cn('flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition',
        marcado ? 'border-eco-accent/50 bg-eco-accent/10' : 'border-eco-border hover:bg-white/5')}>
      <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        marcado ? 'border-eco-accent bg-eco-action text-black' : 'border-eco-border')}>
        {marcado && <Check size={11} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-100">{titulo}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{descricao}</span>
      </span>
    </button>
  );
}

/**
 * Exportação do relatório em PDF.
 *
 * O usuário escolhe as seções do Dashboard e quais dossiês entram; o PDF é
 * montado no navegador, sem enviar nada para servidor nenhum. Os gráficos de
 * abas que ele nunca abriu são redesenhados fora da tela, e é isso que leva
 * segundos — daí a barra e o botão de interromper.
 */
export function ExportarRelatorio({ compacto = false }: { compacto?: boolean }) {
  const [aberta, setAberta] = useState(false);
  const [salvo, setSalvo] = useSessionField<SelecaoRelatorio>('relatorio.selecao', selecaoInicial());
  const selecao = useMemo(() => selecaoValida(salvo), [salvo]);
  const [progresso, setProgresso] = useState<ProgressoRelatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);
  const controle = useRef<AbortController | null>(null);

  const visits = useNavigation((s) => s.visits);
  const buscaTipo = useEcoGradStore((s) => s.buscaTipo);
  const buscaTermo = useEcoGradStore((s) => s.buscaTermo);
  const docs = useEcoGradStore((s) => s.docs);

  const dossies = useMemo(
    () => dossiesVisitados(visits, { tipo: buscaTipo, termo: buscaTermo }),
    [visits, buscaTipo, buscaTermo],
  );

  const alternar = (chave: 'dashboard' | 'dossies', id: string) => setSalvo((atual) => {
    const base = selecaoValida(atual);
    const lista = base[chave];
    return { ...base, [chave]: lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id] };
  });
  const definirTema = (tema: TemaRelatorio) => setSalvo((atual) => ({ ...selecaoValida(atual), tema }));
  const marcarTudo = (marcar: boolean) => setSalvo((atual) => ({
    ...selecaoValida(atual),
    dashboard: marcar ? SECOES_DASHBOARD.filter((s) => !s.ia).map((s) => s.id) : [],
    dossies: marcar ? dossies.map((d) => d.chave) : [],
  }));

  const exportar = async () => {
    const request = new AbortController();
    controle.current = request;
    setErro(null);
    setPronto(null);
    setProgresso({ feitos: 0, total: passosDoRelatorio(selecao), etapa: 'Reunindo a análise' });
    try {
      const relatorio = await montarRelatorio(selecao, setProgresso, request.signal);
      setProgresso({ feitos: passosDoRelatorio(selecao), total: passosDoRelatorio(selecao), etapa: 'Montando o PDF' });
      const blob = await gerarPDF(relatorio, selecao.tema);
      if (request.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = relatorio.arquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPronto(relatorio.arquivo);
    } catch (e) {
      setErro(request.signal.aborted
        ? 'Geração interrompida por você. Nada foi baixado.'
        : `Não foi possível gerar o relatório: ${e instanceof Error ? e.message : 'erro desconhecido'}.`);
    } finally {
      setProgresso(null);
      if (controle.current === request) controle.current = null;
    }
  };

  const gerando = progresso !== null;
  const nada = selecaoVazia(selecao);

  return (
    <Janela
      aberta={aberta}
      onOpenChange={(v) => { if (!gerando) setAberta(v); }}
      larga
      titulo="Exportar relatório em PDF"
      descricao="Escolha o que entra no documento. O PDF é montado no seu navegador; nada é enviado para servidor."
      trigger={
        <button type="button" className="btn min-h-11" aria-label="Exportar relatório em PDF" title="Exportar relatório em PDF">
          <FileDown size={18} />{!compacto && 'Exportar relatório'}
        </button>
      }
    >
      <div className="space-y-5">
        {docs.length === 0 && <Aviso tipo="aviso">Nenhuma coleção carregada: não há análise para relatar.</Aviso>}

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{selecao.dashboard.length + selecao.dossies.length} {selecao.dashboard.length + selecao.dossies.length === 1 ? 'seção marcada' : 'seções marcadas'}</span>
          <button type="button" className="btn text-xs" onClick={() => marcarTudo(true)} disabled={gerando}>Marcar tudo</button>
          <button type="button" className="btn text-xs" onClick={() => marcarTudo(false)} disabled={gerando}>Desmarcar tudo</button>
        </div>

        <section className="space-y-2" aria-label="Seções do Dashboard">
          <h3 className="text-sm font-semibold text-slate-200">Dashboard</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECOES_DASHBOARD.map((s) => (
              <Item key={s.id} titulo={s.ia ? `${s.rotulo} · IA` : s.rotulo} descricao={s.descricao}
                marcado={selecao.dashboard.includes(s.id)} onToggle={() => alternar('dashboard', s.id)} />
            ))}
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Seções marcadas com <strong>IA</strong> trazem texto escrito por modelo de linguagem, e saem no PDF dentro de uma tarja de aviso. Por isso começam desmarcadas.
          </p>
        </section>

        <section className="space-y-2" aria-label="Dossiês do Motor de Busca">
          <h3 className="text-sm font-semibold text-slate-200">Motor de Busca</h3>
          {dossies.length === 0 ? (
            <Aviso>Nenhum dossiê visitado nesta análise. Abra uma pessoa, um tema ou um documento no Motor de Busca e ele aparece aqui.</Aviso>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {dossies.map((d) => (
                <Item key={d.chave} titulo={`${d.tipo}: ${d.termo || 'Sem título'}`}
                  descricao="Indicadores, análises aplicáveis e trabalhos associados deste dossiê."
                  marcado={selecao.dossies.includes(d.chave)} onToggle={() => alternar('dossies', d.chave)} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2" aria-label="Tema do PDF">
          <h3 className="text-sm font-semibold text-slate-200">Tema do PDF</h3>
          <div className="flex flex-wrap gap-1 rounded-lg border border-eco-border bg-eco-panel/60 p-1">
            {(['claro', 'escuro'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={selecao.tema === t} disabled={gerando} onClick={() => definirTema(t)}
                className={cn('min-h-9 rounded-md px-3 py-1.5 text-sm capitalize transition',
                  selecao.tema === t ? 'bg-eco-action text-black' : 'text-slate-400 hover:bg-white/5')}>
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">Claro é o padrão: um PDF escuro imprime mal e consome tinta.</p>
        </section>

        {gerando && (
          <div className="space-y-2" role="status">
            <p className="text-sm text-slate-200">Gerando relatório… {progresso.etapa}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-eco-border">
              <div className="h-full bg-eco-action transition-[width]"
                style={{ width: `${progresso.total ? Math.round((progresso.feitos / progresso.total) * 100) : 0}%` }} />
            </div>
            <p className="text-xs text-slate-400">{progresso.feitos} de {progresso.total} seções · gráficos de abas fechadas são redesenhados fora da tela.</p>
            <button type="button" className="btn text-xs" onClick={() => controle.current?.abort()}>
              <Square size={14} className="shrink-0" aria-hidden /> Interromper
            </button>
          </div>
        )}

        {erro && <Aviso tipo="erro"><p role="alert">{erro}</p></Aviso>}
        {pronto && <Aviso tipo="sucesso"><p role="status">Relatório baixado: {pronto}</p></Aviso>}

        <div className="flex flex-wrap gap-2 border-t border-eco-border pt-4">
          <button type="button" className="btn btn-primary" disabled={gerando || nada || docs.length === 0} onClick={() => void exportar()}>
            <FileDown size={16} className="shrink-0" aria-hidden /> Gerar PDF
          </button>
          {nada && <p className="self-center text-xs text-slate-400">Marque ao menos uma seção.</p>}
        </div>

        <p className="text-xs leading-relaxed text-slate-400">
          Todo relatório sai com capa, coleções, período, versão da base, data de geração e as ressalvas sobre os limites do recorte — essas não são desmarcáveis, porque um PDF circula longe da tela que as explica.
        </p>
      </div>
    </Janela>
  );
}
