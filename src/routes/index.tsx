import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="mx-auto max-w-page px-6 py-24">
      <h1 className="text-display font-bold">Kurio</h1>
      <p className="text-muted-foreground mt-4">Marketplace de NFTs.</p>
    </main>
  )
}
