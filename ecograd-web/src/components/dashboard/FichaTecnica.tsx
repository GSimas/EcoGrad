import { useQuery } from '@tanstack/react-query';
import { Landmark, Sparkles } from 'lucide-react';
import { Aviso, Card, Carregando } from '@/components/ui/primitives';
import { carregarCatalogoCapes, encontrarFichaCapes } from '@/lib/capes';
import type { Documento } from '@/types';

async function gerarSintese(nomesProgramas: string[], amostraTextos: string): Promise<string> {
  const r = await fetch('/api/gemini-synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomesProgramas, amostraTextos }),
  });
  if (!r.ok) throw new Error(`Síntese indisponível (HTTP ${r.status}).`);
  const dados = (await r.json()) as { descritivo: string };
  return dados.descritivo;
}

/**
 * Ficha Técnica (dados oficiais da CAPES) + Síntese epistemológica da IA.
 * Transcrição de Principal.py:358-418.
 */
export function FichaTecnica({ docs, programas }: { docs: readonly Documento[]; programas: readonly string[] }) {
  const capes = useQuery({
    queryKey: ['catalogo-capes'],
    queryFn: ({ signal }) => carregarCatalogoCapes(signal),
  });

  // Amostra representativa: até 25 documentos espaçados uniformemente
  const amostra: string[] = [];
  const salto = Math.max(1, Math.floor(docs.length / 25));
  for (let i = 0; i < docs.length && amostra.length < 25; i += salto) {
    const d = docs[i];
    amostra.push(`- ${d.titulo} | ${d.palavras_chave.join(', ')}`);
  }

  const sintese = useQuery({
    queryKey: ['sintese', programas.join('|'), docs.length],
    queryFn: () => gerarSintese([...programas], amostra.join('\n')),
    enabled: docs.length > 0 && programas.length > 0,
    retry: 0,
  });

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Landmark size={18} /> Ficha Técnica e Perfil Institucional
      </h3>

      {capes.isLoading && <Carregando texto="Cruzando com o catálogo oficial da CAPES..." />}

      <div className="grid gap-3 lg:grid-cols-2">
        {programas.map((nome) => {
          const ficha = capes.data ? encontrarFichaCapes(nome, capes.data) : null;
          if (!ficha) {
            return (
              <Card key={nome}>
                <p className="font-semibold text-slate-200">{nome}</p>
                <p className="mt-1 text-xs text-slate-500">
                  ⚠️ Dados oficiais não localizados na base da CAPES (possível variação de
                  nomenclatura ou curso de Graduação sem registro).
                </p>
              </Card>
            );
          }
          return (
            <Card key={nome}>
              <p className="font-semibold text-eco-accent">
                {ficha.Nome} ({ficha.Código}) · Nota CAPES: {ficha.Nota}
              </p>
              <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                <Linha rotulo="Grande Área" valor={ficha['Grande Área']} />
                <Linha rotulo="Modalidade" valor={`${ficha.Modalidade} (${ficha['Grau Acadêmico']})`} />
                <Linha rotulo="Área de Avaliação" valor={ficha['Área de Avaliação']} />
                <Linha rotulo="Situação" valor={ficha.Situação} />
                <Linha rotulo="Área de Conhecimento" valor={ficha['Área de Conhecimento']} />
                <Linha rotulo="Ensino" valor={ficha['Modalidade de Ensino']} />
              </dl>
            </Card>
          );
        })}
      </div>

      {sintese.isLoading && <Carregando texto="A IA está sintetizando o perfil epistemológico..." />}
      {sintese.isSuccess && (
        <Aviso>
          <span className="flex items-start gap-2">
            <Sparkles size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>Síntese de Pesquisa do PPG:</strong> {sintese.data}
            </span>
          </span>
        </Aviso>
      )}
      {sintese.isError && (
        <Aviso tipo="aviso">
          🔑 Síntese dinâmica desativada — configure <code>GEMINI_API_KEY</code> nas variáveis de
          ambiente da Netlify.
        </Aviso>
      )}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="text-slate-300">{valor}</dd>
    </div>
  );
}
