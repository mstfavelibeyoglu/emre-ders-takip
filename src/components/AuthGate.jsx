import { useState } from 'react'
import { firebaseEnabled, useAuth, isAllowed, login, logout } from '../lib/firebase'

export default function AuthGate({ children }) {
  const { ready, user } = useAuth()
  const [error, setError] = useState('')

  if (!firebaseEnabled) return children(null)
  if (!ready) return <div className="auth-screen"><div className="muted">Yükleniyor…</div></div>
  if (user && isAllowed(user)) return children(user)

  const signIn = async () => {
    setError('')
    try {
      await login()
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user') setError('Giriş yapılamadı: ' + (e?.code || e?.message))
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="./icon.svg" alt="" width="56" height="56" />
        <h1>Ders Takip</h1>
        {user ? (
          <>
            <p className="muted"><b>{user.email}</b> hesabının bu uygulamaya erişimi yok.</p>
            <button className="btn" onClick={logout}>Başka hesapla gir</button>
          </>
        ) : (
          <>
            <p className="muted">Devam etmek için Google hesabınla giriş yap.</p>
            <button className="btn primary big-btn" onClick={signIn}>Google ile giriş yap</button>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  )
}
