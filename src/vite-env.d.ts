/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_ENABLE_MOCKS?: string
  /** Origem do Socket.IO (padrão: a mesma da página). */
  readonly VITE_REALTIME_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
