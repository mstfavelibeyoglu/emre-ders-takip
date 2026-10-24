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

export const putImage = (id, blob) => tx('readwrite', s => s.put(blob, id))
export const getImage = id => tx('readonly', s => s.get(id))
export const deleteImages = ids => tx('readwrite', s => ids.forEach(id => s.delete(id)))
export const allImageKeys = () => tx('readonly', s => s.getAllKeys())
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
