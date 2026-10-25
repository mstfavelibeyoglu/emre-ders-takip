import { useMemo, useState } from 'react'
import { topicStats, fmt, pct, isNum } from '../lib/calc'
import { Card, Empty, Badge } from '../components/ui'
import Karne from '../components/Karne'
import { overallReport } from '../lib/report'
import ChartBox from '../components/Chart'

const statusTone = { 'Güçlü': 'green', 'Orta': 'yellow', 'Geliştirilmeli': 'red' }

export default function Dashboard({ data, go, openExam }) {
  const overall = useMemo(() => overallReport(data), [data])
  const a = overall.analysis
  const topics = useMemo(() => topicStats(data).filter(t => t.open > 0).slice(0, 5), [data])
  const [focus, setFocus] = useState('all')
  const subName = id => data.settings.subjects.find(s => s.id === id)?.name

  if (!a.exams.length) {
    return (
      <Empty icon="📊" title={`Hoş geldin ${data.settings.studentName}!`}>
        <p>İlk denemeni girince analizler burada görünecek.</p>
        <div className="row center gap">
          <button className="btn primary" onClick={() => go('add')}>+ İlk denemeyi ekle</button>
          <button className="btn" onClick={() => go('settings')}>Excel'den içe aktar</button>
        </div>
      </Empty>
    )
  }

  const labels = a.exams.map((e, i) => e.name.length > 14 ? `#${i + 1}` : e.name)
  const focusSub = data.settings.subjects.find(s => s.id === focus)
  const trend = focusSub
    ? [
        { label: `${focusSub.name} başarı %`, data: a.exams.map(e => (e.sum.per[focusSub.id] ? +(e.sum.per[focusSub.id].rate * 100).toFixed(1) : null)), borderColor: focusSub.color, backgroundColor: focusSub.color + '33', fill: true, tension: 0.3, spanGaps: true },
        { label: 'Genel başarı %', data: a.exams.map(e => +(e.sum.rate * 100).toFixed(1)), borderColor: '#94a3b8', borderDash: [6, 4], tension: 0.3 }
      ]
    : [{ label: 'Genel başarı %', data: a.exams.map(e => +(e.sum.rate * 100).toFixed(1)), borderColor: '#4f46e5', backgroundColor: '#4f46e533', fill: true, tension: 0.3 }]

  const withData = a.subjects.filter(s => s.count)
  const reasonCounts = data.settings.errorReasons.map(r => data.mistakes.filter(m => m.reason === r).length)
  const lastTyt = a.last.sum.tyt

  return (
    <div className="stack">
      <Karne
        rep={overall}
        studentName={data.settings.studentName}
        actions={
          <span className="row gap no-print">
            <button className="band-btn" onClick={() => openExam(a.last.id)}>Son deneme karnesi</button>
          </span>
        }
      />

      <div className="grid-2">
        <Card
          title="Başarı trendi"
          action={
            <select value={focus} onChange={e => setFocus(e.target.value)} aria-label="Ders seç">
              <option value="all">Tüm dersler</option>
              {data.settings.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          }
        >
          <ChartBox type="line" data={{ labels, datasets: trend }} options={{ scales: { y: { min: 0, max: 100, ticks: { callback: v => '%' + v } } }, plugins: { legend: { position: 'bottom' } } }} />
        </Card>

        <Card title="Ders bazında başarı ve hedef">
          <ChartBox
            type="bar"
            data={{
              labels: withData.map(s => s.name.replace('Türk Dili ve Edebiyatı', 'Edebiyat').replace('Din Kültürü', 'Din')),
              datasets: [
                { label: 'Son net', data: withData.map(s => +s.lastNet.toFixed(2)), backgroundColor: withData.map(s => s.color), borderRadius: 6 },
                { label: 'Hedef net', data: withData.map(s => s.target), backgroundColor: '#94a3b855', borderColor: '#94a3b8', borderWidth: 1, borderRadius: 6 }
              ]
            }}
            options={{ plugins: { legend: { position: 'bottom' } } }}
          />
        </Card>
      </div>

      <Card title="Ders tablosu">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Ders</th><th>Deneme</th><th>Ort. D/Y/B</th><th>Ort. net</th><th>En yüksek</th><th>Son net</th><th>Hedef</th><th>Kalan</th><th>Başarı</th><th>Durum</th><th>Hata</th></tr>
            </thead>
            <tbody>
              {a.subjects.map(s => (
                <tr key={s.id}>
                  <td><span className="dot" style={{ background: s.color }} />{s.name}</td>
                  <td>{s.count || '—'}</td>
                  <td className="muted">{s.count ? `${fmt(s.avgD)} / ${fmt(s.avgY)} / ${fmt(s.avgBlank)}` : '—'}</td>
                  <td>{fmt(s.avgNet, 2)}</td>
                  <td>{fmt(s.maxNet, 2)}</td>
                  <td><b>{fmt(s.lastNet, 2)}</b></td>
                  <td>{s.target}</td>
                  <td>{isNum(s.gap) ? (s.gap === 0 ? '✓' : fmt(s.gap, 2)) : '—'}</td>
                  <td>
                    <div className="meter"><span style={{ width: Math.max(0, (s.rate || 0) * 100) + '%', background: s.color }} /></div>
                    <small>{pct(s.rate)}</small>
                  </td>
                  <td>{s.status ? <Badge tone={statusTone[s.status]}>{s.status}</Badge> : '—'}</td>
                  <td>{s.mistakes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Başarı % = toplam net ÷ çözülen soru. Soru sayısı denemeden denemeye değişse de karşılaştırma adil olur.</p>
      </Card>

      <div className="grid-2">
        <Card title="Tahmini TYT (son deneme)">
          <div className="tyt">
            {Object.entries(lastTyt.tests).map(([t, n]) => (
              <div key={t} className="tyt-row">
                <span>{t}</span>
                <div className="meter"><span style={{ width: isNum(n) ? Math.max(0, n / data.settings.tyt.tests[t].questions) * 100 + '%' : 0 }} /></div>
                <b>{isNum(n) ? fmt(n, 1) : '—'}</b>
                <small className="muted">/ {data.settings.tyt.tests[t].questions}</small>
              </div>
            ))}
            <div className="tyt-score">
              <span>Tahmini puan</span>
              <b>{fmt(lastTyt.score, 1)}</b>
            </div>
          </div>
          <p className="note">Kaba bir tahmindir. 9. sınıf konuları TYT'nin sadece bir kısmını kapsar, ÖSYM puanı ise her yıl tüm adayların sonuçlarına göre hesaplanır.</p>
        </Card>

        <Card title="Hata nedenleri" action={<button className="link" onClick={() => go('mistakes')}>Hata defteri →</button>}>
          {data.mistakes.length ? (
            <ChartBox
              type="doughnut"
              height={240}
              data={{ labels: data.settings.errorReasons, datasets: [{ data: reasonCounts, backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#64748b'] }] }}
              options={{ plugins: { legend: { position: 'right' } }, cutout: '60%' }}
            />
          ) : (
            <p className="muted">Hata defterine kayıt ekledikçe burada neden dağılımı görünecek.</p>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Hataların derslere dağılımı">
          {data.mistakes.length ? (
            <ChartBox
              type="pie"
              height={240}
              data={{
                labels: data.settings.subjects.map(s => s.name),
                datasets: [{ data: data.settings.subjects.map(s => data.mistakes.filter(m => m.subjectId === s.id).length), backgroundColor: data.settings.subjects.map(s => s.color), borderColor: 'transparent' }]
              }}
              options={{ plugins: { legend: { position: 'right' } } }}
            />
          ) : (
            <p className="muted">Hata defterine kayıt ekledikçe görünecek.</p>
          )}
        </Card>
        <Card title="Son denemede netin derslere dağılımı">
          <ChartBox
            type="pie"
            height={240}
            data={{
              labels: withData.map(s => s.name),
              datasets: [{ data: withData.map(s => Math.max(0, +(a.last.sum.per[s.id]?.net ?? 0).toFixed(2))), backgroundColor: withData.map(s => s.color), borderColor: 'transparent' }]
            }}
            options={{ plugins: { legend: { position: 'right' } } }}
          />
        </Card>
      </div>

      <Card title="Bu hafta önce bunları tekrar et" action={<button className="link" onClick={() => go('review')}>Tümü →</button>}>
        {topics.length ? (
          <ul className="topic-list">
            {topics.map(t => (
              <li key={t.key}>
                <span className={'lvl ' + t.level} />
                <div>
                  <b>{t.topic}</b>
                  <small className="muted"> · {subName(t.subjectId)}</small>
                </div>
                <Badge tone={t.level === 'red' ? 'red' : t.level === 'yellow' ? 'yellow' : 'gray'}>{t.total} hata</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Çalışılmamış konu yok. 🎉</p>
        )}
      </Card>
    </div>
  )
}
