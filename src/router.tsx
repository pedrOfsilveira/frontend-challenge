import { createRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { parseSearch, stringifySearch } from './lib/search-params'
import { routeTree } from './routeTree.gen'

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // O cache é do TanStack Query: o router não guarda dados de loader por conta própria.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // URL legível (`?category=music,photography&min=0.5`) e só strings: preço nunca vira `number`.
    parseSearch,
    stringifySearch,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
