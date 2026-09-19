import { useMemo } from 'react';
import { periodoTexto, resumoRegistros } from '@/lib/resultados';
import type { Documento } from '@/types';
export function CoberturaAnalise({ docs }: { docs: readonly Documento[] }) {
  const s = useMemo(() => resumoRegistros(docs), [docs]);
  // `aria-label` também é o alvo do passo de cobertura no tour guiado: rótulo
  // de acessibilidade é seletor estável, classe de estilo não é.
  return <section aria-label="Cobertura do recorte" className="space-y-2 text-xs leading-relaxed text-slate-300">
    <p>{s.total} registros · período {periodoTexto(s)} · {s.anos} anos com registros · {s.semAno} sem ano.</p>
    <p>Resumo: {s.comResumo}/{s.total} · palavras-chave: {s.comPalavras}/{s.total} · orientador: {s.comOrientador}/{s.total} · link de fonte: {s.comFonte}/{s.total}.</p>
    <p>Tipos informados: {Object.entries(s.tipos).map(([t, n]) => `${t}: ${n}`).join(' · ') || 'nenhum'}.</p>
    {s.comFonte > s.fontesDistintas && <p className="text-amber-200">Há {s.comFonte - s.fontesDistintas} repetições de links. Registros não equivalem a trabalhos únicos; nenhuma deduplicação científica foi aplicada.</p>}
    <p>Este é o recorte local carregado, não toda a produção atual da instituição. Presença de metadados não comprova qualidade nem acesso ao texto completo. O intervalo de anos não garante cobertura contínua; a data de coleta não está disponível.</p>
  </section>;
}
