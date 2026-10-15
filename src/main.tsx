import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-700.css'
import './styles/globals.css'

async function bootstrap() {
  const app = import('./app')
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  ;(await app).mountApp()
}

void bootstrap()
