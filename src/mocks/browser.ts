import { setupWorker } from 'msw/browser'
import { controls } from './controls'
import { store } from './db/store'
import { handlers, onAfterRequest, serialized } from './handlers'
import { network } from './network'
import { realtimeHandler } from './realtime'
import { nextResolution, resolveDue } from './domain/orders'

const API_PATH = new URL(import.meta.env.VITE_API_URL ?? '/api', location.origin).pathname

/**
 * Agenda a decisão do pagamento simulado. O timer é só um gatilho: pedidos vencidos também
 * são resolvidos ao iniciar e a cada requisição, então um refresh nunca perde o resultado.
 */
function schedulePayments() {
  let timer: number | undefined
  const arm = () => {
    window.clearTimeout(timer)
    const due = nextResolution(store.get())
    if (due === null) return
    timer = window.setTimeout(() => {
      void serialized(async () => {
        if (resolveDue(store.get())) store.persist()
      }).then(arm)
    }, Math.max(0, due - Date.now()))
  }
  onAfterRequest(arm)
  arm()
  return arm
}

/** `?scenario=<id>` escolhe o cenário; `?mock-reset` restaura o estado inicial. Os dois saem da URL. */
async function applyUrlOptions() {
  const url = new URL(location.href)
  const scenario = url.searchParams.get('scenario')
  const reset = url.searchParams.has('mock-reset')
  if (reset) await controls.reset({ scenario: network.isScenario(scenario) ? scenario : undefined })
  else if (network.isScenario(scenario)) network.setScenario(scenario)
  if (scenario !== null || reset) {
    url.searchParams.delete('scenario')
    url.searchParams.delete('mock-reset')
    history.replaceState(history.state, '', url)
  }
}

export async function startMocks() {
  await store.init()
  await applyUrlOptions()
  const worker = setupWorker(...handlers, realtimeHandler)
  await worker.start({
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest(request, print) {
      // Assets e HMR seguem para a rede; só a API precisa estar toda mockada.
      if (new URL(request.url).pathname.startsWith(API_PATH)) print.warning()
    },
  })
  await serialized(async () => {
    if (resolveDue(store.get())) store.persist()
  })
  const rearm = schedulePayments()
  window.__kurioMock = controls
  return { worker, rearm }
}
