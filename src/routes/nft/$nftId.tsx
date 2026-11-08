import { createFileRoute } from '@tanstack/react-router'
import { PendingPage } from '@/components/layout/pending-page'

export const Route = createFileRoute('/nft/$nftId')({
  component: () => <PendingPage title="Detalhes do NFT" />,
})
