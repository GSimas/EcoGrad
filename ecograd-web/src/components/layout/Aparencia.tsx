import { useId } from 'react';
import { Palette } from 'lucide-react';
import { Janela } from './Janela';
import { useAparencia, type Densidade, type Movimento, type Tema } from '@/services/aparencia';

export function Aparencia({ compacto = false }: { compacto?: boolean }) {
  const id = useId();
  const { tema, densidade, movimento, reduzir, claro, erro, definir } = useAparencia();
  return <Janela titulo="Aparência e conforto" descricao="Ajuste a leitura sem alterar sua análise ou interromper atividades."
    trigger={<button type="button" className="btn" aria-label="Aparência e conforto" title="Aparência e conforto"><Palette size={18} className="shrink-0" />{!compacto && 'Aparência e conforto'}</button>}>
    <div className="space-y-5">
      <label className="flex flex-col gap-2 text-sm">Tema<select className="input" value={tema} onChange={e => definir({tema:e.target.value as Tema})}><option value="escuro">Escuro</option><option value="claro">Claro</option><option value="sistema">Acompanhar o sistema</option></select></label>
      <div className="flex flex-col gap-2 text-sm"><label htmlFor={id+'-densidade'}>Densidade de leitura</label><select id={id+'-densidade'} aria-describedby={id+'-densidade-ajuda'} className="input" value={densidade} onChange={e => definir({densidade:e.target.value as Densidade})}><option value="confortavel">Confortável</option><option value="compacta">Compacta</option></select><span id={id+'-densidade-ajuda'} className="text-xs text-slate-400">A opção compacta aproxima cartões e linhas de tabelas, mantendo controles e textos legíveis.</span></div>
      <div className="flex flex-col gap-2 text-sm"><label htmlFor={id+'-movimento'}>Movimento</label><select id={id+'-movimento'} aria-describedby={id+'-movimento-ajuda'} className="input" value={movimento} onChange={e => definir({movimento:e.target.value as Movimento})}><option value="sistema">Respeitar a preferência do sistema</option><option value="reduzido">Reduzir sempre</option></select><span id={id+'-movimento-ajuda'} className="text-xs text-slate-400">Com movimento reduzido, gráficos não animam e redes ficam pausadas. Câmera e recorte temporal continuam disponíveis por controles manuais.</span></div>
      <p role="status" className="info">Tema {claro ? 'claro' : 'escuro'} · {reduzir ? 'movimento reduzido' : 'movimento conforme os controles'}. {erro ? 'Ajustes ativos nesta página.' : 'Preferências salvas neste navegador.'}</p>
      {erro && <p role="alert" className="aviso">O navegador não permitiu salvar as preferências. Os ajustes continuam ativos até recarregar.</p>}
    </div>
  </Janela>;
}
