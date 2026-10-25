// Deneme dosyalarını (PDF sayfaları + fotoğraflar) sayfa listesine çevirir, çizer ve kırpar.
import { getImage, compress, trimWhite } from './images'
import { analyzeDocument, boxesForPage } from './qdetect'

export const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')
const SCALE = 2

async function pdfjsLib() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  return pdfjs
}

// Bir denemenin dosyalarını sayfa listesine çevirir (PDF sayfaları + fotoğraflar).
export async function openFiles(files) {
  const pages = []
  for (const f of files) {
    const blob = await getImage(f.key)
    if (!blob) continue
    if (f.type === 'pdf') {
      const pdfjs = await pdfjsLib()
      const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise
      const anchors = await analyzeDocument(doc)
      // Numara 1'e dönünce yeni test (bölüm) başlar.
      let section = 0, last = Infinity
      for (let i = 1; i <= doc.numPages; i++) {
        const a = anchors[i - 1]
        if (a.length && a[0].n < last && a[0].n <= 2 && last !== Infinity) section++
        if (a.length) last = a[a.length - 1].n
        pages.push({ kind: 'pdf', doc, pageNo: i, anchors: a, section: a.length ? section : null, label: `${f.name} · s.${i}` })
      }
    } else {
      pages.push({ kind: 'img', blob, key: f.key, anchors: [], section: null, label: f.name })
    }
  }
  return pages
}

export async function renderPage(p) {
  if (p.kind === 'img') {
    const bmp = await createImageBitmap(p.blob)
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    c.getContext('2d').drawImage(bmp, 0, 0)
    return { canvas: c, boxes: [] }
  }
  const page = await p.doc.getPage(p.pageNo)
  const vp = page.getViewport({ scale: SCALE })
  const c = document.createElement('canvas')
  c.width = vp.width
  c.height = vp.height
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp, canvas: c }).promise
  const base = page.getViewport({ scale: 1 })
  const [a, bb, cc, d, e, f] = vp.transform
  const pt = (x, y) => [a * x + cc * y + e, bb * x + d * y + f]
  const boxes = boxesForPage(p.anchors, base.width, base.height).map(b => {
    const [x1, y1] = pt(b.rect[0], b.rect[1])
    const [x2, y2] = pt(b.rect[2], b.rect[3])
    return { n: b.n, x: Math.min(x1, x2) / c.width, y: Math.min(y1, y2) / c.height, w: Math.abs(x2 - x1) / c.width, h: Math.abs(y2 - y1) / c.height }
  })
  return { canvas: c, boxes }
}

export function cropBlob(canvas, r) {
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(r.w * canvas.width))
  out.height = Math.max(1, Math.round(r.h * canvas.height))
  out.getContext('2d').drawImage(canvas, r.x * canvas.width, r.y * canvas.height, out.width, out.height, 0, 0, out.width, out.height)
  return compress(trimWhite(out))
}

