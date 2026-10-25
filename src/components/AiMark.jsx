// Cevap anahtarı + kitapçık sayfalarını Gemini ile okuyup yanlış/boş soruları bulma ve onaylama.
import { useMemo, useRef, useState } from 'react'
import { aiEnabled, analyzePage, readAnswerKey } from '../lib/ai'
import { renderPage, cropBlob } from '../lib/pages'
import { compress, putImage } from '../lib/images'
import { uid } from '../lib/calc'
import { Card, Modal, Badge } from './ui'
import QImage from './QImage'

const CONFIDENT = 0.85
const PARALLEL = 3
const cleanKey = s => (s || '').toUpperCase().replace(/[^A-EX]/g, '')

// Numara 1'e (ya da 2'ye) geri dönünce yeni test başlar.
function withSections(pages, results) {
  const out = []
  let section = 0, last = null
  pages.forEach((_, i) => {
    const r = results[i]
    if (!r) return
    for (const q of r.sorular) {
      if (last != null && q.n < last && q.n <= 2) section++
      last = q.n
      out.push({ ...q, page: i, section })
    }
  })
  return out
}

function grade(q, key) {
  const k = key?.[q.n - 1]
  if (!k || k === 'X') return 'anahtar-yok'
  if (q.isaret === 'COKLU' || q.isaret === 'BELIRSIZ' || q.guven < CONFIDENT) return 'belirsiz'
  if (q.isaret === 'BOS') return 'Boş'
  return q.isaret === k ? 'doğru' : 'Yanlış'
}

const boxRect = (b, pad = 0.008) => {
  const [y1, x1, y2, x2] = b.map(v => v / 1000)
  const x = Math.max(0, x1 - pad), y = Math.max(0, y1 - pad)
  return { x, y, w: Math.min(1, x2 + pad) - x, h: Math.min(1, y2 + pad) - y }
}

function AnswerKey({ exam, update }) {
  const [busy, setBusy] = useState('')
  const [text, setText] = useState('')
  const [paste, setPaste] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const key = exam.answerKey || []
  const save = tests => update(d => { d.exams.find(x => x.id === exam.id).answerKey = tests; return d })

  const run = async input => {
    setErr('')
    setBusy('Cevap anahtarı okunuyor…')
    try {
      const r = await readAnswerKey(input)
      save(r.testler.map(t => ({ ad: t.ad, cevaplar: t.cevaplar.join('') })))
      if (r.uyarilar?.length) setErr(r.uyarilar.join(' · '))
      setPaste(false)
    } catch (e) {
      console.error(e)
      setErr('Okunamadı: ' + (e?.message || e))
    } finally {
      setBusy('')
    }
  }
  const onFiles = async e => {
    const files = [...e.target.files]
    e.target.value = ''
    if (files.length) run({ images: await Promise.all(files.map(f => compress(f, 2000, 0.85))) })
  }

  return (
    <div className="stack-sm">
      <div className="row gap wrap" style={{ justifyContent: 'space-between' }}>
        <b>1. Cevap anahtarı</b>
        <div className="row gap wrap">
          <button className="btn small" disabled={!!busy} onClick={() => fileRef.current.click()}>📷 Fotoğraftan oku</button>
          <button className="btn small" disabled={!!busy} onClick={() => setPaste(p => !p)}>✍️ Metin yapıştır</button>
          <button className="btn small ghost" onClick={() => save([...key, { ad: `Test ${key.length + 1}`, cevaplar: '' }])}>+ Elle test ekle</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      {paste && (
        <div className="stack-sm">
          <textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Cevap anahtarını hangi biçimde olursa olsun yapıştır (ör. Türkçe: 1-A 2-C … ya da ABCDA…)" />
          <div className="row end"><button className="btn small primary" disabled={!text.trim() || !!busy} onClick={() => run({ text })}>Oku</button></div>
        </div>
      )}
      {busy && <div className="muted">{busy}</div>}
      {err && <div className="warnbox">{err}</div>}
      {key.length > 0 ? (
        <div className="key-list">
          {key.map((t, i) => (
            <div key={i} className="key-row">
              <span className="rank">{i + 1}</span>
              <input value={t.ad} onChange={e => save(key.map((x, j) => (j === i ? { ...x, ad: e.target.value } : x)))} aria-label="Test adı" />
              <input className="mono" value={t.cevaplar} onChange={e => save(key.map((x, j) => (j === i ? { ...x, cevaplar: cleanKey(e.target.value) } : x)))} aria-label="Cevaplar" />
              <small className="muted">{cleanKey(t.cevaplar).length} soru</small>
              <button className="icon-btn" onClick={() => save(key.filter((_, j) => j !== i))} aria-label="Testi sil">✕</button>
            </div>
          ))}
          <p className="note" style={{ margin: 0 }}>Testler kitapçıktaki sırayla olmalı. Okunan harfleri kontrol et, gerekirse düzelt (X = iptal).</p>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>Henüz cevap anahtarı yok. Fotoğrafını çek ya da metnini yapıştır; biçimi önemli değil.</p>
      )}
    </div>
  )
}

function Review({ data, update, exam, pages, results, canvases, onClose }) {
  const key = (exam.answerKey || []).map(t => cleanKey(t.cevaplar))
  const all = useMemo(() => withSections(pages, results), [pages, results])
  const graded = all.map(q => ({ ...q, status: grade(q, key[q.section]) }))
  const sections = [...new Set(graded.map(q => q.section))]
  const [secSubject, setSecSubject] = useState(() => exam.sectionMap || {})
  const [rows, setRows] = useState(() =>
    graded
      .filter(q => q.status === 'Yanlış' || q.status === 'Boş' || q.status === 'belirsiz')
      .map(q => ({ ...q, decision: q.status === 'belirsiz' ? '' : q.status, subjectId: '', topic: '' }))
  )
  const [busy, setBusy] = useState('')
  const exists = q => data.mistakes.some(m => m.examId === exam.id && m.source?.page === q.page && m.source?.n === q.n)
  const subOf = q => q.subjectId || secSubject[q.section] || data.settings.subjects[0].id
  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const noKey = graded.filter(q => q.status === 'anahtar-yok').length
  const counts = s => {
    const g = graded.filter(q => q.section === s)
    return { d: g.filter(q => q.status === 'doğru').length, y: g.filter(q => q.status === 'Yanlış').length, b: g.filter(q => q.status === 'Boş').length, u: g.filter(q => q.status === 'belirsiz').length, n: g.length, k: key[s]?.length || 0 }
  }
  const toSave = rows.filter(r => (r.decision === 'Yanlış' || r.decision === 'Boş') && !exists(r))
  const undecided = rows.filter(r => r.status === 'belirsiz' && !r.decision).length

  const save = async () => {
    setBusy('Kaydediliyor…')
    const recs = []
    for (const r of toSave) {
      const canvas = canvases.get(r.page) || (await renderPage(pages[r.page])).canvas
      const ids = []
      for (const b of [r.ortakMetinKutu, r.kutu].filter(Boolean)) {
        const id = 'q-' + uid()
        await putImage(id, await cropBlob(canvas, boxRect(b)))
        ids.push(id)
      }
      const k = key[r.section]?.[r.n - 1]
      recs.push({
        id: uid(), createdAt: Date.now(), date: exam.date, examId: exam.id, examName: exam.name,
        subjectId: subOf(r), topic: r.topic.trim(), qNo: String(r.n), kind: r.decision,
        reason: '', reviewed: false, note: '', answer: k && k !== 'X' ? k : '', given: /^[A-E]$/.test(r.isaret) ? r.isaret : '',
        imageIds: ids, source: { page: r.page, n: r.n, section: r.section, ai: true }
      })
    }
    update(d => {
      d.mistakes.push(...recs)
      d.exams.find(x => x.id === exam.id).sectionMap = secSubject
      return d
    })
    setBusy('')
    onClose(recs.length)
  }

  return (
    <Modal title="Bulunan yanlışları onayla" onClose={() => onClose(0)} wide>
      <div className="stack-sm">
        <div className="table-wrap">
          <table className="mini ai-sum">
            <thead><tr><th>Test</th><th>Ders</th><th>Okunan</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Belirsiz</th></tr></thead>
            <tbody>
              {sections.map(s => {
                const c = counts(s)
                return (
                  <tr key={s}>
                    <td style={{ textAlign: 'left' }}>{exam.answerKey?.[s]?.ad || `${s + 1}. test`}{c.n !== c.k && <Badge tone="yellow">{c.n}/{c.k} soru</Badge>}</td>
                    <td>
                      <select value={secSubject[s] || ''} onChange={e => setSecSubject(m => ({ ...m, [s]: e.target.value }))}>
                        <option value="">Ders seç…</option>
                        {data.settings.subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </td>
                    <td>{c.n}</td><td>{c.d}</td><td><b>{c.y}</b></td><td>{c.b}</td><td>{c.u}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {noKey > 0 && <div className="warnbox">{noKey} sorunun anahtarı yok (test sırası ya da soru sayısı anahtarla uyuşmuyor olabilir); bu sorular değerlendirilmedi.</div>}
        <p className="note" style={{ margin: 0 }}>Okunan soru sayısı anahtarla tutmuyorsa sarı uyarı çıkar: bir sayfa atlanmış ya da yanlış okunmuş olabilir. Sosyal/Fen gibi karma testlerde dersi her soru için ayrıca seçebilirsin.</p>

        {!rows.length && <div className="ok">Hiç yanlış ya da boş bulunamadı. 🎉</div>}
        <div className="ai-rows">
          {rows.map((r, i) => {
            const k = key[r.section]?.[r.n - 1]
            const done = exists(r)
            return (
              <div key={r.page + '-' + r.n + '-' + r.section} className={'ai-row ' + (r.status === 'belirsiz' ? 'unsure' : '') + (done ? ' saved' : '')}>
                <CropPreview canvas={canvases.get(r.page)} box={r.kutu} />
                <div className="stack-sm grow">
                  <div className="m-top">
                    <b>{exam.answerKey?.[r.section]?.ad || `${r.section + 1}. test`} · Soru {r.n}</b>
                    <span className="muted">işaret: <b>{r.isaret}</b>{k ? <> · anahtar: <b>{k}</b></> : ''} · güven %{Math.round(r.guven * 100)}</span>
                    {done && <Badge tone="green">zaten kayıtlı</Badge>}
                  </div>
                  <div className="row gap wrap">
                    {['Yanlış', 'Boş', 'doğru'].map(dc => (
                      <button key={dc} className={'pill ' + (r.decision === dc ? 'on' : '')} onClick={() => setRow(i, { decision: dc })}>
                        {dc === 'doğru' ? 'Aslında doğru / atla' : dc}
                      </button>
                    ))}
                  </div>
                  {(r.decision === 'Yanlış' || r.decision === 'Boş') && !done && (
                    <div className="row gap wrap">
                      <select value={subOf(r)} onChange={e => setRow(i, { subjectId: e.target.value })} aria-label="Ders" style={{ width: 'auto' }}>
                        {data.settings.subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                      <input value={r.topic} onChange={e => setRow(i, { topic: e.target.value })} placeholder="Konu (isteğe bağlı)" style={{ flex: 1, minWidth: 140 }} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="sticky-summary">
          <div>{undecided > 0 ? <span className="error">{undecided} belirsiz soru için karar ver</span> : <span><b>{toSave.length}</b> soru hata defterine eklenecek</span>}</div>
          <button className="btn primary" disabled={!!busy || undecided > 0 || !toSave.length} onClick={save}>{busy || 'Kaydet'}</button>
        </div>
      </div>
    </Modal>
  )
}

function CropPreview({ canvas, box }) {
  const [blob, setBlob] = useState(null)
  const done = useRef(false)
  if (canvas && !done.current) {
    done.current = true
    cropBlob(canvas, boxRect(box)).then(setBlob)
  }
  return <div className="ai-thumb">{blob ? <QImage blob={blob} /> : <div className="qimg-empty" />}</div>
}

export function AiExplain({ open }) {
  return (
    <details className="ai-explain" open={open}>
      <summary>Bu ne işe yarar?</summary>
      <ol>
        <li><b>Cevap anahtarını</b> fotoğrafla ya da yapıştır; biçimi önemli değil.</li>
        <li>Yapay zekâ kitapçığın her sayfasında Emre'nin <b>daire içine aldığı şıkkı</b> okur ve anahtarla karşılaştırır.</li>
        <li><b>Yanlış ve boş</b> soruları bulur, sayfadan kırpar ve sana tek ekranda gösterir.</li>
        <li>Sen kontrol edip <b>Kaydet</b>'e basınca hepsi hata defterine girer ve zamanı gelince <b>Tekrar</b> ekranında yeniden sorulur.</li>
      </ol>
      <p className="muted">Böylece yanlışları tek tek elle seçip kırpmaya gerek kalmaz. Emin olamadığı soruları sarı işaretler, son kararı sen verirsin. Deneme başına maliyet yaklaşık 3–4 sent.</p>
    </details>
  )
}

export default function AiMark({ data, update, exam, pages }) {
  const [from, setFrom] = useState(() => Math.max(1, (pages.findIndex(p => p.anchors.length) + 1) || 1))
  const [to, setTo] = useState(pages.length)
  const [progress, setProgress] = useState(null)
  const [review, setReview] = useState(null)
  const [msg, setMsg] = useState('')
  const canvases = useRef(new Map())
  const cached = exam.ai || {}
  const hasKey = (exam.answerKey || []).some(t => cleanKey(t.cevaplar).length)

  if (!aiEnabled) return null

  const run = async () => {
    setMsg('')
    const idxs = []
    for (let i = from - 1; i <= to - 1; i++) idxs.push(i)
    const results = { ...cached }
    let done = 0, tokIn = 0, tokOut = 0
    const warnings = []
    setProgress({ done, total: idxs.length })
    const queue = [...idxs]
    const worker = async () => {
      while (queue.length) {
        const i = queue.shift()
        const { canvas } = await renderPage(pages[i])
        canvases.current.set(i, canvas)
        if (!results[i]) {
          try {
            const r = await analyzePage(await compress(canvas, 2000, 0.85))
            results[i] = { test: r.test, sorular: r.sorular }
            if (r.tokens) { tokIn += r.tokens.in || 0; tokOut += r.tokens.out || 0 }
            r.uyarilar.forEach(w => warnings.push(`Sayfa ${i + 1}: ${w}`))
          } catch (e) {
            console.error(e)
            warnings.push(`Sayfa ${i + 1} okunamadı: ${e?.message || e}`)
          }
        }
        setProgress({ done: ++done, total: idxs.length })
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker))
    // Okunan sonuçları kaydet: aynı sayfa için tekrar ödeme yapılmasın.
    update(d => { d.exams.find(x => x.id === exam.id).ai = results; return d })
    setProgress(null)
    const cost = (tokIn * 0.25 + tokOut * 1.5) / 1e6
    setMsg([tokIn ? `Bu okuma ≈ ${cost.toFixed(3)} $ (${tokIn} + ${tokOut} token)` : 'Kayıtlı sonuçlar kullanıldı', ...warnings].join('\n'))
    const inRange = {}
    idxs.forEach(i => { if (results[i]) inRange[i] = results[i] })
    setReview(inRange)
  }

  return (
    <Card>
      <div className="stack-sm">
        <div className="row gap" style={{ justifyContent: 'space-between' }}>
          <h2>🤖 Yanlışları otomatik bul</h2>
          <small className="muted">Gemini yapay zekâ</small>
        </div>
        <AiExplain />
        <AnswerKey exam={exam} update={update} />
        <div className="row gap wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <b>2. Kitapçığı oku</b>
          <div className="row gap wrap" style={{ alignItems: 'center' }}>
            <span className="muted">Sayfa</span>
            <input type="number" min="1" max={pages.length} value={from} onChange={e => setFrom(Math.max(1, Math.min(+e.target.value || 1, to)))} style={{ width: 70 }} />
            <span className="muted">–</span>
            <input type="number" min={from} max={pages.length} value={to} onChange={e => setTo(Math.max(from, Math.min(+e.target.value || from, pages.length)))} style={{ width: 70 }} />
            <button className="btn primary" disabled={!hasKey || !!progress} onClick={run}>{progress ? `Okunuyor ${progress.done}/${progress.total}` : 'Otomatik bul'}</button>
          </div>
        </div>
        {!hasKey && <small className="muted">Önce cevap anahtarını gir. Kapak sayfasını aralığa katma (ad/numara gönderilmesin).</small>}
        {progress && <div className="progress"><span style={{ width: (progress.done / progress.total) * 100 + '%' }} /></div>}
        {msg && <pre className="ai-msg">{msg}</pre>}
        {Object.keys(cached).length > 0 && !progress && <small className="muted">{Object.keys(cached).length} sayfanın sonucu kayıtlı; tekrar okutmak ücret doğurmaz.</small>}
      </div>
      {review && (
        <Review
          data={data}
          update={update}
          exam={exam}
          pages={pages}
          results={review}
          canvases={canvases.current}
          onClose={n => { setReview(null); if (n) setMsg(m => `${n} soru hata defterine eklendi ✓\n${m}`) }}
        />
      )}
    </Card>
  )
}
