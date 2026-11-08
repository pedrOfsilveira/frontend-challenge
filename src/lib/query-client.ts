import { QueryClient } from '@tanstack/react-query'
import { keepNewestVersion } from './versioned'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          const status = (error as { response?: { status?: number } }).response?.status
          if (status && status >= 400 && status < 500) return false
          return failureCount < 2
        },
        refetchOnWindowFocus: false,
        // REST e Socket.IO escrevem nos mesmos recursos: a versão mais nova sempre ganha.
        structuralSharing: keepNewestVersion,
      },
    },
  })
}
