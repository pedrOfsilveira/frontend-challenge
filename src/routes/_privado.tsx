import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionStore } from '@/api/session-store'

/**
 * Rotas que exigem conta (pagamento, pedido, perfil, carteiras). Sem sessão, vai para o login
 * guardando o caminho atual para voltar depois. A expiração no meio do uso é tratada no root
 * (`onSessionLost`), porque só aparece quando uma requisição volta 401.
 */
export const Route = createFileRoute('/_privado')({
  beforeLoad: ({ location }) => {
    if (!sessionStore.get()) {
      throw redirect({ to: '/entrar', search: { redirect: location.href } })
    }
  },
  component: Outlet,
})
