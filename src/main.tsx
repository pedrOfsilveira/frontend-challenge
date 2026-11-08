import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setTransportReady } from '@/api/http'
import { createQueryClient } from '@/lib/query-client'
import { createAppRouter } from '@/router'
import '@/styles/globals.css'

// Mocks por configuração (também no build de demonstração). A interface renderiza já;
// as requisições esperam o service worker do MSW ficar pronto.
if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  setTransportReady(import('@/mocks/browser').then(({ startMocks }) => startMocks()))
}

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)
// Só em desenvolvimento: inspecionar o cache pelo console do navegador.
if (import.meta.env.DEV) Object.assign(window, { __kurioQueryClient: queryClient })

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
