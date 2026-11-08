import { createFileRoute } from '@tanstack/react-router'
import { PendingPage } from '@/components/layout/pending-page'

export const Route = createFileRoute('/_privado/pedido/$orderId')({
  component: () => <PendingPage title="Pedido" />,
})
