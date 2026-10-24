// Tam yedek: veri (JSON) + soru görselleri ve deneme dosyaları tek bir ZIP içinde.
import { zip, unzip } from 'fflate'
import { getImage, putImage, clearImages } from './images'
import { normalize } from './store'

const referencedKeys = data => [...new Set([...data.mistakes.flatMap(m => m.imageIds || []), ...data.exams.flatMap(e => (e.files || []).map(f => f.key))])]

export async function exportZip(data, onProgress) {
  const files = { 'veri.json': new TextEncoder().encode(JSON.stringify(data, null, 2)) }
  const keys = referencedKeys(data)
  let i = 0
  for (const k of keys) {
    const blob = await getImage(k)
    if (blob) files['dosyalar/' + k] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
    onProgress?.(++i, keys.length)
  }
  const out = await new Promise((res, rej) => zip(files, (err, d) => (err ? rej(err) : res(d))))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([out], { type: 'application/zip' }))
  a.download = `ders-takip-yedek-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export async function readBackup(file) {
  if (/\.json$/i.test(file.name)) return { data: normalize(JSON.parse(await file.text())), files: {} }
  const buf = new Uint8Array(await file.arrayBuffer())
  const entries = await new Promise((res, rej) => unzip(buf, (err, d) => (err ? rej(err) : res(d))))
  if (!entries['veri.json']) throw new Error('Yedek içinde veri.json yok')
  const data = normalize(JSON.parse(new TextDecoder().decode(entries['veri.json'])))
  const files = {}
  for (const [name, bytes] of Object.entries(entries)) if (name.startsWith('dosyalar/') && bytes.length) files[name.slice(9)] = bytes
  return { data, files }
}

export async function restoreFiles(files) {
  await clearImages()
  for (const [key, bytes] of Object.entries(files)) {
    const type = key.startsWith('exam-') && bytes[0] === 0x25 && bytes[1] === 0x50 ? 'application/pdf' : 'image/jpeg'
    await putImage(key, new Blob([bytes], { type }))
  }
}
