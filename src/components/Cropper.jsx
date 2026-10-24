import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui'
import { compress, trimWhite } from '../lib/images'

// Aynı oturumda açılan son PDF'i hatırla: bir denemedeki birden çok yanlışı art arda kırpmak için.
let lastPdf = null

async function loadPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  lastPdf = { name: file.name, doc, page: 1 }
  return lastPdf
}

async function renderPage(doc, n) {
  const page = await doc.getPage(n)
  const viewport = page.getViewport({ scale: 2 })
  const c = document.createElement('canvas')
  c.width = viewport.width
  c.height = viewport.height
  await page.render({ canvasContext: c.getContext('2d'), viewport, canvas: c }).promise
  return c
}

async function imageCanvas(file) {
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  c.getContext('2d').drawImage(bmp, 0, 0)
  return c
}

function rotate(src) {
  const c = document.createElement('canvas')
  c.width = src.height
  c.height = src.width
  const ctx = c.getContext('2d')
  ctx.translate(c.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(src, 0, 0)
  return c
}

export const hasLastPdf = () => !!lastPdf
export const lastPdfName = () => lastPdf?.name

// source: { file } (görsel ya da PDF) veya { reusePdf: true }
export default function Cropper({ source, onDone, onClose }) {
  const [canvas, setCanvas] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [pageNo, setPageNo] = useState(1)
  const [rect, setRect] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const view = useRef(null)
  const wrap = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    ;(async () => {
      try {
        if (source.reusePdf && lastPdf) {
          setPdf(lastPdf)
          setPageNo(lastPdf.page)
        } else if (source.file.type === 'application/pdf' || /\.pdf$/i.test(source.file.name)) {
          const p = await loadPdf(source.file)
          setPdf(p)
          setPageNo(1)
        } else {
          setCanvas(await imageCanvas(source.file))
          setBusy(false)
        }
      } catch (e) {
        console.error(e)
        setError('Dosya açılamadı. Fotoğraf (JPG/PNG/HEIC) ya da PDF seç.')
        setBusy(false)
      }
    })()
  }, [source])

  useEffect(() => {
    if (!pdf) return
    let alive = true
    setBusy(true)
    renderPage(pdf.doc, pageNo).then(c => {
      if (!alive) return
      pdf.page = pageNo
      setCanvas(c)
      setRect(null)
      setBusy(false)
    })
    return () => { alive = false }
  }, [pdf, pageNo])

  useEffect(() => {
    if (!canvas || !view.current) return
    const v = view.current
    v.width = canvas.width
    v.height = canvas.height
    v.getContext('2d').drawImage(canvas, 0, 0)
  }, [canvas])

  const pos = e => {
    const r = wrap.current.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const down = e => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = pos(e)
    setRect({ x: drag.current.x, y: drag.current.y, w: 0, h: 0 })
  }
  const move = e => {
    if (!drag.current) return
    const p = pos(e), s = drag.current
    setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  const up = () => {
    drag.current = null
    setRect(r => (r && (r.w < 0.02 || r.h < 0.02) ? null : r))
  }

  const finish = async () => {
    setBusy(true)
    let out = canvas
    if (rect) {
      out = document.createElement('canvas')
      const sx = rect.x * canvas.width, sy = rect.y * canvas.height
      out.width = Math.max(1, Math.round(rect.w * canvas.width))
      out.height = Math.max(1, Math.round(rect.h * canvas.height))
      out.getContext('2d').drawImage(canvas, sx, sy, out.width, out.height, 0, 0, out.width, out.height)
    }
    onDone(await compress(rect ? trimWhite(out) : out))
  }

  const pages = pdf?.doc.numPages || 0

  return (
    <Modal title="Soruyu seç" onClose={onClose} wide>
      {error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="stack-sm">
          <p className="note" style={{ marginTop: 0 }}>Sürükleyerek sorunun etrafına bir kutu çiz. Seçim yapmazsan görselin tamamı kaydedilir.</p>
          {pdf && (
            <div className="row gap wrap">
              <button type="button" className="btn small" disabled={pageNo <= 1 || busy} onClick={() => setPageNo(p => p - 1)}>←</button>
              <label className="row gap" style={{ flexDirection: 'row', alignItems: 'center' }}>
                Sayfa
                <input type="number" min="1" max={pages} value={pageNo} style={{ width: 70 }} onChange={e => { const n = +e.target.value; if (n >= 1 && n <= pages) setPageNo(n) }} />
                / {pages}
              </label>
              <button type="button" className="btn small" disabled={pageNo >= pages || busy} onClick={() => setPageNo(p => p + 1)}>→</button>
              <small className="muted grow" style={{ textAlign: 'right' }}>{pdf.name}</small>
            </div>
          )}
          <div className="crop-area">
            {busy && !canvas && <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Yükleniyor…</div>}
            <div ref={wrap} className="crop-wrap" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ display: canvas ? 'block' : 'none' }}>
              <canvas ref={view} />
              {rect && (
                <div className="crop-rect" style={{ left: rect.x * 100 + '%', top: rect.y * 100 + '%', width: rect.w * 100 + '%', height: rect.h * 100 + '%' }} />
              )}
            </div>
          </div>
          <div className="row gap wrap end">
            <button type="button" className="btn" disabled={!canvas || busy} onClick={() => { setCanvas(rotate(canvas)); setRect(null) }}>⟳ Döndür</button>
            {rect && <button type="button" className="btn" onClick={() => setRect(null)}>Seçimi temizle</button>}
            <button type="button" className="btn primary" disabled={!canvas || busy} onClick={finish}>{rect ? 'Kırp ve ekle' : 'Tamamını ekle'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
