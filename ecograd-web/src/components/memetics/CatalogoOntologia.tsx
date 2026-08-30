import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Download, Sparkles, Upload } from 'lucide-react';
import { Aviso, Card, Expander, Progresso, Tabela } from '@/components/ui/primitives';
import { baixarArquivo, paraCSV } from '@/lib/utils';
import { parseOntologia } from '@/lib/foresight-math';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { OntologiaIA } from '@/types';

const COLUNAS_CSV = ['Título', 'Teorias e Modelos', 'Ferramentas e Artefatos', 'Métodos e Técnicas'] as const;

/** A função serverless processa no máximo 8 documentos por invocação. */
const ITENS_POR_CHAMADA = 8;
const TAMANHOS_LOTE = [5, 10, 20, 50, 100, 200, 500, 1000];

interface RespostaOntologia {
  resultados: Array<{ titulo: string; ontologia: OntologiaIA | null; erro: string | null }>;
}

function separarLista(valor: unknown): string[] {
  const s = valor === null || valor === undefined ? '' : String(valor).trim();
  if (s === '') return [];
  return s.split(',').map((i) => i.trim()).filter(Boolean);
}

/**
 * Catálogo Ontológico: processamento em lote pela IA (com ETA), tabela,
 * exportação e upload de um CSV pré-processado.
 * Transcrição de pages/1_Avançado.py:1240-1360.
 */
export function CatalogoOntologia() {
  const docs = useEcoGradStore((s) => s.docs);
  const aplicarOntologia = useEcoGradStore((s) => s.aplicarOntologia);

  const [tamanhoLote, setTamanhoLote] = useState(10);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [statusLote, setStatusLote] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [mensagemUpload, setMensagemUpload] = useState<{ tipo: 'sucesso' | 'aviso' | 'erro'; texto: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const linhasCatalogo = useMemo(() => {
    const linhas: Array<Record<string, unknown>> = [];
    for (const d of docs) {
      const onto = parseOntologia(d.ontologia_ia);
      if (!onto) continue;
      linhas.push({
        Ano: d.ano ?? 'N/A',
        'Título': d.titulo,
        'Teorias e Modelos': onto.teorias_e_modelos.join(', '),
        'Ferramentas e Artefatos': onto.ferramentas_e_artefatos.join(', '),
        'Métodos e Técnicas': onto.metodos_e_tecnicas.join(', '),
      });
    }
    return linhas;
  }, [docs]);

  const fila = useMemo(
    () => docs.filter((d) => !parseOntologia(d.ontologia_ia) && d.resumo.trim() !== ''),
    [docs],
  );
  const totalValidos = useMemo(() => docs.filter((d) => d.resumo.trim() !== '').length, [docs]);
  const jaProcessados = totalValidos - fila.length;

  const processarLote = async () => {
    const lote = fila.slice(0, tamanhoLote);
    if (lote.length === 0) return;

    setProcessando(true);
    setProgresso(0);
    setErros([]);
    const inicio = performance.now();
    const acumulado = new Map<string, OntologiaIA>();
    const falhas: string[] = [];

    try {
      for (let i = 0; i < lote.length; i += ITENS_POR_CHAMADA) {
        const fatia = lote.slice(i, i + ITENS_POR_CHAMADA);

        // ETA a partir do ritmo real observado até aqui
        if (i > 0) {
          const decorrido = (performance.now() - inicio) / 1000;
          const mediaPorDoc = decorrido / i;
          const eta = Math.round((lote.length - i) * mediaPorDoc);
          const min = Math.floor(eta / 60);
          const seg = eta % 60;
          setStatusLote(`🤖 Lendo ${i + 1}/${lote.length} · ⏳ Restam aprox. ${min}m ${seg}s`);
        } else {
          setStatusLote(`🤖 Lendo 1/${lote.length} · ⏳ Calculando tempo...`);
        }

        const r = await fetch('/api/gemini-ontology', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itens: fatia.map((d) => ({ titulo: d.titulo, resumo: d.resumo })),
          }),
        });

        if (!r.ok) {
          falhas.push(`Lote ${i / ITENS_POR_CHAMADA + 1}: HTTP ${r.status}`);
          break;
        }

        const dados = (await r.json()) as RespostaOntologia;
        for (const res of dados.resultados) {
          if (res.ontologia) acumulado.set(res.titulo.trim().toLowerCase(), res.ontologia);
          else if (res.erro) falhas.push(`${res.titulo.slice(0, 40)}…: ${res.erro}`);
        }

        setProgresso(Math.round(((i + fatia.length) / lote.length) * 100));
      }

      const atualizados = aplicarOntologia(acumulado);
      setStatusLote(
        `Lote concluído! ${atualizados} documentos enriquecidos. Faltam ${fila.length - atualizados} na fila.`,
      );
      setErros(falhas);
    } catch (e) {
      setErros([e instanceof Error ? e.message : String(e)]);
    } finally {
      setProcessando(false);
    }
  };

  const aoSelecionarArquivo = (arquivo: File) => {
    setMensagemUpload(null);
    Papa.parse<Record<string, string>>(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        const campos = resultado.meta.fields ?? [];
        const faltando = COLUNAS_CSV.filter((c) => !campos.includes(c));
        if (faltando.length > 0) {
          setMensagemUpload({
            tipo: 'erro',
            texto:
              'O CSV não possui as colunas estruturais corretas. Use o arquivo gerado pelo botão "Exportar Catálogo" desta plataforma.',
          });
          return;
        }

        const mapa = new Map<string, OntologiaIA>();
        for (const linha of resultado.data) {
          const titulo = String(linha['Título'] ?? '').trim().toLowerCase();
          if (!titulo) continue;
          mapa.set(titulo, {
            teorias_e_modelos: separarLista(linha['Teorias e Modelos']),
            ferramentas_e_artefatos: separarLista(linha['Ferramentas e Artefatos']),
            metodos_e_tecnicas: separarLista(linha['Métodos e Técnicas']),
          });
        }

        const atualizados = aplicarOntologia(mapa);
        setMensagemUpload(
          atualizados > 0
            ? { tipo: 'sucesso', texto: `✅ Sucesso! ${atualizados} documentos foram enriquecidos com o catálogo carregado.` }
            : {
                tipo: 'aviso',
                texto: '⚠️ O upload foi lido, mas nenhum "Título" do CSV coincidiu com a base atual em memória.',
              },
        );
        // Limpa o input para que o mesmo arquivo possa ser reenviado sem
        // disparar um novo ciclo de render em loop.
        if (inputRef.current) inputRef.current.value = '';
      },
      error: (e) => setMensagemUpload({ tipo: 'erro', texto: `Erro ao ler o arquivo CSV: ${e.message}` }),
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} /> Extração Ontológica por IA
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            A API lê os resumos para extrair construtos reais (Artefatos, Teorias e Métodos),
            superando a limitação das palavras-chave genéricas.
          </p>
        </div>

        <Progresso
          valor={totalValidos > 0 ? (jaProcessados / totalValidos) * 100 : 0}
          texto={`Progresso da Base: ${jaProcessados} de ${totalValidos} resumos lidos pela IA.`}
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Tamanho do Lote
            <select
              value={tamanhoLote}
              onChange={(e) => setTamanhoLote(Number(e.target.value))}
              className="input py-1.5"
            >
              {TAMANHOS_LOTE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={processarLote}
            disabled={processando || fila.length === 0}
          >
            🚀 Processar Próximo Lote
          </button>
          <p className="text-xs text-slate-500">
            Lotes pequenos evitam estourar o limite da API gratuita. Cada invocação serverless
            processa até {ITENS_POR_CHAMADA} documentos, com 4s de intervalo entre chamadas.
          </p>
        </div>

        {processando && <Progresso valor={progresso} texto={statusLote} />}
        {!processando && statusLote && <Aviso tipo="sucesso">{statusLote}</Aviso>}
        {fila.length === 0 && totalValidos > 0 && (
          <Aviso tipo="sucesso">Toda a base já foi processada pela IA!</Aviso>
        )}
        {erros.length > 0 && (
          <Expander titulo={`⚠️ ${erros.length} falhas na IA. Clique para ver.`}>
            <ul className="space-y-1 text-xs text-red-300">
              {erros.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Expander>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">🗂️ Catálogo de Artefatos Extraídos</h3>
            <p className="text-xs text-slate-500">
              Verifique e baixe o que a IA encontrou, ou faça upload de um catálogo pré-processado.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={14} /> Upload CSV
            </button>
            <button
              type="button"
              className="btn"
              disabled={linhasCatalogo.length === 0}
              onClick={() => baixarArquivo(paraCSV(linhasCatalogo), 'catalogo_ontologico_ia.csv')}
            >
              <Download size={14} /> Exportar Catálogo
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) aoSelecionarArquivo(arquivo);
          }}
        />

        {mensagemUpload && <Aviso tipo={mensagemUpload.tipo}>{mensagemUpload.texto}</Aviso>}

        {linhasCatalogo.length === 0 ? (
          <Aviso>
            💡 A base ainda não possui ontologia estruturada. Processe um lote na seção acima ou faça
            upload de um CSV existente.
          </Aviso>
        ) : (
          <Tabela
            altura="max-h-80"
            linhas={linhasCatalogo}
            colunas={[
              { chave: 'Ano', rotulo: 'Ano', render: (l) => String(l.Ano) },
              { chave: 'Título', rotulo: 'Título', className: 'max-w-xs truncate' },
              { chave: 'Teorias e Modelos', rotulo: 'Teorias e Modelos', className: 'max-w-xs truncate' },
              { chave: 'Ferramentas e Artefatos', rotulo: 'Ferramentas e Artefatos', className: 'max-w-xs truncate' },
              { chave: 'Métodos e Técnicas', rotulo: 'Métodos e Técnicas', className: 'max-w-xs truncate' },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
