import { createFileRoute } from '@tanstack/react-router'
import { PendingPage } from '@/components/layout/pending-page'

export const Route = createFileRoute('/perfil')({
  component: () => <PendingPage title="Perfil do colecionador" section="home" />,
})
