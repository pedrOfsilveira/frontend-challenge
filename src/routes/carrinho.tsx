import { createFileRoute } from '@tanstack/react-router'
import { PendingPage } from '@/components/layout/pending-page'

export const Route = createFileRoute('/carrinho')({
  component: () => <PendingPage title="Carrinho" />,
})
