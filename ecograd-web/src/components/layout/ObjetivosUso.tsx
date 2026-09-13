import { OBJETIVOS, objetivoPorId } from '@/lib/objetivos';
import { useSessionField } from '@/hooks/useSessionField';
import { useId } from 'react';
export function ObjetivosUso() {
  const [id, setId] = useSessionField('entrada.objetivo', 'panorama');
  const name = useId();
  const ativo = objetivoPorId(id);
  return <fieldset className="space-y-3">
    <legend className="mb-3 text-lg font-semibold">1. O que você quer fazer?</legend>
    <div className="grid gap-3 sm:grid-cols-2">{OBJETIVOS.map((o) => <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${ativo.id === o.id ? 'border-eco-accent bg-eco-accent/5' : 'border-eco-border bg-eco-panel'}`}>
      <input type="radio" name={name} value={o.id} checked={ativo.id === o.id} onChange={() => setId(o.id)} className="mt-1" /><span><span className="block text-sm font-semibold">{o.titulo}</span><span className="mt-1 block text-xs leading-relaxed text-slate-300">{o.descricao}</span></span>
    </label>)}</div>
    <p className="text-sm leading-relaxed text-slate-300">{ativo.orientacao} Todas as ferramentas continuam acessíveis pelo menu.</p>
  </fieldset>;
}
