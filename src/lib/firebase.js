import { useEffect, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { FIREBASE_CONFIG, RECAPTCHA_ENTERPRISE_SITE_KEY } from '../config'

// Yalnızca geliştirmede: localStorage 'dev-local' = '1' iken Firebase'siz (girişsiz, yerel veriyle) açılır.
const DEV_LOCAL = import.meta.env.DEV && typeof localStorage !== 'undefined' && localStorage.getItem('dev-local') === '1'

export const firebaseEnabled = !!FIREBASE_CONFIG.apiKey && !DEV_LOCAL

export const app = firebaseEnabled ? initializeApp(FIREBASE_CONFIG) : null

// Yerel geliştirmede App Check, Firebase konsoluna kaydedilen hata ayıklama belirteciyle çalışır
// (belirteç tarayıcı konsoluna bir kez yazılır); reCAPTCHA yalnızca yayındaki sitede kullanılır.
if (app && (RECAPTCHA_ENTERPRISE_SITE_KEY || import.meta.env.DEV)) {
  if (import.meta.env.DEV) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY || 'yalnizca-gelistirme'), isTokenAutoRefreshEnabled: true })
}

const auth = app ? getAuth(app) : null

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
