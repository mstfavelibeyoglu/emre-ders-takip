import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AuthGate from './components/AuthGate'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// Yüklü uygulama (PWA) arka plandan açıldığında da yeni sürümü hemen alsın.
registerSW({
  immediate: true,
  onRegisteredSW(_, r) {
    if (!r) return
    const check = () => r.update().catch(() => {})
    setInterval(check, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>{(user, role) => <App user={user} role={role} />}</AuthGate>
  </StrictMode>
)
