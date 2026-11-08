import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

interface SliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  /** Nome acessível de cada alça (ex.: "Preço mínimo", "Preço máximo"). */
  thumbLabels?: string[]
  /** Texto lido pelo leitor de tela para o valor (ex.: "1,25 ETH" em vez de "125"). */
  valueText?: (value: number) => string
}

/** Slider do shadcn com o visual do Figma: trilho cobre de 4 px e alças de 21 px com contorno tinta. */
function Slider({ className, defaultValue, value, min = 0, max = 100, thumbLabels, valueText, ...props }: SliderProps) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn("relative flex h-[21px] w-full touch-none items-center select-none data-[disabled]:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1 grow rounded-full bg-copper">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full rounded-full bg-copper" />
      </SliderPrimitive.Track>
      {_values.map((thumbValue, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabels?.[index]}
          aria-valuetext={valueText?.(thumbValue)}
          className="block size-[21px] shrink-0 rounded-full border-[3px] border-ink bg-copper transition-shadow focus-visible:ring-4 focus-visible:ring-copper-light/50 focus-visible:outline-hidden disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
