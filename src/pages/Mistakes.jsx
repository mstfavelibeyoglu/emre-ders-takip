import { useMemo, useState } from 'react'
import { repeatCount, fmtDate, today, uid } from '../lib/calc'
import { TOPIC_SUGGESTIONS } from '../lib/defaults'
import { Card, Empty, Badge, Modal } from '../components/ui'

export function MistakeForm({ data, update, exam, editing, onClose }) {
  const { settings } = data
  const blank = () => ({
    date: exam?.date || today(),
    examId: exam?.id || '',
    examName: exam?.name || '',
    subjectId: editing?.subjectId || settings.subjects[0].id,
    topic: '', qNo: '', kind: 'Yanlış', reason: '', reviewed: false, note: ''
  })
  const [f, setF] = useState(() => (editing ? { ...editing } : blank()))
  const [added, setAdded] = useState(0)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const suggestions = useMemo(() => {
    const own = data.mistakes.filter(m => m.subjectId === f.subjectId).map(m => m.topic)
    return [...new Set([...own, ...(TOPIC_SUGGESTIONS[f.subjectId] || [])])].filter(Boolean)
  }, [data.mistakes, f.subjectId])

  const count = repeatCount(data.mistakes.filter(m => m.id !== editing?.id), f) + (f.topic ? 1 : 0)

  const save = (e, again) => {
    e?.preventDefault()
    if (!f.topic.trim()) return
    const rec = { ...f, topic: f.topic.trim(), id: editing?.id || uid(), createdAt: editing?.createdAt || Date.now() }
    update(d => {
      const i = d.mistakes.findIndex(x => x.id === rec.id)
      if (i >= 0) d.mistakes[i] = rec
      else d.mistakes.push(rec)
      return d
    })
    if (again) {
      setAdded(n => n + 1)
      setF(p => ({ ...blank(), subjectId: p.subjectId, reason: p.reason }))
    } else onClose()
  }

  return (
    <Modal title={editing ? 'Hatayı düzenle' : exam ? `${exam.name}: yanlış / boş ekle` : 'Hata ekle'} onClose={onClose}>
      <form onSubmit={e => save(e, false)} className="stack-sm">
        {added > 0 && <div className="ok">✓ {added} kayıt eklendi. Sıradakini gir.</div>}
        <div className="seg">
          {settings.subjects.map(s => (
            <button type="button" key={s.id} className={f.subjectId === s.id ? 'on' : ''} style={{ '--c': s.color }} onClick={() => set('subjectId', s.id)}>
              {s.name.replace('Türk Dili ve Edebiyatı', 'Edebiyat').replace('Din Kültürü', 'Din')}
            </button>
          ))}
        </div>
        <label>
          Konu
          <input list="topic-suggest" value={f.topic} onChange={e => set('topic', e.target.value)} placeholder="ör. Kümeler" required autoFocus />
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
        <div>
          <div className="label">Hata nedeni</div>
          <div className="pills">
            {settings.errorReasons.map(r => (
              <button type="button" key={r} className={'pill ' + (f.reason === r ? 'on' : '')} onClick={() => set('reason', f.reason === r ? '' : r)}>{r}</button>
            ))}
          </div>
        </div>
        <label>Not<input value={f.note} onChange={e => set('note', e.target.value)} placeholder="ör. Birleşim–kesişim karıştı" /></label>
        <label className="check"><input type="checkbox" checked={f.reviewed} onChange={e => set('reviewed', e.target.checked)} /> Konuyu tekrar çalıştım</label>
        <div className="row gap end">
          {!editing && <button type="button" className="btn" onClick={e => save(e, true)} disabled={!f.topic.trim()}>Kaydet + yenisi</button>}
          <button className="btn primary" disabled={!f.topic.trim()}>Kaydet</button>
        </div>
      </form>
    </Modal>
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
      .filter(m => state === 'all' || (state === 'open' ? !m.reviewed : m.reviewed))
      .filter(m => !ql || [m.topic, m.note, m.examName, m.reason].join(' ').toLocaleLowerCase('tr').includes(ql))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt)
  }, [data.mistakes, sub, state, q])

  const toggle = m => update(d => { const x = d.mistakes.find(y => y.id === m.id); x.reviewed = !x.reviewed; return d })
  const remove = m => confirm('Bu kayıt silinsin mi?') && update(d => { d.mistakes = d.mistakes.filter(x => x.id !== m.id); return d })

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
            <option value="open">Çalışılmadı</option>
            <option value="done">Çalışıldı</option>
          </select>
          <button className="btn primary" onClick={() => openForm({})}>+ Hata ekle</button>
        </div>
        <p className="note">Aynı konuda 2. hata <Badge tone="yellow">sarı</Badge>, 3. ve sonrası <Badge tone="red">kırmızı</Badge> işaretlenir.</p>
      </Card>

      {!list.length ? (
        <Empty icon="📒" title={data.mistakes.length ? 'Filtreye uyan kayıt yok' : 'Hata defteri boş'}>
          {!data.mistakes.length && <p>Denemeden sonra yanlış ve boş bıraktığın soruları konu adıyla yaz. Hangi konuyu tekrar etmen gerektiğini uygulama hesaplar.</p>}
        </Empty>
      ) : (
        <div className="mistake-list">
          {list.map(m => {
            const s = subOf(m.subjectId)
            const n = repeatCount(data.mistakes, m)
            return (
              <div key={m.id} className={'mistake ' + (n >= 3 ? 'red' : n === 2 ? 'yellow' : '') + (m.reviewed ? ' done' : '')}>
                <button className="tick" onClick={() => toggle(m)} title={m.reviewed ? 'Çalışıldı' : 'Çalışıldı olarak işaretle'} aria-label="Tekrar durumu">{m.reviewed ? '✓' : ''}</button>
                <div className="m-body" onClick={() => openForm({ editing: m })}>
                  <div className="m-top">
                    <b>{m.topic}</b>
                    {n >= 2 && <Badge tone={n >= 3 ? 'red' : 'yellow'}>{n}×</Badge>}
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
