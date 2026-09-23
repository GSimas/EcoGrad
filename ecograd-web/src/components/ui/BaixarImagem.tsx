import { useState } from 'react';
import { ImageDown } from 'lucide-react';
import { Janela } from '@/components/layout/Janela';
import type { FormatoImagem } from '@/lib/exportar-imagem';

const FORMATOS: Array<{ formato: FormatoImagem; rotulo: string; detalhe: string }> = [
  { formato: 'jpg', rotulo: 'JPG com fundo', detalhe: 'Pinta o fundo do tema atual. Para slides e documentos.' },
  { formato: 'png', rotulo: 'PNG sem fundo', detalhe: 'Fundo transparente, para compor sobre outra imagem.' },
];

/**
 * Um só botão de download, só com o ícone: o formato é escolhido na janela que
 * ele abre. O nome acessível e o `title` carregam o que o ícone não diz.
 */
export function BaixarImagem({ titulo, onBaixar, disabled = false }: {
  titulo: string; onBaixar: (formato: FormatoImagem) => void; disabled?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const rotulo = `Baixar imagem de ${titulo}`;
  return <Janela titulo="Baixar imagem" descricao={`Escolha o formato de ${titulo}.`} aberta={aberta} onOpenChange={setAberta}
    trigger={<button type="button" className="btn h-11 w-11 px-0" disabled={disabled} aria-label={rotulo} title={rotulo}>
      <ImageDown size={17} aria-hidden="true" />
    </button>}>
    <div className="grid gap-2 sm:grid-cols-2">
      {FORMATOS.map(({ formato, rotulo: nome, detalhe }) => <button key={formato} type="button"
        // `.btn` centraliza o texto numa regra fora das camadas do Tailwind; o estilo inline é o que a vence.
        className="btn h-full flex-col items-start justify-start gap-1 p-4" style={{ textAlign: 'left' }}
        onClick={() => { setAberta(false); onBaixar(formato); }}>
        <span className="font-mono text-xs uppercase tracking-[.1em] text-eco-accent">{formato}</span>
        <span className="text-sm font-semibold text-slate-100">{nome}</span>
        <span className="text-xs font-normal text-slate-400">{detalhe}</span>
      </button>)}
    </div>
  </Janela>;
}
