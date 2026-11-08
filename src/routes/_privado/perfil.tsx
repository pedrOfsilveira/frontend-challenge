import { createFileRoute } from '@tanstack/react-router'
import { PendingPage } from '@/components/layout/pending-page'

export const Route = createFileRoute('/_privado/perfil')({
  component: () => <PendingPage title="Perfil do colecionador" section="home" />,
})
