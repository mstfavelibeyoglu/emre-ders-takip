import { useState } from 'react'
import { firebaseEnabled, useAuth, login, logout } from '../lib/firebase'
import { useAccess } from '../lib/cloud'

function Screen({ children }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="./icon.svg" alt="" width="56" height="56" />
        <h1>Ders Takip</h1>
        {children}
      </div>
    </div>
  )
}

export default function AuthGate({ children }) {
  const { ready, user } = useAuth()
  const { role } = useAccess(firebaseEnabled ? user : null)
  const [msg, setMsg] = useState('')

  if (!firebaseEnabled) return children(null, 'local')
  if (!ready || (user && role === undefined)) return <Screen><div className="muted">Yükleniyor…</div></Screen>
  if (user && role) return children(user, role)

  const signIn = async () => {
    setMsg('')
    try {
      await login()
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user') setMsg('Giriş yapılamadı: ' + (e?.code || e?.message))
    }
  }

  if (user) {
    return (
      <Screen>
        <p className="muted">Merhaba {user.displayName?.split(' ')[0] || ''}! Erişim isteğin Mustafa'ya iletildi. Onaylayınca bu sayfa kendiliğinden açılır.</p>
        <div className="auth-email">{user.email}</div>
        <div className="row gap center wrap">
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(user.email); setMsg('E-posta kopyalandı ✓') }}>Kopyala</button>
          <button className="btn" onClick={logout}>Başka hesapla gir</button>
        </div>
        {msg && <div className={msg.endsWith('✓') ? 'ok' : 'error'}>{msg}</div>}
      </Screen>
    )
  }

  return (
    <Screen>
      <p className="muted">Devam etmek için Google hesabınla giriş yap.</p>
      <button className="btn primary big-btn" onClick={signIn}>Google ile giriş yap</button>
      {msg && <div className="error">{msg}</div>}
    </Screen>
  )
}
