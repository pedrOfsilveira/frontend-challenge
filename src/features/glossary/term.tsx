import { useId, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Explicações curtas para quem está colecionando pela primeira vez. */
const GLOSSARY = {
  edition: {
    title: 'Edição',
    text: 'É a tiragem deste NFT. Em 1/50 existem só 50 cópias da obra; quanto menor a tiragem, mais rara ela é. Uma edição aberta não tem limite de cópias.',
  },
  tokenId: {
    title: 'ID do token',
    text: 'Número único deste NFT dentro do contrato. É por ele que a rede sabe qual cópia é a sua.',
  },
  provenance: {
    title: 'Procedência',
    text: 'Histórico público de todos os donos desde a cunhagem. Ninguém consegue apagar ou reescrever esse registro.',
  },
  ipfs: {
    title: 'IPFS',
    text: 'Rede de arquivos descentralizada. A arte e os metadados são encontrados pelo próprio conteúdo, não por um servidor que pode sair do ar.',
  },
  erc721: {
    title: 'ERC-721',
    text: 'Padrão de contrato inteligente para tokens únicos: cada token tem um só dono e um histórico próprio de transferências.',
  },
} as const

export type GlossaryId = keyof typeof GLOSSARY

/**
 * Termo técnico com sublinhado pontilhado. Tocar ou clicar abre uma explicação curta;
 * Esc ou clicar fora fecha (Radix Popover cuida do foco e do teclado).
 */
export function Term({ id, children }: { id: GlossaryId; children: ReactNode }) {
  const entry = GLOSSARY[id]
  const titleId = useId()
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="term inline rounded-sm text-left font-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light"
      >
        {children}
        <span className="sr-only"> (o que é isso?)</span>
      </PopoverTrigger>
      <PopoverContent side="top" aria-labelledby={titleId} className="w-[min(18rem,calc(100vw-2rem))] border-border-soft bg-surface-card p-4 shadow-[0_12px_32px_rgb(10_6_4/55%)]">
        <p id={titleId} className="text-[15px] leading-5 font-bold text-copper-light">{entry.title}</p>
        <p className="mt-1.5 text-sm leading-6 text-sand-light">{entry.text}</p>
      </PopoverContent>
    </Popover>
  )
}
