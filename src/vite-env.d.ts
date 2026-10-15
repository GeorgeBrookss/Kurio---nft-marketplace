/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_API_URL?: string
  readonly VITE_SOCKET_URL?: string
  readonly VITE_HTTP_TIMEOUT?: string
}
