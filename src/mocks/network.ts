import { seededRandom } from './lib'

/**
 * Condições de rede reproduzíveis. O cenário vem de `?scenario=<id>` (fica salvo até outro ser
 * escolhido) ou dos controles de teste. Latências "aleatórias" usam semente fixa: a mesma
 * sequência de requisições sempre recebe as mesmas latências.
 */
export const SCENARIOS = {
  default: 'Latência curta e variável (120–400 ms).',
  fast: 'Sem latência (testes).',
  slow: 'Rede lenta (1,8–2,6 s): mostra os skeletons.',
  jitter: 'Latência muito variável (50 ms–1,5 s).',
  'out-of-order': 'Listagem do catálogo responde fora de ordem (a 1ª é lenta, a 2ª rápida).',
  offline: 'Sem conexão: toda requisição falha na rede.',
  'server-error': 'Leituras respondem 503.',
  flaky: 'Uma a cada duas requisições responde 503.',
  empty: 'Catálogo vazio.',
} as const
export type ScenarioId = keyof typeof SCENARIOS

export type FailureKind = 'network' | 'timeout' | 'server-error' | 'after-commit'

const STORAGE_KEY = 'kurio.mock.scenario'
const SEED = 4242
/** Maior que o timeout do Axios (10 s): a requisição expira no cliente. */
export const TIMEOUT_DELAY_MS = 12_000

const isScenario = (value: unknown): value is ScenarioId => typeof value === 'string' && value in SCENARIOS

function storedScenario(): ScenarioId {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isScenario(value) ? value : 'default'
  } catch {
    return 'default'
  }
}

let scenario: ScenarioId = storedScenario()
let random = seededRandom(SEED)
let requestCount = 0
const routeCounts = new Map<string, number>()
let latencyOverride: number | null = null
const failures: { route: string; kind: FailureKind; remaining: number }[] = []

export const network = {
  scenarios: SCENARIOS,
  isScenario,
  get scenario() {
    return scenario
  },
  setScenario(next: ScenarioId) {
    scenario = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignora: o cenário vale só para esta página
    }
  },
  /** Latência fixa para todas as rotas (ou `null` para voltar ao cenário). */
  setLatency(ms: number | null) {
    latencyOverride = ms
  },
  /** Faz as próximas `count` chamadas à rota falharem do jeito indicado. `*` vale para qualquer rota. */
  failNext(route: string, kind: FailureKind, count = 1) {
    failures.push({ route, kind, remaining: count })
  },
  reset() {
    random = seededRandom(SEED)
    requestCount = 0
    routeCounts.clear()
    latencyOverride = null
    failures.length = 0
  },
  /** Decide o que acontece com esta requisição: latência e eventual falha. */
  plan(route: string, method: string): { latencyMs: number; failure: FailureKind | null } {
    requestCount += 1
    const routeCount = (routeCounts.get(route) ?? 0) + 1
    routeCounts.set(route, routeCount)

    const injected = failures.find((f) => (f.route === route || f.route === '*') && f.remaining > 0)
    let failure: FailureKind | null = null
    if (injected) {
      injected.remaining -= 1
      failure = injected.kind
      if (injected.remaining === 0) failures.splice(failures.indexOf(injected), 1)
    } else if (scenario === 'offline') failure = 'network'
    else if (scenario === 'server-error' && method === 'GET') failure = 'server-error'
    else if (scenario === 'flaky' && requestCount % 2 === 0) failure = 'server-error'

    const between = (min: number, max: number) => Math.round(min + random() * (max - min))
    let latencyMs: number
    if (latencyOverride !== null) latencyMs = latencyOverride
    else if (scenario === 'fast') latencyMs = 0
    else if (scenario === 'slow') latencyMs = between(1800, 2600)
    else if (scenario === 'jitter') latencyMs = between(50, 1500)
    else if (scenario === 'out-of-order' && route === 'nfts.list') latencyMs = routeCount % 2 === 1 ? 1500 : 150
    else latencyMs = between(120, 400)
    return { latencyMs, failure }
  },
}
