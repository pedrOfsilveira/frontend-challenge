import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { onSessionLost } from '@/api/http'
import { switchSession } from '@/features/session/session'
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

  // Sessão expirou/foi revogada durante o uso (401 com o token atual): limpa o que era da conta e
  // manda para o login com o caminho atual, para voltar ao mesmo ponto (inclusive no checkout).
  const router = useRouter()
  useEffect(() => {
    const unsubscribe = onSessionLost((reason) => {
      void switchSession(queryClient, null)
      const { pathname, href } = router.state.location
      if (pathname === '/entrar') return
      void router.navigate({ to: '/entrar', search: { redirect: href, motivo: reason === 'expired' ? 'expirada' : undefined } })
    })
    return () => void unsubscribe()
  }, [queryClient, router])

  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  )
}
