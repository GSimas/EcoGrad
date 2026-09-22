import { useMemo, useRef, useState } from 'react';
import { Check, FileDown, Square } from 'lucide-react';
import { Janela } from './Janela';
import { Aviso } from '@/components/ui/primitives';
import { useSessionField } from '@/hooks/useSessionField';
import { useNavigation } from '@/services/navigation';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { gerarPDF } from '@/lib/relatorio-pdf';
import { estimarTamanho, montarRelatorioJson, tamanhoLegivel } from '@/lib/relatorio-json';
import { montarRelatorio, passosDoRelatorio, type ProgressoRelatorio } from '@/services/relatorio';
import {
  dossiesVisitados, SECOES_DASHBOARD, selecaoInicial, selecaoValida, selecaoVazia,
  type FormatoRelatorio, type SelecaoRelatorio, type TemaRelatorio,
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
 * Exportação do relatório, em PDF ou em JSON.
 *
 * O usuário escolhe as seções do Dashboard e quais dossiês entram; o arquivo é
 * montado no navegador, sem enviar nada para servidor nenhum. No PDF, os
 * gráficos de abas que ele nunca abriu são redesenhados fora da tela, e é isso
 * que leva segundos — daí a barra e o botão de interromper.
 *
 * O JSON leva o mesmo conteúdo em estrutura endereçável e, além dele, os
 * registros completos da análise, com resumo e palavras-chave no formato da
 * base de origem. Sem gráfico a desenhar, ele sai quase instantâneo.
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
  const recorte = useEcoGradStore((s) => s.recorte);

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
  const definirFormato = (formato: FormatoRelatorio) => setSalvo((atual) => ({ ...selecaoValida(atual), formato }));
  const alternarResumos = () => setSalvo((atual) => {
    const base = selecaoValida(atual);
    return { ...base, incluirResumos: !base.incluirResumos };
  });
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
      const { relatorio, contexto } = await montarRelatorio(selecao, setProgresso, request.signal);
      const passos = passosDoRelatorio(selecao);
      setProgresso({ feitos: passos, total: passos, etapa: ehJson ? 'Escrevendo o JSON' : 'Montando o PDF' });
      // O JSON é síncrono e pesado quando a base é grande: sem devolver o
      // quadro antes, a última etapa nunca chega a ser pintada.
      if (ehJson) await new Promise((r) => { setTimeout(r, 0); });
      const blob = ehJson
        ? new Blob(
            [JSON.stringify(montarRelatorioJson(relatorio, contexto, docs, { incluirResumos: selecao.incluirResumos, recorte }), null, 2)],
            { type: 'application/json;charset=utf-8' },
          )
        : await gerarPDF(relatorio, selecao.tema);
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
        : ehJson && docs.length > 20000
          // Um JSON de centenas de megabytes estoura a memória da aba antes de
          // virar texto. O caminho é reduzir o arquivo, não tentar de novo.
          ? `Não foi possível escrever o JSON desta análise, provavelmente por tamanho: ${tamanhoLegivel(estimativa)} estimados para ${docs.length.toLocaleString('pt-BR')} registros. Desmarque os resumos, ou recorte a análise antes de exportar.`
          : `Não foi possível gerar o relatório: ${e instanceof Error ? e.message : 'erro desconhecido'}.`);
    } finally {
      setProgresso(null);
      if (controle.current === request) controle.current = null;
    }
  };

  const gerando = progresso !== null;
  const nada = selecaoVazia(selecao);
  const ehJson = selecao.formato === 'json';
  const estimativa = useMemo(
    () => (ehJson ? estimarTamanho(docs, selecao.incluirResumos) : 0),
    [ehJson, docs, selecao.incluirResumos],
  );
  // Acima disto, escrever o arquivo pode derrubar a aba; o aviso vem antes.
  const arquivoEnorme = estimativa > 200 * 1024 * 1024;

  return (
    <Janela
      aberta={aberta}
      onOpenChange={(v) => { if (!gerando) setAberta(v); }}
      larga
      titulo="Exportar relatório"
      descricao="Escolha o formato e o que entra no arquivo. Tudo é montado no seu navegador; nada é enviado para servidor."
      trigger={
        <button type="button" className="btn min-h-11" aria-label="Exportar relatório" title="Exportar relatório">
          <FileDown size={18} />{!compacto && 'Exportar relatório'}
        </button>
      }
    >
      <div className="space-y-5">
        {docs.length === 0 && <Aviso tipo="aviso">Nenhuma coleção carregada: não há análise para relatar.</Aviso>}

        <section className="space-y-2" aria-label="Formato do arquivo">
          <h3 className="text-sm font-semibold text-slate-200">Formato</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Item titulo="PDF" descricao="Documento para ler e circular, com capa, tabelas e gráficos desenhados."
              marcado={!ehJson} onToggle={() => definirFormato('pdf')} />
            <Item titulo="JSON com dados completos" descricao="O mesmo conteúdo em estrutura endereçável, mais os registros da análise com resumo e palavras-chave, como na base original."
              marcado={ehJson} onToggle={() => definirFormato('json')} />
          </div>
        </section>

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

        {ehJson ? (
        <section className="space-y-2" aria-label="Registros dos documentos">
          <h3 className="text-sm font-semibold text-slate-200">Registros dos documentos</h3>
          <Item titulo="Incluir resumos e artefatos da ontologia"
            descricao="Os resumos são a maior parte do arquivo. Sem eles, cada registro ainda traz título, ano, nível, autoria, orientação, palavras-chave, macrotema, coleção e link."
            marcado={selecao.incluirResumos} onToggle={alternarResumos} />
          <p className="text-xs leading-relaxed text-slate-400" role="status">
            {docs.length.toLocaleString('pt-BR')} {docs.length === 1 ? 'registro' : 'registros'} da análise ativa, no formato da base de origem · cerca de {tamanhoLegivel(estimativa)}.
            Campos vazios não aparecem, como na base: quem lê distingue ausente de vazio.
          </p>
          {arquivoEnorme && (
            <Aviso tipo="aviso">
              Um arquivo deste tamanho pode não caber na memória da aba. Desmarque os resumos, ou recorte a análise a um tema ou pessoa antes de exportar.
            </Aviso>
          )}
        </section>
        ) : (
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
        )}

        {gerando && (
          <div className="space-y-2" role="status">
            <p className="text-sm text-slate-200">Gerando relatório… {progresso.etapa}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-eco-border">
              <div className="h-full bg-eco-action transition-[width]"
                style={{ width: `${progresso.total ? Math.round((progresso.feitos / progresso.total) * 100) : 0}%` }} />
            </div>
            <p className="text-xs text-slate-400">{progresso.feitos} de {progresso.total} seções{ehJson ? ' · sem gráficos a desenhar, o JSON sai direto.' : ' · gráficos de abas fechadas são redesenhados fora da tela.'}</p>
            <button type="button" className="btn text-xs" onClick={() => controle.current?.abort()}>
              <Square size={14} className="shrink-0" aria-hidden /> Interromper
            </button>
          </div>
        )}

        {erro && <Aviso tipo="erro"><p role="alert">{erro}</p></Aviso>}
        {pronto && <Aviso tipo="sucesso"><p role="status">Relatório baixado: {pronto}</p></Aviso>}

        <div className="flex flex-wrap gap-2 border-t border-eco-border pt-4">
          <button type="button" className="btn btn-primary" disabled={gerando || nada || docs.length === 0} onClick={() => void exportar()}>
            <FileDown size={16} className="shrink-0" aria-hidden /> {ehJson ? 'Baixar JSON' : 'Gerar PDF'}
          </button>
          {nada && <p className="self-center text-xs text-slate-400">Marque ao menos uma seção.</p>}
        </div>

        <p className="text-xs leading-relaxed text-slate-400">
          Todo relatório sai com coleções, período, versão da base, data de geração e as ressalvas sobre os limites do recorte — essas não são desmarcáveis, porque um arquivo circula longe da tela que as explica. No JSON elas vêm em <code>limites</code>, e os gráficos viram o nome da figura omitida: os dados que os sustentam já estão nas tabelas.
        </p>
      </div>
    </Janela>
  );
}
