// Ortak veri: tek öğrencinin denemeleri, hata defteri ve ayarları Firestore'da.
// Ekranlar eskisi gibi tek bir `data` nesnesiyle çalışır; update() neyin değiştiğini bulup
// yalnızca o belgeleri yazar. Firestore çevrimdışıyken yerel önbellekten çalışır, bağlanınca eşitler.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, onSnapshot, writeBatch, setDoc, getDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp
} from 'firebase/firestore'
import { app } from './firebase'
import { normalize } from './store'
import { OWNER_EMAIL, STUDENT_ID } from '../config'

export const db = app
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), ignoreUndefinedProperties: true })
  : null

const studentRef = () => doc(db, 'students', STUDENT_ID)
const col = name => collection(db, 'students', STUDENT_ID, name)
const accessRef = () => doc(db, 'meta', 'access')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const clean = o => JSON.parse(JSON.stringify(o))

async function commitDiff(prev, next) {
  const ops = []
  if (!same(prev.settings, next.settings)) ops.push(b => b.set(studentRef(), { settings: clean(next.settings), updatedAt: serverTimestamp() }, { merge: true }))
  for (const name of ['exams', 'mistakes']) {
    const old = new Map(prev[name].map(x => [x.id, x]))
    const now = new Map(next[name].map(x => [x.id, x]))
    for (const [id, x] of now) if (!same(old.get(id), x)) ops.push(b => b.set(doc(col(name), id), clean(x)))
    for (const id of old.keys()) if (!now.has(id)) ops.push(b => b.delete(doc(col(name), id)))
  }
  // Bir toplu yazma en fazla 500 işlem alır.
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db)
    ops.slice(i, i + 400).forEach(op => op(batch))
    await batch.commit()
  }
  return ops.length
}

export function useCloudStore(enabled, canEdit, onDenied) {
  const [parts, setParts] = useState({ settings: undefined, exams: undefined, mistakes: undefined })
  const [error, setError] = useState('')
  const dataRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const fail = e => { console.error(e); setError(e.code === 'permission-denied' ? 'Bu verileri görme yetkin yok.' : 'Bağlantı hatası: ' + (e.code || e.message)) }
    const un = [
      onSnapshot(studentRef(), s => setParts(p => ({ ...p, settings: s.exists() ? s.data().settings || null : null })), fail),
      onSnapshot(col('exams'), s => setParts(p => ({ ...p, exams: s.docs.map(d => d.data()) })), fail),
      onSnapshot(col('mistakes'), s => setParts(p => ({ ...p, mistakes: s.docs.map(d => d.data()) })), fail)
    ]
    return () => un.forEach(u => u())
  }, [enabled])

  const loaded = enabled && parts.settings !== undefined && parts.exams && parts.mistakes
  const data = loaded ? normalize({ settings: parts.settings || undefined, exams: parts.exams, mistakes: parts.mistakes }) : null
  dataRef.current = data
  const empty = loaded && !parts.settings && !parts.exams.length && !parts.mistakes.length

  const update = useCallback(
    fn => {
      const prev = dataRef.current
      if (!prev) return
      if (!canEdit) return onDenied?.()
      const next = normalize(fn(structuredClone(prev)) ?? prev)
      commitDiff(prev, next).catch(e => {
        console.error(e)
        setError(e.code === 'permission-denied' ? 'Değişiklik kaydedilemedi: yetkin yok.' : 'Kaydedilemedi: ' + (e.code || e.message))
      })
    },
    [canEdit, onDenied]
  )
  const replace = useCallback(next => update(() => next), [update])

  return { data, update, replace, loaded, empty, error }
}

// --- Erişim: sahip, düzenleyiciler (Emre), görüntüleyiciler (baba) ---

export function useAccess(user) {
  const [state, setState] = useState({ role: undefined, access: null })
  const isOwner = !!user && (user.email || '').toLowerCase() === OWNER_EMAIL

  useEffect(() => {
    if (!user || !db) return setState({ role: undefined, access: null })
    let un = null, timer = null, alive = true
    const email = (user.email || '').toLowerCase()
    const listen = () => {
      un = onSnapshot(
        accessRef(),
        s => {
          const a = s.exists() ? s.data() : { editors: [], viewers: [] }
          const role = isOwner ? 'owner' : a.editors?.includes(email) ? 'editor' : a.viewers?.includes(email) ? 'viewer' : null
          setState({ role, access: a })
          if (isOwner && !s.exists()) setDoc(accessRef(), { editors: [], viewers: [] })
        },
        e => {
          if (!alive) return
          // Yetkisi olmayan kullanıcı: isteğini bırak, onaylanınca otomatik girsin diye arada bir tekrar dene.
          if (e.code === 'permission-denied' && !isOwner) {
            setState({ role: null, access: null })
            setDoc(doc(db, 'requests', user.uid), { email, name: user.displayName || '', at: serverTimestamp() }).catch(() => {})
            timer = setTimeout(listen, 15000)
          } else {
            console.error(e)
            setState(s => ({ ...s, role: s.role ?? (isOwner ? 'owner' : null) }))
          }
        }
      )
    }
    listen()
    return () => { alive = false; un?.(); clearTimeout(timer) }
  }, [user?.uid])

  return state
}

export function useRequests(enabled) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!enabled || !db) return
    return onSnapshot(collection(db, 'requests'), s => setList(s.docs.map(d => ({ uid: d.id, ...d.data() }))), e => console.error(e))
  }, [enabled])
  return list
}

export async function grant(email, role, uid) {
  const e = email.toLowerCase()
  await setDoc(accessRef(), role === 'editor' ? { editors: arrayUnion(e), viewers: arrayRemove(e) } : { viewers: arrayUnion(e), editors: arrayRemove(e) }, { merge: true })
  if (uid) await deleteDoc(doc(db, 'requests', uid))
}

export async function revoke(email) {
  const e = email.toLowerCase()
  await setDoc(accessRef(), { editors: arrayRemove(e), viewers: arrayRemove(e) }, { merge: true })
}

export const rejectRequest = uid => deleteDoc(doc(db, 'requests', uid))

export async function cloudHasData() {
  const s = await getDoc(studentRef())
  return s.exists()
}
