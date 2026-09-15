import * as SliderPrimitive from '@radix-ui/react-slider';

/**
 * Uma barra só com as duas pontas móveis. O `input[type=range]` do HTML tem um
 * controle por vez; duas barras empilhadas obrigavam a ler qual era qual. Aqui o
 * trecho aceso entre os controles é o próprio intervalo escolhido.
 *
 * Cada ponta em `null` significa ponta em aberto: ela repousa no extremo da
 * coluna e, ao ser arrastada de volta até lá, volta a ficar em aberto — arrastar
 * as duas para as bordas desfaz o filtro.
 */
export function FaixaDupla({ rotulo, min, max, passo, valor, onChange }: {
  rotulo: string;
  min: number;
  max: number;
  passo: number;
  valor: { min: number | null | undefined; max: number | null | undefined };
  onChange: (v: { min: number | null; max: number | null }) => void;
}) {
  const inicio = typeof valor.min === 'number' && Number.isFinite(valor.min) ? Math.max(min, Math.min(max, valor.min)) : min;
  const fim = typeof valor.max === 'number' && Number.isFinite(valor.max) ? Math.max(min, Math.min(max, valor.max)) : max;

  return <SliderPrimitive.Root
    className="relative flex h-9 w-full touch-none select-none items-center"
    min={min}
    max={max}
    step={passo}
    value={[Math.min(inicio, fim), Math.max(inicio, fim)]}
    onValueChange={([a, b]) => onChange({ min: a <= min ? null : a, max: b >= max ? null : b })}
    aria-label={`Intervalo de ${rotulo}`}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-eco-border">
      <SliderPrimitive.Range className="absolute h-full bg-eco-accent" />
    </SliderPrimitive.Track>
    {(['mínimo', 'máximo'] as const).map((ponta) => <SliderPrimitive.Thumb
      key={ponta}
      aria-label={`${rotulo}: valor ${ponta}`}
      className="block h-5 w-5 cursor-pointer rounded-full border-2 border-eco-accent bg-eco-bg shadow
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eco-accent focus-visible:ring-offset-2 focus-visible:ring-offset-eco-panel"
    />)}
  </SliderPrimitive.Root>;
}
