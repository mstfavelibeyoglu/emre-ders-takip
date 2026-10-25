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

const ERR = {
  'storage/unauthorized': 'yetki yok (Storage kuralları)',
  'storage/object-not-found': 'buluta hiç yüklenmemiş',
  'storage/retry-limit-exceeded': 'bağlantı yok',
  'storage/unauthenticated': 'giriş gerekli'
}

// --- Bulut (Firebase Storage): her cihaz kendi önbelleğini (IndexedDB) tutar, eksik olanı buluttan indirir ---
let cloud = null // { storage, path(id) }
const PENDING = 'emre-bekleyen-yuklemeler'
const pending = () => { try { return JSON.parse(localStorage.getItem(PENDING) || '[]') } catch { return [] } }
const setPending = ids => { try { localStorage.setItem(PENDING, JSON.stringify([...new Set(ids)])) } catch {} }

export async function enableCloudFiles(app, studentId, canWrite) {
  const { getStorage, ref, uploadBytes, getBlob, getDownloadURL, deleteObject, listAll, getMetadata } = await import('firebase/storage')
  const storage = getStorage(app)
  // Bağlantı/CORS hatalarında dakikalarca yeniden denemek yerine çabuk vazgeç.
  storage.maxOperationRetryTime = 8000
  const r = id => ref(storage, `students/${studentId}/files/${id}`)
  cloud = {
    canWrite,
    upload: async (id, blob) => uploadBytes(r(id), blob, { contentType: blob.type || 'application/octet-stream' }),
    download: id => getBlob(r(id)),
    url: id => getDownloadURL(r(id)),
    list: async () => (await listAll(ref(storage, `students/${studentId}/files`))).items.map(i => i.name),
    size: async id => (await getMetadata(r(id))).size,
    remove: id => deleteObject(r(id)).catch(e => { if (e.code !== 'storage/object-not-found') throw e })
  }
  if (canWrite) flushUploads()
}

// Sonuç: { done, left, error } — Ayarlar'daki eşitleme kutusu bunu gösterir.
export async function flushUploads() {
  if (!cloud?.canWrite) return { done: 0, left: pending().length, error: cloud ? 'yetki yok' : 'bulut kapalı' }
  let done = 0
  for (const id of pending()) {
    try {
      const blob = await idbGet(id)
      if (blob) await cloud.upload(id, blob)
      setPending(pending().filter(x => x !== id))
      done++
    } catch (e) {
      console.warn('Yükleme bekletiliyor', id, e.code || e)
      return { done, left: pending().length, error: ERR[e.code] || e.code || 'yüklenemedi' }
    }
  }
  return { done, left: 0, error: null }
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
    // Dosya olarak indirme depoda CORS ayarı ister; yoksa burada düşer (görüntüleme yine çalışır, bkz. imageSrc).
    console.warn('Görsel indirilemedi', id, e.code || e)
    return undefined
  }
}


// Gösterim için kaynak: önce bu cihazdaki kopya, yoksa buluttan dosya, o da olmazsa doğrudan indirme adresi
// (<img> için CORS gerekmez). Hata olursa okunur bir sebep döner.
async function imageSrc(id) {
  const local = await idbGet(id)
  if (local) return { url: URL.createObjectURL(local) }
  if (!cloud) return { error: 'bu cihazda yok' }
  // Dosyayı indirmeye çalışma: depoda CORS ayarı yoksa getBlob hata vermeden uzun süre yeniden dener
  // ve kutu boş (beyaz) kalır. İndirme adresi <img> ile CORS'suz açılır.
  try {
    return { url: await cloud.url(id) }
  } catch (e) {
    return { error: ERR[e.code] || e.code || 'indirilemedi', code: e.code }
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

// Görseli <img> ile çözüp (EXIF yönü uygulanır) doğrudan hedef boyutta bir tuvale çizer.
// Tam çözünürlüklü (12 MP) ara tuval kurulmaz: iPhone bellek sınırını aşınca hata vermeden BEYAZ tuval üretebiliyor.
export async function toCanvas(source, max = 2000) {
  let el, w, h, url
  if (source instanceof HTMLCanvasElement) {
    el = source; w = source.width; h = source.height
  } else {
    url = URL.createObjectURL(source)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      el = img; w = img.naturalWidth; h = img.naturalHeight
    } catch {
      el = await createImageBitmap(source); w = el.width; h = el.height
    }
  }
  const scale = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * scale))
  c.height = Math.max(1, Math.round(h * scale))
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(el, 0, 0, c.width, c.height)
  if (url) URL.revokeObjectURL(url)
  return c
}

// Tuval bomboş beyaz mı? (çizim sessizce başarısız olduysa)
export function isBlank(canvas) {
  const n = 48
  const t = document.createElement('canvas')
  t.width = n; t.height = n
  const ctx = t.getContext('2d')
  ctx.drawImage(canvas, 0, 0, n, n)
  const px = ctx.getImageData(0, 0, n, n).data
  let sum = 0, sq = 0
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] + px[i + 1] + px[i + 2]) / 3
    sum += g; sq += g * g
  }
  const k = px.length / 4
  const mean = sum / k
  return mean > 245 && Math.sqrt(Math.max(0, sq / k - mean * mean)) < 3
}

export class BlankImageError extends Error {}

// Fotoğrafı makul boyuta indirir: uzun kenar en fazla `max` px, JPEG. Sonuç boş çıkarsa küçültülmüş
// hâl yerine orijinal (JPEG/PNG) saklanır; o da olmazsa hata verilir, beyaz görüntü asla kaydedilmez.
export async function compress(source, max = 1600, quality = 0.82) {
  const c = await toCanvas(source, max)
  if (isBlank(c)) {
    if (source instanceof Blob && /^image\/(jpeg|png|webp)$/.test(source.type) && source.size > 40000) return source
    throw new BlankImageError('Fotoğraf işlenemedi (boş çıktı). Lütfen tekrar çek.')
  }
  return new Promise(r => c.toBlob(r, 'image/jpeg', quality))
}

// Ters ya da yan çekilmiş fotoğrafı saat yönünde 90° döndürür.
export async function rotateBlob(blob, quality = 0.88) {
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bmp.height
  c.height = bmp.width
  const ctx = c.getContext('2d')
  ctx.translate(c.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(bmp, 0, 0)
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
  const [state, setState] = useState(() => ({ url: cache.get(id) || null, error: null }))
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!id) return setState({ url: null, error: null })
    if (cache.has(id)) return setState({ url: cache.get(id), error: null })
    let alive = true
    setState({ url: null, error: null })
    imageSrc(id).then(r => {
      if (!alive) return
      if (r.url) cache.set(id, r.url)
      setState({ url: r.url || null, error: r.error || null })
    })
    return () => { alive = false }
  }, [id, tick])
  return { ...state, retry: () => setTick(t => t + 1) }
}

export const pendingUploads = () => pending()

// Hata defterindeki fotoğrafları bulutla karşılaştırır; buluta hiç gitmemiş olanlar bu cihazda varsa yükler.
export async function checkAndRepair(ids) {
  const out = { total: ids.length, inCloud: 0, uploaded: 0, localOnly: 0, missing: 0, blank: [], error: null }
  if (!cloud) return { ...out, error: 'bulut kapalı' }
  let names
  try {
    names = new Set(await cloud.list())
  } catch (e) {
    return { ...out, error: 'bulut listesi okunamadı: ' + (ERR[e.code] || e.code || e.message) }
  }
  for (const id of ids) {
    if (names.has(id)) {
      out.inCloud++
      // Gerçek bir soru fotoğrafı onlarca-yüzlerce KB tutar; çok küçük dosya büyük ihtimalle boş beyaz görüntüdür.
      try { if ((await cloud.size(id)) < 15000) out.blank.push(id) } catch {}
      continue
    }
    const blob = await idbGet(id)
    if (!blob) { out.missing++; continue }
    if (!cloud.canWrite) { out.localOnly++; continue }
    try {
      await cloud.upload(id, blob)
      setPending(pending().filter(x => x !== id))
      out.uploaded++
    } catch (e) {
      out.localOnly++
      out.error = 'yükleme hatası: ' + (ERR[e.code] || e.code || e.message)
    }
  }
  return out
}
