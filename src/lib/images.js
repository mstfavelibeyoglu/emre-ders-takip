// Soru görselleri IndexedDB'de tutulur (localStorage birkaç MB ile sınırlı olduğu için).
import { useEffect, useState } from 'react'

const DB = 'emre-ders-takip-files'
const STORE = 'images'
let dbp = null

function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

async function tx(mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(r?.result)
    t.onerror = () => reject(t.error)
  })
}

const idbPut = (id, blob) => tx('readwrite', s => s.put(blob, id))
const idbGet = id => tx('readonly', s => s.get(id))
const idbDelete = ids => tx('readwrite', s => ids.forEach(id => s.delete(id)))

// --- Bulut (Firebase Storage): her cihaz kendi önbelleğini (IndexedDB) tutar, eksik olanı buluttan indirir ---
let cloud = null // { storage, path(id) }
const PENDING = 'emre-bekleyen-yuklemeler'
const pending = () => { try { return JSON.parse(localStorage.getItem(PENDING) || '[]') } catch { return [] } }
const setPending = ids => { try { localStorage.setItem(PENDING, JSON.stringify([...new Set(ids)])) } catch {} }

export async function enableCloudFiles(app, studentId, canWrite) {
  const { getStorage, ref, uploadBytes, getBlob, deleteObject } = await import('firebase/storage')
  const storage = getStorage(app)
  const r = id => ref(storage, `students/${studentId}/files/${id}`)
  cloud = {
    canWrite,
    upload: async (id, blob) => uploadBytes(r(id), blob, { contentType: blob.type || 'application/octet-stream' }),
    download: id => getBlob(r(id)),
    remove: id => deleteObject(r(id)).catch(e => { if (e.code !== 'storage/object-not-found') throw e })
  }
  if (canWrite) flushUploads()
}

export async function flushUploads() {
  if (!cloud?.canWrite) return
  for (const id of pending()) {
    try {
      const blob = await idbGet(id)
      if (blob) await cloud.upload(id, blob)
      setPending(pending().filter(x => x !== id))
    } catch (e) {
      console.warn('Yükleme bekletiliyor', id, e.code || e)
      return
    }
  }
}
if (typeof window !== 'undefined') window.addEventListener('online', () => flushUploads())

export async function putImage(id, blob) {
  await idbPut(id, blob)
  if (!cloud?.canWrite) return
  try {
    await cloud.upload(id, blob)
  } catch (e) {
    console.warn('Yükleme sonraya kaldı', id, e.code || e)
    setPending([...pending(), id])
  }
}

export async function getImage(id) {
  const local = await idbGet(id)
  if (local || !cloud) return local
  try {
    const blob = await cloud.download(id)
    await idbPut(id, blob)
    return blob
  } catch (e) {
    console.warn('Görsel indirilemedi', id, e.code || e)
    return undefined
  }
}

export async function deleteImages(ids) {
  await idbDelete(ids)
  if (cloud?.canWrite) await Promise.all(ids.map(id => cloud.remove(id).catch(e => console.warn('Silinemedi', id, e.code || e))))
}

// Bu cihazdaki tüm görselleri buluta yükler (ilk aktarımda).
export async function uploadAllLocal(ids, onProgress) {
  let i = 0
  for (const id of ids) {
    const blob = await idbGet(id)
    if (blob) await cloud.upload(id, blob)
    onProgress?.(++i, ids.length)
  }
}

export const allImageKeys = () => tx('readonly', s => s.getAllKeys())
// Yalnızca bu cihazdaki önbelleği temizler; buluttaki dosyalara dokunmaz.
export const clearImages = () => tx('readwrite', s => s.clear())

// Fotoğrafı makul boyuta indirir: uzun kenar en fazla 1600 px, JPEG.
export async function compress(source, max = 1600, quality = 0.82) {
  const bmp = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise(r => c.toBlob(r, 'image/jpeg', quality))
}

// Kırpılan sorunun etrafındaki beyaz boşluğu keser (soru kutusu bir sonraki soruya kadar uzanır).
export function trimWhite(src, pad = 14) {
  const { width: w, height: h } = src
  const px = src.getContext('2d').getImageData(0, 0, w, h).data
  const ink = i => px[i + 3] > 0 && px[i] + px[i + 1] + px[i + 2] < 690
  // Sütun ayırıcı gibi ince çizgiler (satırda birkaç piksel) içerik sayılmaz.
  const rowMin = Math.max(4, Math.round(w * 0.006))
  const colMin = Math.max(4, Math.round(h * 0.006))
  const rows = new Uint32Array(h), cols = new Uint32Array(w)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink((y * w + x) * 4)) { rows[y]++; cols[x]++ }
  let top = 0, bottom = h - 1, left = 0, right = w - 1
  while (top < h && rows[top] < rowMin) top++
  while (bottom > top && rows[bottom] < rowMin) bottom--
  while (left < w && cols[left] < colMin) left++
  while (right > left && cols[right] < colMin) right--
  if (top >= h || left >= w) return src
  const x0 = Math.max(0, left - pad), y0 = Math.max(0, top - pad)
  const out = document.createElement('canvas')
  out.width = Math.min(w, right + pad) - x0
  out.height = Math.min(h, bottom + pad) - y0
  out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

const cache = new Map()
export function useImageUrl(id) {
  const [url, setUrl] = useState(() => cache.get(id) || null)
  useEffect(() => {
    if (!id || cache.has(id)) return setUrl(cache.get(id) || null)
    let alive = true
    getImage(id).then(blob => {
      if (!blob || !alive) return
      const u = URL.createObjectURL(blob)
      cache.set(id, u)
      setUrl(u)
    })
    return () => { alive = false }
  }, [id])
  return url
}
