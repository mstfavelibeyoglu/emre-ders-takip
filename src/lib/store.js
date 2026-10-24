import { useEffect, useState, useCallback } from 'react'
import { emptyData, DEFAULT_SETTINGS } from './defaults'

const KEY = 'emre-ders-takip-v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    return normalize(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

// Eski/eksik yedekleri güvenle açabilmek için alanları tamamlar.
export function normalize(d) {
  const base = emptyData()
  if (!d || typeof d !== 'object') return base
  const settings = { ...base.settings, ...(d.settings || {}) }
  settings.tyt = { ...DEFAULT_SETTINGS.tyt, ...(settings.tyt || {}), tests: { ...DEFAULT_SETTINGS.tyt.tests, ...(settings.tyt?.tests || {}) } }
  if (!Array.isArray(settings.subjects) || !settings.subjects.length) settings.subjects = base.settings.subjects
  if (!Array.isArray(settings.errorReasons) || !settings.errorReasons.length) settings.errorReasons = base.settings.errorReasons
  return {
    version: 1,
    settings,
    exams: Array.isArray(d.exams) ? d.exams : [],
    mistakes: Array.isArray(d.mistakes) ? d.mistakes : []
  }
}

export function useStore() {
  const [data, setData] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch (e) {
      console.error('Kaydedilemedi', e)
    }
  }, [data])

  useEffect(() => {
    // Chrome'un depolamayı kendiliğinden silmemesi için kalıcı depolama iste.
    navigator.storage?.persist?.().catch(() => {})
    const onStorage = e => { if (e.key === KEY) setData(load()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback(fn => setData(prev => normalize(fn(structuredClone(prev)) ?? prev)), [])
  return [data, update, setData]
}
