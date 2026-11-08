/**
 * Token da sessão e id do carrinho de visitante.
 * O token fica no localStorage para a sessão sobreviver ao refresh (trade-off documentado no ARCHITECTURE).
 * Senha nunca passa por aqui.
 */
const SESSION_KEY = 'kurio.session'
const GUEST_CART_KEY = 'kurio.guest-cart'

export interface StoredSession {
  token: string
  userId: string
  expiresAt: string
}

type Listener = () => void
const listeners = new Set<Listener>()

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Armazenamento indisponível (modo privado): a sessão dura só esta aba.
  }
}

let current: StoredSession | null = read<StoredSession>(SESSION_KEY)

export const sessionStore = {
  get: () => current,
  getToken: () => current?.token ?? null,
  set(next: StoredSession | null) {
    if (next?.token === current?.token) return
    current = next
    write(SESSION_KEY, next)
    listeners.forEach((listener) => listener())
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// Outra aba entrou ou saiu: acompanha para não misturar usuários.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_KEY) return
    current = read<StoredSession>(SESSION_KEY)
    listeners.forEach((listener) => listener())
  })
}

// Em memória também: sem localStorage (modo privado) o id continua estável durante a aba.
let guestId: string | null = null

export const guestCart = {
  /** Id do carrinho anônimo; criado sob demanda e estável durante a vida da aba. */
  id(): string {
    guestId ??= read<string>(GUEST_CART_KEY)
    if (guestId) return guestId
    guestId = `guest_${crypto.randomUUID()}`
    write(GUEST_CART_KEY, guestId)
    return guestId
  },
  peek: () => guestId ?? read<string>(GUEST_CART_KEY),
  /** Depois da mescla no login, o carrinho anônimo deixa de existir. */
  clear() {
    guestId = null
    write(GUEST_CART_KEY, null)
  },
}
