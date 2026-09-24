import { useId, useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Janela } from '@/components/layout/Janela';
import { useSessionField } from '@/hooks/useSessionField';
import { Dica } from './primitives';
import { LimiteDeErro } from './LimiteDeErro';
import { EmJanela, useEmJanela } from './contexto-janela';

export { useEmJanela };

/** Chave de sessão da janela de um bloco: quem precisa abri-la de fora escreve nela. */
export const chaveJanela = (chave: string) => `janela.${chave}`;

/**
 * Botão que abre um bloco longo numa janela larga — Dashboard, dossiê e Análise
 * Avançada usam o mesmo. O `aria-label` é o nome do bloco — é por ele que o
 * tour guiado o encontra — e a descrição vai por `aria-describedby`, para o
 * leitor de tela ler as duas.
 *
 * `chaveSessao` guarda aberto/fechado na sessão: um atalho de outra aba pode
 * então abrir a janela certa escrevendo em `chaveJanela(chave)`.
 */
export function BlocoEmJanela({ titulo, descricao, icone, children, chaveSessao }: { titulo: string; descricao: string; icone: ReactNode; children: ReactNode; chaveSessao?: string }) {
  const id = useId();
  const [local, setLocal] = useState(false);
  const [salvo, setSalvo] = useSessionField(chaveJanela(chaveSessao ?? ''), false);
  const aberta = chaveSessao ? salvo : local;
  const definir = chaveSessao ? setSalvo : setLocal;
  return <Janela titulo={titulo} larga aberta={aberta} onOpenChange={definir} trigger={
    <button type="button" aria-label={titulo} aria-describedby={id}
      className="card group flex h-full flex-col items-start gap-3 text-left transition hover:border-eco-accent/60">
      <span className="flex w-full items-center justify-between text-eco-accent">{icone}<ArrowUpRight size={18} aria-hidden="true" className="text-slate-400 transition group-hover:text-eco-accent" /></span>
      <span className="text-base font-semibold tracking-tight text-slate-100">{titulo}</span>
      <span id={id} className="text-xs leading-relaxed text-slate-400">{descricao}</span>
    </button>}>
    {/* Um bloco que quebra mostra o aviso dentro da própria janela; o resto segue. */}
    <EmJanela.Provider value><LimiteDeErro rotulo={`“${titulo}”`}>{children}</LimiteDeErro></EmJanela.Provider>
  </Janela>;
}

/**
 * Cabeçalho de um bloco: título com ícone e, ao lado, a dica "i" com a
 * descrição e as instruções. Dentro da janela do bloco fica só a dica — o
 * título já está no alto da janela.
 */
export function CabecalhoBloco({ titulo, icone, children }: { titulo: string; icone?: ReactNode; children?: ReactNode }) {
  const emJanela = useEmJanela();
  const dica = children ? <Dica rotulo={`Como ler: ${titulo}`}>{children}</Dica> : null;
  if (emJanela) return dica ? <div className="flex items-center">{dica}</div> : null;
  return <div className="flex items-center gap-2">
    <h2 className="flex items-center gap-2 text-lg font-semibold">{icone}{titulo}</h2>
    {dica}
  </div>;
}
