import { useId, useState } from 'react';
import { AArrowDown, AArrowUp, Accessibility, ALargeSmall, Activity, BookType, Compass, Contrast, Monitor, Moon, Settings, Snail, Sun, Type, type LucideIcon } from 'lucide-react';
import { Janela } from './Janela';
import { esquecerTour } from './TourGuiado';
import { CHIP } from './atalhos';
import { ConfiguracaoIA } from '@/components/chat/ConfiguracaoIA';
import { Expander } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { lerConfigIA, provedorPorId, validarConfigIA } from '@/lib/provedores-ia';
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
function Grupo<T extends string>({ titulo, opcoes, valor, onChange }: {
  titulo: string; opcoes: Opcao<T>[]; valor: T; onChange: (v: T) => void;
}) {
  const id = useId();
  return <fieldset className="space-y-1.5">
    <legend id={id} className="text-xs font-medium uppercase tracking-wide text-slate-400">{titulo}</legend>
    <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
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
  </fieldset>;
}

/**
 * Provedor de IA do UFSCão, aqui dentro das Configurações.
 *
 * É a mesma chave das duas superfícies — a conversa da tela inicial e o botão
 * flutuante leem `lerConfigIA()`, e não há duas configurações a manter. Quem
 * chegou por uma tela e quer trocar de modelo já está procurando em
 * Configurações; antes disso, o único caminho era abrir o chat.
 */
function ProvedorDeIA() {
  const [config, setConfig] = useState(lerConfigIA);
  const configurado = !!config && !validarConfigIA(config);
  const resumo = configurado && config
    ? `${provedorPorId(config.provedor).nome} · ${config.modelo}`
    : 'nenhum provedor configurado';
  return <fieldset className="space-y-1.5">
    <legend className="text-xs font-medium uppercase tracking-wide text-slate-400">UFSCão · provedor de IA</legend>
    <Expander titulo={configurado ? `Provedor: ${resumo}` : 'Configurar provedor e chave de API'} persistir={false}>
      <ConfiguracaoIA inicial={config} onSalvo={setConfig} onEsquecer={() => setConfig(lerConfigIA())} />
    </Expander>
    <p className="text-[.7rem] leading-snug text-slate-400">
      Vale para as duas conversas: a da tela inicial, sobre o acervo inteiro, e a do botão flutuante, sobre as coleções carregadas.
      A chave fica neste navegador e vai direto ao provedor; o EcoGrad não a recebe.
    </p>
  </fieldset>;
}

/** `chip`: mesma estética dos atalhos do rodapé da apresentação. */
export function Aparencia({ compacto = false, chip = false, desabilitado = false }: { compacto?: boolean; chip?: boolean; desabilitado?: boolean }) {
  const { tema, fonte, tamanho, movimento, contraste, reduzir, claro, erro, definir } = useAparencia();
  return <Janela titulo="Configurações"
    trigger={<button type="button" className={chip ? cn(CHIP, compacto && 'w-11 justify-center px-0') : 'btn'} disabled={desabilitado} aria-label="Configurações" title="Configurações"><Settings size={chip ? 14 : 18} className="shrink-0" />{!compacto && <span className="eco-chip-rotulo">Configurações</span>}</button>}>
    <div className="space-y-4">
      <Grupo titulo="Tema" opcoes={TEMAS} valor={tema} onChange={(v) => definir({ tema: v })} />
      <Grupo titulo="Fonte" opcoes={FONTES} valor={fonte} onChange={(v) => definir({ fonte: v })} />
      <Grupo titulo="Tamanho da fonte" opcoes={TAMANHOS} valor={tamanho} onChange={(v) => definir({ tamanho: v })} />
      <Grupo titulo="Contraste" opcoes={CONTRASTES} valor={contraste} onChange={(v) => definir({ contraste: v })} />
      <Grupo titulo="Movimento" opcoes={MOVIMENTOS} valor={movimento} onChange={(v) => definir({ movimento: v })} />
      <p role="status" className="info">Tema {claro ? 'claro' : 'escuro'} · {contraste === 'alto' ? 'alto contraste' : 'contraste padrão'} · {reduzir ? 'movimento reduzido' : 'movimento conforme os controles'}. {erro ? 'Ajustes ativos nesta página.' : 'Preferências salvas neste navegador.'}</p>
      {erro && <p role="alert" className="aviso">O navegador não permitiu salvar as preferências. Os ajustes continuam ativos até recarregar.</p>}
      <ProvedorDeIA />
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium uppercase tracking-wide text-slate-400">Tour guiado</legend>
        <button type="button" className="btn" onClick={() => { esquecerTour(); definir({}); }}>
          <Compass size={15} className="shrink-0" aria-hidden /> Mostrar o convite do tour de novo
        </button>
      </fieldset>
    </div>
  </Janela>;
}
