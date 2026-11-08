import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/errors'
import { keepNewestVersion } from './versioned'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Só falhas transitórias (rede, timeout, 5xx) merecem nova tentativa; 4xx não muda repetindo.
        retry: (failureCount, error) => (isApiError(error) ? error.isTransient : true) && failureCount < 2,
        refetchOnWindowFocus: false,
        // REST e Socket.IO escrevem nos mesmos recursos: a versão mais nova sempre ganha.
        structuralSharing: keepNewestVersion,
      },
    },
  })
}
