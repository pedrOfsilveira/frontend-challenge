import { cn } from "cn"

/**
 * Placeholder com shimmer: uma faixa de luz atravessa o bloco. Com movimento reduzido, fica estático.
 * Quem usa define as mesmas dimensões do conteúdo final, para não haver deslocamento de layout.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-dark/70",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-linear-to-r before:from-transparent before:via-cream/10 before:to-transparent",
        "motion-reduce:before:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
