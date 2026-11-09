import type { Query, QueryClient, QueryFilters } from '@tanstack/react-query'
import type { Order } from '@/api/contracts'
import { queryKeys, type PrivateScope } from '@/api/query-keys'

/**
 * Pede ao REST o estado atual das queries que casam com o filtro, sem confiar em resposta
 * que já estava a caminho: ela pode ter sido calculada antes da mudança que motivou o pedido.
 *
 * - Parada: invalida (ativa refaz já; inativa refaz quando montar).
 * - Em voo, ativa e com dados: invalida, o que cancela a requisição velha e manda outra.
 * - Em voo sem dados (primeira carga, prefetch, placeholder) ou sem observador: não dá para
 *   cancelar sem deixar a tela vazia, e a requisição em voo seria reaproveitada. Espera ela
 *   terminar e então invalida, uma vez só.
 *
 * Nada aqui gera eventos, então um refetch nunca dispara outro (sem laço).
 */
export function createRefresher(queryClient: QueryClient) {
  const cache = queryClient.getQueryCache()
  /** `queryHash` das queries que precisam de um refetch quando a requisição atual terminar. */
  const afterSettle = new Set<string>()

  const invalidate = (query: Query, refetchType: 'active' | 'none' = 'active') =>
    void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType })

  const unsubscribe = cache.subscribe((event) => {
    const { query } = event
    if (!afterSettle.has(query.queryHash)) return
    if (event.type === 'removed') {
      afterSettle.delete(query.queryHash)
      return
    }
    if (event.type !== 'updated' || query.state.fetchStatus !== 'idle') return
    afterSettle.delete(query.queryHash)
    // Falhou ou foi cancelada: fica marcada como velha, sem insistir (o retry da própria query já rodou).
    invalidate(query, query.state.status === 'success' ? 'active' : 'none')
  })

  return {
    refresh(filters: QueryFilters) {
      for (const query of cache.findAll(filters)) {
        if (query.state.fetchStatus === 'idle') invalidate(query)
        else if (query.state.data !== undefined && query.isActive()) invalidate(query)
        else afterSettle.add(query.queryHash)
      }
    },
    /** Queries esperando a requisição atual terminar (para testes e diagnóstico). */
    pending: () => afterSettle.size,
    dispose() {
      unsubscribe()
      afterSettle.clear()
    },
  }
}

export type Refresher = ReturnType<typeof createRefresher>

/** Pedido em estado final é um recibo: não muda mais, não precisa voltar ao REST. */
const isSettledOrder = (query: Query) => {
  const [, , resource, kind] = query.queryKey
  const status = (query.state.data as Partial<Order> | undefined)?.status
  return resource === 'orders' && kind === 'detail' && (status === 'confirmed' || status === 'declined')
}

/**
 * (Re)conexão: tudo o que o REST respondeu antes do CONNECT pode ter perdido eventos (o servidor
 * só entrega a quem já está conectado). Isso inclui requisições ainda em voo: a resposta pode ter
 * sido calculada antes de uma mudança cujo evento se perdeu. Então toda query pública e do escopo
 * privado atual volta ao REST: as paradas e as em voo com dados já; as em voo sem dados, assim que
 * a resposta chegar (ver `createRefresher`).
 * Requisições que saem depois do CONNECT já não precisam: qualquer mudança posterior gera evento.
 */
export function reconcileAfterConnect(refresher: Refresher, scope: PrivateScope) {
  refresher.refresh({ queryKey: queryKeys.nfts.all })
  refresher.refresh({ queryKey: queryKeys.private.scope(scope), predicate: (query) => !isSettledOrder(query) })
}
