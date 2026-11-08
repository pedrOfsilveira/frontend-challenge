import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PendingPage } from '@/components/layout/pending-page'

/** `redirect`: caminho interno para voltar depois do login (nunca uma URL externa). */
const searchSchema = z.object({
  redirect: z.string().startsWith('/').refine((path) => !path.startsWith('//')).optional().catch(undefined),
  /** Por que caiu no login: sessão expirou no meio do uso (a tela explica e promete a volta). */
  motivo: z.enum(['expirada']).optional().catch(undefined),
})

export const Route = createFileRoute('/entrar')({
  validateSearch: searchSchema,
  component: () => <PendingPage title="Entrar" section="home" />,
})
