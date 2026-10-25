import { useMemo, useRef, useState } from 'react'
import { repeatCount, fmtDate, today, uid } from '../lib/calc'
import { TOPIC_SUGGESTIONS } from '../lib/defaults'
import { putImage, deleteImages, getImage, rotateBlob } from '../lib/images'
import { boxOf, dueOf, isMastered, MASTERED } from '../lib/srs'
import { Card, Empty, Badge, Modal } from '../components/ui'
import Cropper, { hasLastPdf, lastPdfName } from '../components/Cropper'
import QImage from '../components/QImage'

export const CHOICES = ['A', 'B', 'C', 'D', 'E']

export function MistakeForm({ data, update, exam, editing, initial, onClose, onSaved }) {
  const { settings } = data
  const blank = () => ({
    date: exam?.date || today(),
    examId: exam?.id || '',
    examName: exam?.name || '',
    subjectId: editing?.subjectId || settings.subjects[0].id,
    topic: '', qNo: '', kind: 'Yanlış', reason: '', reviewed: false, note: '', answer: '', given: '',
    imageIds: [],
    ...initial
  })
  const [f, setF] = useState(() => (editing ? { imageIds: [], answer: '', given: '', ...editing } : blank()))
  // Görseller sırayla: kayıtlı olanlar { id }, yeni ya da döndürülmüş olanlar { blob }
  const [items, setItems] = useState(() => [...(editing?.imageIds || []).map(id => ({ id })), ...(initial?.blobs || []).map(blob => ({ blob }))])
  const [rotating, setRotating] = useState(-1)
  const [crop, setCrop] = useState(null)
  const [added, setAdded] = useState(0)
  const camRef = useRef(null)
  const fileRef = useRef(null)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const suggestions = useMemo(() => {
    const own = data.mistakes.filter(m => m.subjectId === f.subjectId).map(m => m.topic)
    return [...new Set([...own, ...(TOPIC_SUGGESTIONS[f.subjectId] || [])])].filter(Boolean)
  }, [data.mistakes, f.subjectId])

  const count = repeatCount(data.mistakes.filter(m => m.id !== editing?.id), f) + (f.topic ? 1 : 0)
  const hasContent = f.topic.trim() || items.length

  const save = async (e, again) => {
    e?.preventDefault()
    if (!hasContent) return
    const ids = []
    for (const it of items) {
      if (it.id) { ids.push(it.id); continue }
      const id = 'q-' + uid()
      await putImage(id, it.blob)
      ids.push(id)
    }
    const removed = (editing?.imageIds || []).filter(id => !ids.includes(id))
    if (removed.length) await deleteImages(removed)
    const { blobs: _, ...rest } = f
    const rec = { ...rest, topic: f.topic.trim(), imageIds: ids, id: editing?.id || uid(), createdAt: editing?.createdAt || Date.now() }
    update(d => {
      const i = d.mistakes.findIndex(x => x.id === rec.id)
      if (i >= 0) d.mistakes[i] = rec
      else d.mistakes.push(rec)
      return d
    })
    onSaved?.(rec)
    if (again) {
      setAdded(n => n + 1)
      setItems([])
      setF(p => ({ ...blank(), subjectId: p.subjectId, reason: p.reason }))
    } else onClose()
  }

  const rotate = async i => {
    setRotating(i)
    try {
      const it = items[i]
      const src = it.blob || (await getImage(it.id))
      if (!src) return
      const blob = await rotateBlob(src)
      setItems(xs => xs.map((x, j) => (j === i ? { blob } : x)))
    } finally {
      setRotating(-1)
    }
  }

  const pick = (e, reuse) => {
    if (reuse) return setCrop({ reusePdf: true })
    const file = e.target.files[0]
    e.target.value = ''
    if (file) setCrop({ file })
  }

  return (
    <>
      <Modal title={editing ? 'Hatayı düzenle' : exam ? `${exam.name}: yanlış / boş ekle` : 'Hata ekle'} onClose={onClose}>
        <form onSubmit={e => save(e, false)} className="stack-sm">
          {added > 0 && <div className="ok">✓ {added} kayıt eklendi. Sıradakini gir.</div>}

          <div>
            <div className="label">Soru görseli</div>
            <div className="thumbs">
              {items.map((it, i) => (
                <div key={it.id || i} className="thumb">
                  {it.id ? <QImage id={it.id} /> : <QImage blob={it.blob} />}
                  <button type="button" className="thumb-x" onClick={() => setItems(xs => xs.filter((_, j) => j !== i))} aria-label="Görseli kaldır">✕</button>
                  <button type="button" className="thumb-rot" disabled={rotating === i} onClick={() => rotate(i)} aria-label="Görseli döndür" title="90° döndür">⟳</button>
                </div>
              ))}
            </div>
            <div className="row gap wrap">
              <button type="button" className="btn small" onClick={() => camRef.current.click()}>📷 Fotoğraf çek</button>
              <button type="button" className="btn small" onClick={() => fileRef.current.click()}>🖼️ Görsel / PDF seç</button>
              {hasLastPdf() && <button type="button" className="btn small" onClick={e => pick(e, true)} title={lastPdfName()}>📄 Son PDF'ten</button>}
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
          </div>

          <div className="seg">
            {settings.subjects.map(s => (
              <button type="button" key={s.id} className={f.subjectId === s.id ? 'on' : ''} style={{ '--c': s.color }} onClick={() => set('subjectId', s.id)}>
                {s.name.replace('Türk Dili ve Edebiyatı', 'Edebiyat').replace('Din Kültürü', 'Din')}
              </button>
            ))}
          </div>
          <label>
            Konu
            <input list="topic-suggest" value={f.topic} onChange={e => set('topic', e.target.value)} placeholder="ör. Kümeler (sonra da yazabilirsin)" />
            <datalist id="topic-suggest">{suggestions.map(t => <option key={t} value={t} />)}</datalist>
          </label>
          {f.topic && count >= 2 && (
            <div className={count >= 3 ? 'warnbox red' : 'warnbox'}>
              Bu konuda {count}. hatan. {count >= 3 ? 'Öncelikli tekrar listesine girdi.' : 'Dikkat, tekrar ediyor.'}
            </div>
          )}
          <div className="form-row">
            <label>Soru no<input value={f.qNo} onChange={e => set('qNo', e.target.value)} inputMode="numeric" /></label>
            <label>
              Durum
              <select value={f.kind} onChange={e => set('kind', e.target.value)}>
                <option>Yanlış</option>
                <option>Boş</option>
              </select>
            </label>
            <label>Tarih<input type="date" value={f.date} onChange={e => set('date', e.target.value)} /></label>
          </div>
          <div className="form-row">
            <div>
              <div className="label">Doğru cevap</div>
              <div className="choices">
                {CHOICES.map(c => <button type="button" key={c} className={'choice ' + (f.answer === c ? 'on ok' : '')} onClick={() => set('answer', f.answer === c ? '' : c)}>{c}</button>)}
              </div>
            </div>
            {f.kind === 'Yanlış' && (
              <div>
                <div className="label">Benim cevabım</div>
                <div className="choices">
                  {CHOICES.map(c => <button type="button" key={c} className={'choice ' + (f.given === c ? 'on bad' : '')} onClick={() => set('given', f.given === c ? '' : c)}>{c}</button>)}
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="label">Hata nedeni</div>
            <div className="pills">
              {settings.errorReasons.map(r => (
                <button type="button" key={r} className={'pill ' + (f.reason === r ? 'on' : '')} onClick={() => set('reason', f.reason === r ? '' : r)}>{r}</button>
              ))}
            </div>
          </div>
          <label>Not<input value={f.note} onChange={e => set('note', e.target.value)} placeholder="ör. Birleşim–kesişim karıştı" /></label>
          <div className="row gap end">
            {!editing && !initial && <button type="button" className="btn" onClick={e => save(e, true)} disabled={!hasContent}>Kaydet + yenisi</button>}
            <button className="btn primary" disabled={!hasContent}>Kaydet</button>
          </div>
        </form>
      </Modal>
      {crop && <Cropper source={crop} onClose={() => setCrop(null)} onDone={b => { setItems(xs => [...xs, { blob: b }]); setCrop(null) }} />}
    </>
  )
}

export default function Mistakes({ data, update, openForm }) {
  const { settings } = data
  const [sub, setSub] = useState('all')
  const [state, setState] = useState('all')
  const [q, setQ] = useState('')
  const subOf = id => settings.subjects.find(s => s.id === id)

  const list = useMemo(() => {
    const ql = q.trim().toLocaleLowerCase('tr')
    return [...data.mistakes]
      .filter(m => sub === 'all' || m.subjectId === sub)
      .filter(m => state === 'all' || (state === 'open' ? !m.reviewed : state === 'img' ? m.imageIds?.length : m.reviewed))
      .filter(m => !ql || [m.topic, m.note, m.examName, m.reason, m.qNo].join(' ').toLocaleLowerCase('tr').includes(ql))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt)
  }, [data.mistakes, sub, state, q])

  const toggle = m => update(d => { const x = d.mistakes.find(y => y.id === m.id); x.reviewed = !x.reviewed; return d })
  const remove = m => {
    if (!confirm('Bu kayıt silinsin mi?')) return
    if (m.imageIds?.length) deleteImages(m.imageIds)
    update(d => { d.mistakes = d.mistakes.filter(x => x.id !== m.id); return d })
  }

  return (
    <div className="stack">
      <Card>
        <div className="filters">
          <input type="search" placeholder="Konu, not, deneme ara…" value={q} onChange={e => setQ(e.target.value)} />
          <select value={sub} onChange={e => setSub(e.target.value)} aria-label="Ders">
            <option value="all">Tüm dersler</option>
            {settings.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={state} onChange={e => setState(e.target.value)} aria-label="Durum">
            <option value="all">Hepsi</option>
            <option value="img">Görselli</option>
            <option value="open">Çalışılmadı</option>
            <option value="done">Çalışıldı</option>
          </select>
          <button className="btn primary" onClick={() => openForm({})}>+ Hata ekle</button>
        </div>
        <p className="note">Aynı konuda 2. hata <Badge tone="yellow">sarı</Badge>, 3. ve sonrası <Badge tone="red">kırmızı</Badge> işaretlenir.</p>
      </Card>

      {!list.length ? (
        <Empty icon="📒" title={data.mistakes.length ? 'Filtreye uyan kayıt yok' : 'Hata defteri boş'}>
          {!data.mistakes.length && <p>Denemeden sonra yanlış ve boş bıraktığın soruları fotoğrafıyla ya da konu adıyla kaydet. Zamanı gelince uygulama sana tekrar sorar.</p>}
        </Empty>
      ) : (
        <div className="mistake-list">
          {list.map(m => {
            const s = subOf(m.subjectId)
            const n = repeatCount(data.mistakes, m)
            return (
              <div key={m.id} className={'mistake ' + (n >= 3 ? 'red' : n === 2 ? 'yellow' : '') + (m.reviewed ? ' done' : '')}>
                <button className="tick" onClick={() => toggle(m)} title={m.reviewed ? 'Çalışıldı' : 'Çalışıldı olarak işaretle'} aria-label="Tekrar durumu">{m.reviewed ? '✓' : ''}</button>
                {m.imageIds?.[0] && <QImage id={m.imageIds[0]} className="m-thumb" onClick={() => openForm({ editing: m })} />}
                <div className="m-body" onClick={() => openForm({ editing: m })}>
                  <div className="m-top">
                    <b>{m.topic || (m.qNo ? `Soru ${m.qNo}` : 'Konusuz soru')}</b>
                    {n >= 2 && <Badge tone={n >= 3 ? 'red' : 'yellow'}>{n}×</Badge>}
                    {isMastered(m) ? <Badge tone="green">Öğrenildi</Badge> : <Badge tone="blue">Kutu {boxOf(m) + 1}/{MASTERED} · {fmtDate(dueOf(m))}</Badge>}
                  </div>
                  <div className="m-meta">
                    <span className="dot" style={{ background: s?.color }} />{s?.name} · {m.kind}{m.qNo ? ` · S${m.qNo}` : ''} · {fmtDate(m.date)}
                    {m.examName && <> · {m.examName}</>}
                  </div>
                  {(m.reason || m.note) && <div className="m-note">{m.reason && <Badge>{m.reason}</Badge>} {m.note}</div>}
                </div>
                <button className="icon-btn" onClick={() => remove(m)} aria-label="Sil">🗑</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
