import { useMemo, useState } from 'react'
import { topicStats, fmtDate } from '../lib/calc'
import { dueList, applyReview, upcoming, boxOf, isMastered, INTERVALS, MASTERED } from '../lib/srs'
import { Card, Empty, Badge } from '../components/ui'
import QImage from '../components/QImage'
import { CHOICES } from './Mistakes'

function Session({ data, update, queue, onEnd }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState('')
  const [result, setResult] = useState(null) // null | true | false
  const [revealed, setRevealed] = useState(false)
  const [stats, setStats] = useState({ ok: 0, bad: 0 })
  const m = queue[i]
  const s = data.settings.subjects.find(x => x.id === m?.subjectId)

  if (!m) {
    return (
      <Card className="session">
        <Empty icon="🎉" title="Bugünkü tekrar bitti!">
          <p>{stats.ok} doğru · {stats.bad} tekrar edilecek</p>
          <button className="btn primary" onClick={onEnd}>Tamam</button>
        </Empty>
      </Card>
    )
  }

  const finish = solved => {
    setResult(solved)
    setStats(x => ({ ok: x.ok + (solved ? 1 : 0), bad: x.bad + (solved ? 0 : 1) }))
    update(d => { applyReview(d.mistakes.find(x => x.id === m.id), solved); return d })
  }
  const choose = c => {
    if (result != null) return
    setPicked(c)
    finish(c === m.answer)
  }
  const next = () => { setI(x => x + 1); setPicked(''); setResult(null); setRevealed(false) }
  const nextBox = result ? boxOf(m) + 1 : 0
  const nextText = result && nextBox >= MASTERED ? 'Bu soruyu öğrendin, artık sorulmayacak 🎓' : `Bir sonraki tekrar: ${INTERVALS[nextBox]} gün sonra`

  return (
    <Card className="session">
      <div className="session-top">
        <span className="muted">{i + 1} / {queue.length}</span>
        <div className="progress"><span style={{ width: (i / queue.length) * 100 + '%' }} /></div>
        <button className="link" onClick={onEnd}>Bitir</button>
      </div>
      <div className="m-meta" style={{ marginBottom: 8 }}>
        <span className="dot" style={{ background: s?.color }} />{s?.name}
        {m.topic && <> · {m.topic}</>}
        {m.examName && <> · {m.examName}{m.qNo ? ` S${m.qNo}` : ''}</>}
        <> · Kutu {boxOf(m) + 1}/{MASTERED}</>
      </div>

      {m.imageIds?.length ? (
        <div className="session-imgs">{m.imageIds.map(id => <QImage key={id} id={id} className="session-img" />)}</div>
      ) : (
        <div className="session-text">
          <b>{m.topic || 'Konu yazılmamış'}</b>
          <p className="muted">Bu kayıtta soru görseli yok. Konuyu tekrar et, sonra kendini değerlendir.</p>
        </div>
      )}

      {m.answer ? (
        <div className="choices big">
          {CHOICES.map(c => (
            <button
              key={c}
              className={'choice ' + (result != null && c === m.answer ? 'on ok' : '') + (result === false && c === picked ? ' on bad' : '')}
              onClick={() => choose(c)}
              disabled={result != null}
            >
              {c}
            </button>
          ))}
        </div>
      ) : result == null ? (
        !revealed ? (
          <div className="row gap center"><button className="btn primary" onClick={() => setRevealed(true)}>Çözdüm, kontrol et</button></div>
        ) : (
          <div className="stack-sm">
            <p className="muted" style={{ textAlign: 'center', margin: 0 }}>Bu soruya doğru cevap girilmemiş, kendini değerlendir:</p>
            <div className="row gap center">
              <button className="btn" onClick={() => finish(false)}>❌ Yapamadım</button>
              <button className="btn primary" onClick={() => finish(true)}>✅ Doğru çözdüm</button>
            </div>
          </div>
        )
      ) : null}

      {result != null && (
        <div className={'verdict ' + (result ? 'good' : 'bad')}>
          <b>{result ? 'Doğru! 👏' : m.answer ? `Yanlış. Doğru cevap ${m.answer}` : 'Tekrar edeceğiz'}</b>
          <div>{result ? nextText : 'Yarın tekrar sorulacak.'}</div>
          {(m.note || m.reason) && <div className="muted">İlk seferki not: {m.reason}{m.reason && m.note ? ' · ' : ''}{m.note}</div>}
          <button className="btn primary" onClick={next}>Sonraki →</button>
        </div>
      )}
    </Card>
  )
}

export default function Review({ data, update, go }) {
  const [showDone, setShowDone] = useState(false)
  const [session, setSession] = useState(null)
  const all = useMemo(() => topicStats(data), [data])
  const due = useMemo(() => dueList(data.mistakes), [data.mistakes])
  const week = useMemo(() => upcoming(data.mistakes, 7), [data.mistakes])
  const mastered = data.mistakes.filter(isMastered).length
  const list = all.filter(t => showDone || t.open > 0)
  const subOf = id => data.settings.subjects.find(s => s.id === id)
  const markReviewed = t => update(d => { d.mistakes.forEach(m => { if (t.ids.includes(m.id)) m.reviewed = true }); return d })

  if (session) return <Session data={data} update={update} queue={session} onEnd={() => setSession(null)} />

  if (!data.mistakes.length) {
    return (
      <Empty icon="🔁" title="Tekrar listesi boş">
        <p>Bir denemenin kitapçığını yükleyip yanlış yaptığın soruları seçtiğinde, zamanı gelince burada tekrar sorulur.</p>
        <button className="btn primary" onClick={() => go('exams')}>Denemelere git</button>
      </Empty>
    )
  }

  const maxDay = Math.max(1, ...week.map(w => w.count))
  return (
    <div className="stack">
      <Card className="today">
        <div className="today-main">
          <div>
            <div className="today-count">{due.length}</div>
            <div>{due.length ? 'soru bugün tekrar bekliyor' : 'Bugün tekrar edilecek soru yok 🎉'}</div>
            <small className="muted">{mastered} soru öğrenildi · toplam {data.mistakes.length} kayıt</small>
          </div>
          {due.length > 0 && <button className="btn primary big-btn" onClick={() => setSession(due)}>Tekrara başla →</button>}
        </div>
        <div className="week">
          {week.map((w, i) => (
            <div key={w.date} className="week-day" title={`${fmtDate(w.date)}: ${w.count} soru`}>
              <div className="week-bar"><span style={{ height: (w.count / maxDay) * 100 + '%' }} /></div>
              <b>{w.count}</b>
              <small>{i === 0 ? 'Bugün' : new Date(w.date + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'short' })}</small>
            </div>
          ))}
        </div>
        <p className="note">Doğru çözdükçe soru {INTERVALS.join(' → ')} gün sonra tekrar gelir; yapamazsan ertesi güne döner. 5 kez üst üste doğru çözülen soru "öğrenildi" sayılır.</p>
      </Card>

      {all.length > 0 && (
        <Card
          title="Konu önceliği"
          action={<label className="check small"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Tamamlananları göster</label>}
        >
          <p className="note" style={{ marginTop: 0 }}>Öncelik puanı = çalışılmamış hata × 2 + toplam hata + "konuyu bilmiyorum / kavram yanılgısı" sayısı.</p>
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
                    {t.open > 0 ? <button className="btn small" onClick={() => markReviewed(t)}>Çalıştım ✓</button> : <span className="muted">✓</span>}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="muted">Bekleyen konu yok.</p>
          )}
        </Card>
      )}
    </div>
  )
}
