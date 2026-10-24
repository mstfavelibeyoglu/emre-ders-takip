import { Donut, ScoreRing, DYB_COLORS } from './Pie'
import { fmt, fmtDate, isNum } from '../lib/calc'

const RING_COLORS = ['#38bdf8', '#d6a77a', '#fbbf24', '#f472b6', '#4ade80']
const RANK_LABEL = { okul: 'Okul', ilce: 'İlçe', il: 'İl', genel: 'Genel' }
const p2 = v => (isNum(v) ? (v * 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—')
const p0 = v => (isNum(v) ? Math.round(v * 100) : '—')
const short = n => n.replace('Türk Dili ve Edebiyatı', 'Edebiyat').replace('Din Kültürü', 'Din Kül.')

function Delta({ now, before }) {
  if (!isNum(now) || !isNum(before)) return <span className="muted">-</span>
  const d = now - before
  return (
    <span className={d >= 0 ? 'pos' : 'neg'}>
      {fmt(before, 2)} <small>{d >= 0 ? '▲' : '▼'}{fmt(Math.abs(d), 2)}</small>
    </span>
  )
}

export default function Karne({ rep, studentName, actions }) {
  const overall = rep.kind === 'overall'
  const showIl = !overall && rep.rows.some(r => isNum(r.ilRank))
  const showGenel = !overall && rep.rows.some(r => isNum(r.genelRank))
  const showTr = !overall && rep.rows.some(r => isNum(r.turkiyeRate))
  const tot = rep.total

  const rings = overall
    ? [
        ['Son Puan', rep.score],
        ['Ortalama', rep.avgScore],
        ['En Yüksek', rep.maxScore],
        ['En Düşük', rep.minScore],
        ...rep.compare
      ]
    : [[rep.scoreIsEstimate ? 'Tahmini TYT' : 'Puan', rep.score], ...rep.compare]

  return (
    <article className="karne">
      <header className="karne-band">
        <span>{overall ? `GENEL ANALİZ KARNESİ · ${rep.count} DENEME` : 'DENEME KARNESİ'}</span>
        {actions}
      </header>
      <div className="karne-id">
        <div>
          <b>{overall ? studentName : rep.title}</b>
          <small>
            {overall
              ? `${fmtDate(rep.first?.date)} – ${fmtDate(rep.last?.date)}`
              : [fmtDate(rep.date), rep.school].filter(Boolean).join(' · ')}
          </small>
        </div>
        <div className="karne-class">{overall ? rep.count : rep.className || studentName}</div>
      </div>

      <div className="karne-top">
        <section className="karne-box">
          <h4>Puan Verileri</h4>
          <div className="rings">
            {rings.map(([label, v], i) => (
              <ScoreRing key={label} label={i === 0 ? `${label} (Maks: 500)` : label} value={v} color={RING_COLORS[i % RING_COLORS.length]} />
            ))}
          </div>
          {!overall && rep.scoreIsEstimate && <p className="note">Resmî puan girilmediği için tahmini TYT puanı gösteriliyor.</p>}
        </section>
        {!overall && rep.ranks.length > 0 && (
          <section className="karne-box">
            <h4>Katılım ve Dereceler</h4>
            <table className="mini">
              <thead><tr><th>Alan</th><th>Katılım</th><th>Derece</th></tr></thead>
              <tbody>
                {rep.ranks.map(([k, r]) => (
                  <tr key={k}><td>{RANK_LABEL[k]}</td><td>{r.n ?? '—'}</td><td><b>{r.rank ?? '—'}</b></td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {tot && (
          <section className="karne-box">
            <h4>{overall ? 'Ortalama Dağılım' : 'Soru Dağılımı'}</h4>
            <Donut
              size={150}
              thickness={24}
              center={fmt(tot.net, 2)}
              sub="net"
              legend
              parts={[
                { label: 'Doğru', value: tot.d, color: DYB_COLORS.d },
                { label: 'Yanlış', value: tot.y, color: DYB_COLORS.y },
                { label: 'Boş', value: tot.b, color: DYB_COLORS.b }
              ]}
            />
          </section>
        )}
      </div>

      <div className="table-wrap">
        <table className="karne-table">
          <thead>
            <tr>
              <th>Dersler</th>
              <th>Soru Sayısı</th>
              <th>Doğru</th>
              <th>Yanlış</th>
              <th>Boş</th>
              <th>Net</th>
              {showIl && <th>İl Sırası</th>}
              {showGenel && <th>Genel Sırası</th>}
              <th>Başarı Yüzdeniz</th>
              {showTr && <th>Türkiye Başarı %</th>}
              {overall ? <><th>İlk → Son Net</th><th>Hedef</th></> : <th>Önceki Sınav</th>}
            </tr>
          </thead>
          <tbody>
            {rep.rows.map(r => (
              <tr key={r.subject.id}>
                <td><span className="dot" style={{ background: r.subject.color }} />{r.subject.name}</td>
                <td>{fmt(r.q, overall ? 1 : 0)}</td>
                <td>{fmt(r.d, 2)}</td>
                <td>{fmt(r.y, 2)}</td>
                <td>{fmt(r.b, 2)}</td>
                <td><b>{fmt(r.net, 2)}</b></td>
                {showIl && <td>{r.ilRank ?? '—'}</td>}
                {showGenel && <td>{r.genelRank ?? '—'}</td>}
                <td className={isNum(r.turkiyeRate) && r.rate * 100 < r.turkiyeRate ? 'low' : ''}>{p2(r.rate)}</td>
                {showTr && <td>{isNum(r.turkiyeRate) ? fmt(r.turkiyeRate, 2) : '—'}</td>}
                {overall ? (
                  <>
                    <td><Delta now={r.lastNet} before={r.firstNet} /></td>
                    <td>{r.target}</td>
                  </>
                ) : (
                  <td><Delta now={r.net} before={r.prevNet} /></td>
                )}
              </tr>
            ))}
            {tot && (
              <tr className="total">
                <td>Toplam</td>
                <td>{fmt(tot.q, overall ? 1 : 0)}</td>
                <td>{fmt(tot.d, 2)}</td>
                <td>{fmt(tot.y, 2)}</td>
                <td>{fmt(tot.b, 2)}</td>
                <td>{fmt(tot.net, 2)}</td>
                {showIl && <td>{tot.ilRank ?? '—'}</td>}
                {showGenel && <td>{tot.genelRank ?? '—'}</td>}
                <td>{p2(tot.rate)}</td>
                {showTr && <td>{isNum(tot.turkiyeRate) ? fmt(tot.turkiyeRate, 2) : '—'}</td>}
                {overall ? <><td><Delta now={tot.lastNet} before={tot.firstNet} /></td><td /></> : <td><Delta now={tot.net} before={tot.prevNet} /></td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="karne-pies">
        {rep.rows.map(r => (
          <div key={r.subject.id} className="pie-cell">
            <Donut
              size={104}
              thickness={16}
              center={fmt(r.net, overall ? 1 : 2)}
              sub={'%' + p0(r.rate)}
              parts={[
                { label: 'Doğru', value: r.d, color: DYB_COLORS.d },
                { label: 'Yanlış', value: r.y, color: DYB_COLORS.y },
                { label: 'Boş', value: r.b, color: DYB_COLORS.b }
              ]}
            />
            <span>{short(r.subject.name)}</span>
          </div>
        ))}
        <div className="pie-key">
          <span><i style={{ background: DYB_COLORS.d }} />Doğru</span>
          <span><i style={{ background: DYB_COLORS.y }} />Yanlış</span>
          <span><i style={{ background: DYB_COLORS.b }} />Boş</span>
        </div>
      </section>

      <section className="karne-topics">
        {rep.topics.length ? (
          <div className="topic-cols">
            {rep.topics.map(g => (
              <table key={g.subject.id} className="topic-table">
                <thead>
                  <tr>
                    <th>{g.subject.name} Konu Analizi</th>
                    <th>SS</th>
                    <th>Başarı (%)</th>
                    <th>Genel (%)</th>
                    <th>Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(t => {
                    const weak = (isNum(t.rate) && (t.rate < 40 || (isNum(t.general) && t.rate < t.general))) || t.errors >= 3
                    return (
                      <tr key={t.topic} className={weak ? 'weak' : ''}>
                        <td>{t.topic.toLocaleUpperCase('tr')}</td>
                        <td>{t.q ?? ''}</td>
                        <td>{isNum(t.rate) ? Math.round(t.rate) : ''}</td>
                        <td>{isNum(t.general) ? Math.round(t.general) : ''}</td>
                        <td>{t.errors || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ))}
          </div>
        ) : (
          <p className="muted">
            Konu analizi için {overall ? 'denemelere' : 'bu denemeye'} karnedeki konu satırlarını gir (Düzenle → Karne bilgileri) ya da hata defterine yanlışlarını konu adıyla ekle.
          </p>
        )}
        <p className="note">Pembe satırlar: başarı %40'ın veya genel ortalamanın altında, ya da konuda 3+ hata var.</p>
      </section>
    </article>
  )
}
