// Deneme formundaki isteğe bağlı karne alanları (kurumun verdiği karneden kopyalanır).
import { TOPIC_SUGGESTIONS } from '../lib/defaults'

const n = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))
const s = v => (v == null ? '' : String(v))

export function cleanReport(rep) {
  const num = v => (Number.isFinite(n(v)) ? n(v) : undefined)
  const out = {
    school: rep.school?.trim() || undefined,
    className: rep.className?.trim() || undefined,
    score: num(rep.score),
    avgs: Object.fromEntries(Object.entries(rep.avgs || {}).map(([k, v]) => [k, num(v)])),
    ranks: Object.fromEntries(Object.entries(rep.ranks || {}).map(([k, v]) => [k, { n: num(v?.n), rank: num(v?.rank) }])),
    subjects: Object.fromEntries(
      Object.entries(rep.subjects || {}).map(([k, v]) => [k, { ilRank: num(v?.ilRank), genelRank: num(v?.genelRank), turkiyeRate: num(v?.turkiyeRate) }])
    ),
    total: { ilRank: num(rep.total?.ilRank), genelRank: num(rep.total?.genelRank), turkiyeRate: num(rep.total?.turkiyeRate) },
    topics: (rep.topics || [])
      .filter(t => t.topic?.trim())
      .map(t => ({ subjectId: t.subjectId, topic: t.topic.trim(), q: num(t.q), rate: num(t.rate), general: num(t.general) }))
  }
  return JSON.parse(JSON.stringify(out))
}

export default function ReportFields({ settings, rep, setRep, activeSubjects }) {
  const set = (path, v) =>
    setRep(p => {
      const c = structuredClone(p)
      let o = c
      for (const k of path.slice(0, -1)) o = o[k] ??= {}
      o[path.at(-1)] = v
      return c
    })
  const topics = rep.topics || []
  const addTopic = () => setRep(p => ({ ...p, topics: [...(p.topics || []), { subjectId: activeSubjects[0]?.id || settings.subjects[0].id, topic: '', q: '', rate: '', general: '' }] }))
  const setTopic = (i, k, v) => setRep(p => ({ ...p, topics: p.topics.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }))
  const delTopic = i => setRep(p => ({ ...p, topics: p.topics.filter((_, j) => j !== i) }))
  const numIn = (path, ph) => {
    let v = rep
    for (const k of path) v = v?.[k]
    return <input key={path.join('.')} inputMode="decimal" value={s(v)} placeholder={ph} onChange={e => set(path, e.target.value)} />
  }

  return (
    <div className="stack-sm">
      <p className="note">Kurumun verdiği karnedeki bilgileri buraya girersen deneme karnesinde aynı şekilde görünür. Hepsi isteğe bağlı.</p>
      <div className="form-row">
        <label className="grow">Kurum / okul<input value={s(rep.school)} onChange={e => set(['school'], e.target.value)} placeholder="ör. Özel ... Koleji" /></label>
        <label>Sınıf / şube<input value={s(rep.className)} onChange={e => set(['className'], e.target.value)} placeholder="9C" /></label>
        <label>Resmî puan<input inputMode="decimal" value={s(rep.score)} onChange={e => set(['score'], e.target.value)} placeholder="ör. 293,97" /></label>
      </div>

      <div className="label">Ortalamalar (puan)</div>
      <div className="mini-grid four">
        {[['okul', 'Okul'], ['ilce', 'İlçe'], ['il', 'İl'], ['turkiye', 'Türkiye']].map(([k, l]) => (
          <label key={k}>{l}{numIn(['avgs', k])}</label>
        ))}
      </div>

      <div className="label">Katılım ve dereceler</div>
      <div className="mini-grid four">
        {[['okul', 'Okul'], ['ilce', 'İlçe'], ['il', 'İl'], ['genel', 'Genel']].map(([k, l]) => (
          <div key={k} className="pair">
            <span>{l}</span>
            {numIn(['ranks', k, 'n'], 'katılım')}
            {numIn(['ranks', k, 'rank'], 'derece')}
          </div>
        ))}
      </div>

      <div className="label">Ders sıraları ve Türkiye başarı yüzdesi</div>
      <div className="table-wrap">
        <table className="edit-table">
          <thead><tr><th>Ders</th><th>İl sırası</th><th>Genel sırası</th><th>Türkiye başarı %</th></tr></thead>
          <tbody>
            {activeSubjects.map(sub => (
              <tr key={sub.id}>
                <td>{sub.name}</td>
                <td>{numIn(['subjects', sub.id, 'ilRank'])}</td>
                <td>{numIn(['subjects', sub.id, 'genelRank'])}</td>
                <td>{numIn(['subjects', sub.id, 'turkiyeRate'])}</td>
              </tr>
            ))}
            <tr>
              <td><b>Toplam</b></td>
              <td>{numIn(['total', 'ilRank'])}</td>
              <td>{numIn(['total', 'genelRank'])}</td>
              <td>{numIn(['total', 'turkiyeRate'])}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="label">Konu analizi (karnedeki SS / Başarı % / Genel %)</div>
      {topics.length > 0 && (
        <div className="table-wrap">
          <table className="edit-table">
            <thead><tr><th>Ders</th><th>Konu</th><th>SS</th><th>Başarı %</th><th>Genel %</th><th /></tr></thead>
            <tbody>
              {topics.map((t, i) => (
                <tr key={i}>
                  <td>
                    <select value={t.subjectId} onChange={e => setTopic(i, 'subjectId', e.target.value)}>
                      {settings.subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input list={'ts-' + t.subjectId} value={s(t.topic)} onChange={e => setTopic(i, 'topic', e.target.value)} />
                    <datalist id={'ts-' + t.subjectId}>{(TOPIC_SUGGESTIONS[t.subjectId] || []).map(x => <option key={x} value={x} />)}</datalist>
                  </td>
                  <td><input inputMode="numeric" value={s(t.q)} onChange={e => setTopic(i, 'q', e.target.value)} /></td>
                  <td><input inputMode="decimal" value={s(t.rate)} onChange={e => setTopic(i, 'rate', e.target.value)} /></td>
                  <td><input inputMode="decimal" value={s(t.general)} onChange={e => setTopic(i, 'general', e.target.value)} /></td>
                  <td><button type="button" className="icon-btn" onClick={() => delTopic(i)} aria-label="Satırı sil">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div><button type="button" className="btn small" onClick={addTopic}>+ Konu satırı ekle</button></div>
    </div>
  )
}
