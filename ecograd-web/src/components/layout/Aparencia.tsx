import { useId } from 'react';
import { AArrowDown, AArrowUp, Accessibility, ALargeSmall, Activity, BookType, Contrast, Monitor, Moon, Settings, Snail, Sun, Type, type LucideIcon } from 'lucide-react';
import { Janela } from './Janela';
import { CHIP } from './atalhos';
import { cn } from '@/lib/utils';
import { useAparencia, type Contraste, type Fonte, type Movimento, type Tamanho, type Tema } from '@/services/aparencia';

interface Opcao<T> { valor: T; rotulo: string; icone: LucideIcon }

const TEMAS: Opcao<Tema>[] = [
  { valor: 'escuro', rotulo: 'Escuro', icone: Moon },
  { valor: 'claro', rotulo: 'Claro', icone: Sun },
  { valor: 'sistema', rotulo: 'Sistema', icone: Monitor },
];
const FONTES: Opcao<Fonte>[] = [
  { valor: 'sem-serifa', rotulo: 'Sem serifa', icone: Type },
  { valor: 'serifada', rotulo: 'Serifa', icone: BookType },
  { valor: 'dislexica', rotulo: 'Disléxica', icone: Accessibility },
];
const TAMANHOS: Opcao<Tamanho>[] = [
  { valor: 'pequeno', rotulo: 'Pequena', icone: AArrowDown },
  { valor: 'medio', rotulo: 'Média', icone: ALargeSmall },
  { valor: 'grande', rotulo: 'Grande', icone: AArrowUp },
];
const MOVIMENTOS: Opcao<Movimento>[] = [
  { valor: 'sistema', rotulo: 'Do sistema', icone: Activity },
  { valor: 'reduzido', rotulo: 'Reduzido', icone: Snail },
];
const CONTRASTES: Opcao<Contraste>[] = [
  { valor: 'padrao', rotulo: 'Padrão', icone: Sun },
  { valor: 'alto', rotulo: 'Alto', icone: Contrast },
];

/** Grupo de botões exclusivos — o papel `radiogroup` mantém a semântica da escolha única. */
function Grupo<T extends string>({ titulo, ajuda, opcoes, valor, onChange }: {
  titulo: string; ajuda?: string; opcoes: Opcao<T>[]; valor: T; onChange: (v: T) => void;
}) {
  const id = useId();
  return <fieldset className="space-y-1.5">
    <legend id={id} className="text-xs font-medium uppercase tracking-wide text-slate-400">{titulo}</legend>
    <div role="radiogroup" aria-labelledby={id} aria-describedby={ajuda ? `${id}-ajuda` : undefined} className="flex flex-wrap gap-1.5">
      {opcoes.map(({ valor: v, rotulo, icone: Icone }) => {
        const ativo = v === valor;
        return <button
          key={v}
          type="button"
          role="radio"
          aria-checked={ativo}
          onClick={() => onChange(v)}
          className={cn('btn min-h-9 flex-1 basis-20 justify-center gap-1.5 px-2 py-1.5 text-xs', ativo && 'border-eco-accent bg-eco-accent/15 text-eco-accent')}
        >
          <Icone size={15} className="shrink-0" />
          <span className="leading-tight">{rotulo}</span>
        </button>;
      })}
    </div>
    {ajuda && <p id={`${id}-ajuda`} className="text-[.7rem] leading-snug text-slate-400">{ajuda}</p>}
  </fieldset>;
}

/** `chip`: mesma estética dos atalhos do rodapé da apresentação. */
export function Aparencia({ compacto = false, chip = false, desabilitado = false }: { compacto?: boolean; chip?: boolean; desabilitado?: boolean }) {
  const { tema, fonte, tamanho, movimento, contraste, reduzir, claro, erro, definir } = useAparencia();
  return <Janela titulo="Configurações" descricao="Ajuste a leitura sem alterar sua análise ou interromper atividades."
    trigger={<button type="button" className={chip ? CHIP : 'btn'} disabled={desabilitado} aria-label="Configurações" title="Configurações"><Settings size={chip ? 14 : 18} className="shrink-0" />{!compacto && 'Configurações'}</button>}>
    <div className="space-y-4">
      <Grupo titulo="Tema" opcoes={TEMAS} valor={tema} onChange={(v) => definir({ tema: v })} />
      <Grupo titulo="Fonte" opcoes={FONTES} valor={fonte} onChange={(v) => definir({ fonte: v })}
        ajuda="Inter, Source Serif 4 e OpenDyslexic, servidas pelo próprio EcoGrad. A disléxica também amplia o espaço entre letras, palavras e linhas." />
      <Grupo titulo="Tamanho da fonte" opcoes={TAMANHOS} valor={tamanho} onChange={(v) => definir({ tamanho: v })}
        ajuda="Escala todo o EcoGrad, mantendo as proporções entre textos, cartões e tabelas." />
      <Grupo titulo="Contraste" opcoes={CONTRASTES} valor={contraste} onChange={(v) => definir({ contraste: v })}
        ajuda="O alto contraste reforça bordas e texto; desliga o fundo animado e a transparência dos menus." />
      <Grupo titulo="Movimento" opcoes={MOVIMENTOS} valor={movimento} onChange={(v) => definir({ movimento: v })}
        ajuda="Reduzido: gráficos não animam, redes ficam pausadas e o fundo para num quadro fixo. Câmera e recorte temporal seguem nos controles manuais." />
      <p role="status" className="info">Tema {claro ? 'claro' : 'escuro'} · {contraste === 'alto' ? 'alto contraste' : 'contraste padrão'} · {reduzir ? 'movimento reduzido' : 'movimento conforme os controles'}. {erro ? 'Ajustes ativos nesta página.' : 'Preferências salvas neste navegador.'}</p>
      {erro && <p role="alert" className="aviso">O navegador não permitiu salvar as preferências. Os ajustes continuam ativos até recarregar.</p>}
    </div>
  </Janela>;
}
