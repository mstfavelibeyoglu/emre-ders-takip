// Denemenin tamamını (PDF / fotoğraflar) yükle, sayfalarda yanlış yaptığın sorulara dokun.
// Dijital PDF'lerde soru kutuları otomatik bulunur; fotoğraflarda soru parmakla çerçevelenir.
import { useEffect, useRef, useState } from 'react'
import { putImage, getImage, deleteImages, compress, trimWhite } from '../lib/images'
import { analyzeDocument, boxesForPage } from '../lib/qdetect'
import { uid } from '../lib/calc'
import { Card, Empty } from '../components/ui'
import { MistakeForm } from './Mistakes'

const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')
const SCALE = 2

async function pdfjsLib() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  return pdfjs
}

// Bir denemenin dosyalarını sayfa listesine çevirir (PDF sayfaları + fotoğraflar).
async function openFiles(files) {
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
      pages.push({ kind: 'img', blob, anchors: [], section: null, label: f.name })
    }
  }
  return pages
}

async function renderPage(p) {
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

function cropBlob(canvas, r) {
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(r.w * canvas.width))
  out.height = Math.max(1, Math.round(r.h * canvas.height))
  out.getContext('2d').drawImage(canvas, r.x * canvas.width, r.y * canvas.height, out.width, out.height, 0, 0, out.width, out.height)
  return compress(trimWhite(out))
}

export default function MarkPage({ data, update, examId, openExam }) {
  const exam = data.exams.find(e => e.id === examId)
  const [pages, setPages] = useState(null)
  const [idx, setIdx] = useState(0)
  const [view, setView] = useState(null)
  const [rect, setRect] = useState(null)
  const [draw, setDraw] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState('')
  const [sectionSubject, setSectionSubject] = useState(() => exam?.sectionMap || {})
  const fileRef = useRef(null)
  const camRef = useRef(null)
  const canvasRef = useRef(null)
  const wrap = useRef(null)
  const drag = useRef(null)

  const files = exam?.files || []
  const filesKey = files.map(f => f.key).join(',')

  useEffect(() => {
    if (!files.length) return setPages([])
    setBusy('Deneme açılıyor…')
    openFiles(files)
      .then(p => {
        setPages(p)
        const first = Math.max(0, p.findIndex(x => x.anchors.length))
        setIdx(i => (i === 0 ? first : Math.min(i, Math.max(0, p.length - 1))))
      })
      .catch(e => { console.error(e); setPages([]) })
      .finally(() => setBusy(''))
  }, [filesKey])

  const page = pages?.[idx]
  useEffect(() => {
    if (!page) return setView(null)
    let alive = true
    setRect(null)
    renderPage(page).then(v => { if (!alive) return; setView(v); setDraw(!v.boxes.length) })
    return () => { alive = false }
  }, [page])

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !view) return
    c.width = view.canvas.width
    c.height = view.canvas.height
    c.getContext('2d').drawImage(view.canvas, 0, 0)
  }, [view])

  if (!exam) return <Empty icon="🔎" title="Deneme bulunamadı" />

  const marked = data.mistakes.filter(m => m.examId === exam.id)
  const markedOnPage = n => marked.find(m => m.source?.page === idx && m.source?.n === n && m.source?.section === page?.section)

  const upload = async e => {
    const list = [...e.target.files]
    e.target.value = ''
    if (!list.length) return
    setBusy('Dosyalar kaydediliyor…')
    const added = []
    for (const f of list) {
      const key = 'exam-' + uid()
      if (isPdf(f)) {
        await putImage(key, f)
        added.push({ key, name: f.name, type: 'pdf' })
      } else {
        await putImage(key, await compress(f, 2400, 0.85))
        added.push({ key, name: f.name || 'Fotoğraf', type: 'img' })
      }
    }
    update(d => { const x = d.exams.find(y => y.id === exam.id); x.files = [...(x.files || []), ...added]; return d })
    setBusy('')
  }

  const removeFiles = () => {
    if (!confirm('Bu denemeye yüklenen dosyalar silinsin mi? (Kaydettiğin soru görselleri kalır.)')) return
    deleteImages(files.map(f => f.key))
    update(d => { const x = d.exams.find(y => y.id === exam.id); x.files = []; return d })
    setIdx(0)
  }

  const choose = async (r, n) => {
    if (!view) return
    const blob = await cropBlob(view.canvas, r)
    const sec = page.section
    setForm({
      initial: {
        blobs: [blob],
        qNo: n ? String(n) : '',
        subjectId: (sec != null && sectionSubject[sec]) || data.settings.subjects[0].id,
        source: { page: idx, n: n ?? null, section: sec }
      }
    })
  }

  const onSaved = rec => {
    const sec = rec.source?.section
    if (sec == null) return
    const map = { ...sectionSubject, [sec]: rec.subjectId }
    setSectionSubject(map)
    update(d => { const x = d.exams.find(y => y.id === exam.id); x.sectionMap = map; return d })
  }

  const pos = e => {
    const r = wrap.current.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const down = e => {
    if (!draw || e.target.closest('.qbox')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = pos(e)
    setDragging(true)
    setRect({ ...drag.current, w: 0, h: 0 })
  }
  const move = e => {
    if (!drag.current) return
    const p = pos(e), s = drag.current
    setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  const up = () => {
    drag.current = null
    setDragging(false)
    setRect(r => (r && (r.w < 0.03 || r.h < 0.02) ? null : r))
  }

  const sectionLabel = page?.section != null ? `${page.section + 1}. test` : null

  return (
    <div className="stack">
      <Card>
        <div className="row gap wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3>{exam.name}</h3>
            <small className="muted">{marked.length} soru kaydedildi · Yanlış yaptığın soruya dokun ya da parmağınla çerçevele.</small>
          </div>
          <div className="row gap wrap">
            <button className="btn small" onClick={() => camRef.current.click()}>📷 Fotoğraf çek</button>
            <button className="btn small" onClick={() => fileRef.current.click()}>📄 PDF / fotoğraf ekle</button>
            {files.length > 0 && <button className="btn small ghost danger" onClick={removeFiles}>Dosyaları kaldır</button>}
            <button className="btn small primary" onClick={() => openExam(exam.id)}>Bitti</button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={upload} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={upload} />
      </Card>

      {busy && <div className="muted" style={{ textAlign: 'center' }}>{busy}</div>}

      {pages && !pages.length && !busy && (
        <Empty icon="📄" title="Denemenin kitapçığını yükle">
          <p>PDF'in tamamını ya da sayfaların fotoğraflarını ekle. Sonra yanlış yaptığın sorulara dokunarak seçersin.<br />Dosyalar yalnızca bu cihazda saklanır.</p>
          <div className="row center gap wrap">
            <button className="btn primary" onClick={() => fileRef.current.click()}>📄 PDF / fotoğraf seç</button>
            <button className="btn" onClick={() => camRef.current.click()}>📷 Fotoğraf çek</button>
          </div>
        </Empty>
      )}

      {page && (
        <Card className="mark-card">
          <div className="row gap wrap mark-nav">
            <button className="btn small" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>← Önceki</button>
            <select value={idx} onChange={e => setIdx(+e.target.value)} aria-label="Sayfa">
              {pages.map((p, i) => (
                <option key={i} value={i}>
                  Sayfa {i + 1}{p.anchors.length ? ` · ${p.section + 1}. test, soru ${p.anchors[0].n}–${p.anchors.at(-1).n}` : ''}
                </option>
              ))}
            </select>
            <button className="btn small" disabled={idx >= pages.length - 1} onClick={() => setIdx(i => i + 1)}>Sonraki →</button>
          </div>
          {sectionLabel && (
            <p className="note">
              {sectionLabel}
              {sectionSubject[page.section] && <> · son seçilen ders: <b>{data.settings.subjects.find(s => s.id === sectionSubject[page.section])?.name}</b></>}
              {' '}· Kutular otomatik bulundu; tutmazsa "Elle çiz" ile kendin çerçevele.
            </p>
          )}
          {page.kind === 'pdf' && !page.anchors.length && <p className="note">Bu sayfada soru bulunamadı (kapak/yönerge sayfası ya da taranmış PDF olabilir). Soruyu "Elle çiz" ile çerçevele.</p>}
          {page.kind === 'img' && <p className="note">Soruyu parmağınla ya da fareyle sürükleyerek çerçevele.</p>}
          <div className="row gap wrap" style={{ marginTop: 8 }}>
            <button className={'btn small ' + (draw ? 'primary' : '')} onClick={() => { setDraw(d => !d); setRect(null) }}>
              ✏️ Elle çiz {draw ? 'açık' : 'kapalı'}
            </button>
            <small className="muted">{draw ? 'Sorunun etrafına parmağınla kutu çiz.' : 'Sayfayı kaydırabilir, kutulara dokunabilirsin.'}</small>
          </div>
          <div ref={wrap} className={'mark-wrap ' + (draw ? 'drawing' : '')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <canvas ref={canvasRef} />
            {!view && <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Sayfa çiziliyor…</div>}
            {view?.boxes.map(b => {
              const done = markedOnPage(b.n)
              return (
                <button
                  key={b.n}
                  className={'qbox ' + (done ? 'done' : '')}
                  style={{ left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' }}
                  onClick={() => (done ? null : choose(b, b.n))}
                  title={done ? 'Kaydedildi' : `Soru ${b.n}: yanlış yaptım`}
                >
                  <span>{done ? '✓ ' : ''}{b.n}</span>
                </button>
              )
            })}
            {rect && <div className="crop-rect" style={{ left: rect.x * 100 + '%', top: rect.y * 100 + '%', width: rect.w * 100 + '%', height: rect.h * 100 + '%' }} />}
          </div>
          {rect && !dragging && (
            <div className="row gap end mark-actions">
              <button className="btn" onClick={() => setRect(null)}>Vazgeç</button>
              <button className="btn primary" onClick={() => { const r = rect; setRect(null); choose(r, null) }}>Bu soruyu kaydet</button>
            </div>
          )}
        </Card>
      )}

      {form && <MistakeForm data={data} update={update} exam={exam} initial={form.initial} onSaved={onSaved} onClose={() => setForm(null)} />}
    </div>
  )
}
