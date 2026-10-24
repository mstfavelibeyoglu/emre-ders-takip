import { useMemo } from 'react'
import { examSummary, sortExams, fmt, pct, fmtDate, isNum } from '../lib/calc'
import { Card, Empty } from '../components/ui'

export default function Exams({ data, update, onEdit, onMistakes, go }) {
  const { settings } = data
  const exams = useMemo(() => sortExams(data.exams).reverse().map(e => ({ ...e, sum: examSummary(e, settings) })), [data])

  const remove = e => {
    if (!confirm(`"${e.name}" silinsin mi? (Bu denemeye bağlı hata kayıtları kalır.)`)) return
    update(d => { d.exams = d.exams.filter(x => x.id !== e.id); return d })
  }

  if (!exams.length) {
    return (
      <Empty icon="📝" title="Henüz deneme yok">
        <button className="btn primary" onClick={() => go('add')}>+ Deneme ekle</button>
      </Empty>
    )
  }

  return (
    <div className="stack">
      {exams.map((e, i) => {
        const prev = exams[i + 1]
        const diff = prev && isNum(e.sum.rate) && isNum(prev.sum.rate) ? e.sum.rate - prev.sum.rate : null
        const mCount = data.mistakes.filter(m => m.examId === e.id).length
        return (
          <Card key={e.id} className="exam-card">
            <div className="exam-top">
              <div>
                <h3>{e.name}</h3>
                <small className="muted">{fmtDate(e.date)}</small>
              </div>
              <div className="exam-kpis">
                <div><small>Net</small><b>{fmt(e.sum.net, 2)}</b></div>
                <div><small>Başarı</small><b>{pct(e.sum.rate)}</b></div>
                <div><small>TYT</small><b>{fmt(e.sum.tyt?.score, 0)}</b></div>
                {isNum(diff) && <div className={diff >= 0 ? 'up' : 'down'}><small>Değişim</small><b>{diff >= 0 ? '▲' : '▼'} {Math.abs(diff * 100).toFixed(1)}</b></div>}
              </div>
            </div>
            <div className="chips">
              {settings.subjects.map(s => {
                const r = e.sum.per[s.id]
                if (!r) return null
                return (
                  <span key={s.id} className="chip" style={{ '--c': s.color }} title={`${r.d} D · ${r.y} Y · ${r.blank} B`}>
                    {s.name.split(' ')[0]} <b>{fmt(r.net, 2)}</b>
                  </span>
                )
              })}
            </div>
            <div className="row gap wrap">
              <button className="btn small" onClick={() => onMistakes(e)}>Yanlışları gir {mCount ? `(${mCount})` : ''}</button>
              <button className="btn small ghost" onClick={() => onEdit(e)}>Düzenle</button>
              <button className="btn small ghost danger" onClick={() => remove(e)}>Sil</button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
