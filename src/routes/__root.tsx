import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { startRealtime } from '@/realtime/client'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  const { queryClient } = Route.useRouteContext()
  // Uma conexão por app; o retorno libera socket e listeners (StrictMode monta duas vezes em dev).
  useEffect(() => startRealtime(queryClient), [queryClient])

  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  )
}
