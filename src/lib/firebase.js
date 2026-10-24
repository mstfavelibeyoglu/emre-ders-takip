import { useEffect, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { FIREBASE_CONFIG, ALLOWED_EMAILS, RECAPTCHA_ENTERPRISE_SITE_KEY } from '../config'

export const firebaseEnabled = !!FIREBASE_CONFIG.apiKey

export const app = firebaseEnabled ? initializeApp(FIREBASE_CONFIG) : null

if (app && RECAPTCHA_ENTERPRISE_SITE_KEY) {
  // Yerel geliştirmede App Check hata ayıklama belirteci kullanılır (konsola bir kez kaydedilir).
  if (import.meta.env.DEV) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true })
}

const auth = app ? getAuth(app) : null

export const isAllowed = user => !!user && (!ALLOWED_EMAILS.length || ALLOWED_EMAILS.includes((user.email || '').toLowerCase()))

export function useAuth() {
  const [state, setState] = useState(() => ({ ready: !auth, user: null }))
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, user => setState({ ready: true, user }))
  }, [])
  return state
}

export const login = () => signInWithPopup(auth, new GoogleAuthProvider())
export const logout = () => signOut(auth)
