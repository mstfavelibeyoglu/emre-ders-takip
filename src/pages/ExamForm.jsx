import { useState } from 'react'
import { examSummary, fmt, pct, today, uid, isNum } from '../lib/calc'
import { Card } from '../components/ui'
import ReportFields, { cleanReport } from '../components/ReportFields'

const toNum = v => (v === '' || v == null ? null : Number(v))

export default function ExamForm({ data, update, editing, done }) {
  const { settings } = data
  const [date, setDate] = useState(editing?.date || today())
  const [name, setName] = useState(editing?.name || '')
  const [vals, setVals] = useState(() => {
    const v = {}
    for (const s of settings.subjects) {
      const r = editing?.results?.[s.id]
      v[s.id] = { d: r?.d ?? '', y: r?.y ?? '', q: r?.q ?? '' }
    }
    return v
  })
  const [error, setError] = useState('')
  const [rep, setRep] = useState(() => {
    const r = structuredClone(editing?.report || {})
    if (!r.rank && r.ranks?.genel) r.rank = r.ranks.genel
    return r
  })

  const results = {}
  for (const s of settings.subjects) {
    const v = vals[s.id]
    if (v.d !== '' || v.y !== '') results[s.id] = { d: toNum(v.d) ?? 0, y: toNum(v.y) ?? 0, q: toNum(v.q) }
  }
  const preview = examSummary({ results }, settings)
  const overflow = settings.subjects.filter(s => preview.per[s.id]?.overflow)

  const set = (id, k, v) => setVals(p => ({ ...p, [id]: { ...p[id], [k]: v } }))

  const save = e => {
    e.preventDefault()
    if (!Object.keys(results).length) return setError('En az bir dersin doğru/yanlış sayısını gir.')
    if (overflow.length) return setError(`${overflow.map(s => s.name).join(', ')}: doğru + yanlış soru sayısını geçiyor.`)
    const exam = { id: editing?.id || uid(), date, name: name.trim() || `Deneme ${data.exams.length + 1}`, results, report: cleanReport(rep), createdAt: editing?.createdAt || Date.now() }
    update(d => {
      const i = d.exams.findIndex(x => x.id === exam.id)
      if (i >= 0) d.exams[i] = exam
      else d.exams.push(exam)
      if (editing && editing.name !== exam.name) d.mistakes.forEach(m => { if (m.examId === exam.id) m.examName = exam.name })
      return d
    })
    done(exam)
  }

  return (
    <form onSubmit={save} className="stack">
      <Card title={editing ? 'Denemeyi düzenle' : 'Yeni deneme'}>
        <div className="form-row">
          <label>Tarih<input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>
          <label className="grow">Deneme / Yayın<input value={name} onChange={e => setName(e.target.value)} placeholder="ör. Okul Deneme 2" /></label>
        </div>
      </Card>

      <Card title="Dersler">
        <p className="note">Dersi o denemede yoksa boş bırak. Tümünü boş bıraktıysan D=0, Y=0 yaz. "Soru" alanını sadece soru sayısı farklıysa doldur.</p>
        <div className="subject-grid">
          {settings.subjects.map(s => {
            const r = preview.per[s.id]
            return (
              <div key={s.id} className={'subject-input ' + (r?.overflow ? 'bad' : '')} style={{ '--c': s.color }}>
                <div className="si-head">
                  <b>{s.name}</b>
                  <span className="muted">{r ? `Net ${fmt(r.net, 2)} · ${pct(r.rate)}` : `${s.questions} soru`}</span>
                </div>
                <div className="si-fields">
                  <label>Doğru<input type="number" inputMode="numeric" min="0" max="200" value={vals[s.id].d} onChange={e => set(s.id, 'd', e.target.value)} /></label>
                  <label>Yanlış<input type="number" inputMode="numeric" min="0" max="200" value={vals[s.id].y} onChange={e => set(s.id, 'y', e.target.value)} /></label>
                  <label>Soru<input type="number" inputMode="numeric" min="1" max="200" value={vals[s.id].q} placeholder={String(s.questions)} onChange={e => set(s.id, 'q', e.target.value)} /></label>
                </div>
                {r && <div className="si-bar"><span style={{ width: Math.max(0, r.rate * 100) + '%' }} /></div>}
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <details className="report-details" open={!!(editing?.report?.score || editing?.report?.rank) || undefined}>
          <summary><h2>Karne bilgileri <small className="muted">(isteğe bağlı)</small></h2></summary>
          <ReportFields settings={settings} rep={rep} setRep={setRep} activeSubjects={settings.subjects.filter(s => results[s.id])} />
        </details>
      </Card>

      <div className="sticky-summary">
        <div>
          <span className="muted">Toplam net</span> <b>{preview.empty ? '—' : fmt(preview.net, 2)}</b>
          <span className="muted"> · Başarı</span> <b>{preview.empty ? '—' : pct(preview.rate)}</b>
          <span className="muted"> · TYT</span> <b>{!preview.empty && isNum(preview.tyt.score) ? fmt(preview.tyt.score, 0) : '—'}</b>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="row gap">
          <button type="button" className="btn" onClick={() => done(null)}>Vazgeç</button>
          <button className="btn primary">Kaydet</button>
        </div>
      </div>
    </form>
  )
}
