import { useMemo, useState } from 'react'
import { topicStats, fmtDate } from '../lib/calc'
import { Card, Empty, Badge } from '../components/ui'

export default function Review({ data, update }) {
  const [showDone, setShowDone] = useState(false)
  const all = useMemo(() => topicStats(data), [data])
  const list = all.filter(t => showDone || t.open > 0)
  const subOf = id => data.settings.subjects.find(s => s.id === id)

  const markReviewed = t => update(d => { d.mistakes.forEach(m => { if (t.ids.includes(m.id)) m.reviewed = true }); return d })

  const bySubject = data.settings.subjects
    .map(s => ({ s, open: all.filter(t => t.subjectId === s.id).reduce((a, t) => a + t.open, 0) }))
    .filter(x => x.open > 0)
    .sort((a, b) => b.open - a.open)

  if (!all.length) {
    return (
      <Empty icon="🔁" title="Tekrar listesi boş">
        <p>Hata defterine konu adıyla kayıt ekledikçe, en çok hata yaptığın ve henüz çalışmadığın konular burada sıralanır.</p>
      </Empty>
    )
  }

  return (
    <div className="stack">
      {bySubject.length > 0 && (
        <Card title="Bekleyen tekrarlar">
          <div className="chips">
            {bySubject.map(({ s, open }) => (
              <span key={s.id} className="chip" style={{ '--c': s.color }}>{s.name} <b>{open}</b></span>
            ))}
          </div>
        </Card>
      )}
      <Card
        title="Öncelik sırası"
        action={<label className="check small"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Tamamlananları göster</label>}
      >
        <p className="note">Öncelik puanı = çalışılmamış hata × 2 + toplam hata + "konuyu bilmiyorum / kavram yanılgısı" sayısı.</p>
        {list.length ? (
          <ol className="review-list">
            {list.map((t, i) => {
              const s = subOf(t.subjectId)
              const top = Object.entries(t.reasons).sort((a, b) => b[1] - a[1])[0]
              return (
                <li key={t.key} className={t.open ? '' : 'done'}>
                  <span className="rank">{i + 1}</span>
                  <div className="grow">
                    <div className="m-top">
                      <b>{t.topic}</b>
                      <Badge tone={t.level === 'red' ? 'red' : t.level === 'yellow' ? 'yellow' : 'gray'}>{t.total} hata</Badge>
                      {t.open > 0 && <Badge tone="blue">{t.open} bekliyor</Badge>}
                    </div>
                    <div className="m-meta">
                      <span className="dot" style={{ background: s?.color }} />{s?.name} · son: {fmtDate(t.lastDate)}
                      {top && <> · en sık neden: {top[0]}</>}
                    </div>
                  </div>
                  {t.open > 0 ? (
                    <button className="btn small primary" onClick={() => markReviewed(t)}>Çalıştım ✓</button>
                  ) : (
                    <span className="muted">✓</span>
                  )}
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="muted">Bekleyen tekrar yok. Harika! 🎉</p>
        )}
      </Card>
    </div>
  )
}
