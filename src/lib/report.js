// Karne verisi: tek deneme ya da tüm denemelerin ortalaması için aynı yapıyı üretir.
import { analyze, examSummary, sortExams, isNum } from './calc'

const norm = s => (s || '').trim().toLocaleLowerCase('tr')
// Tek sıralama: kaç kişi katıldı, kaçıncı olundu. Eski kayıtlarda "genel" derecesi kullanılır.
export function rankOf(exam) {
  const r = exam.report?.rank || exam.report?.ranks?.genel
  if (!r || !isNum(r.rank)) return null
  return { n: isNum(r.n) ? r.n : null, rank: r.rank, pct: isNum(r.n) && r.n > 0 ? r.rank / r.n : null }
}
const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

// Konu analizi: karneden girilen konu satırları (SS, başarı, genel) + hata defterindeki kayıtlar.
function topicRows(settings, entered, mistakes) {
  const bySub = {}
  for (const s of settings.subjects) bySub[s.id] = new Map()
  for (const t of entered) {
    const m = bySub[t.subjectId]
    if (!m || !t.topic) continue
    const k = norm(t.topic)
    const row = m.get(k) || { topic: t.topic.trim(), q: 0, rateSum: 0, rateW: 0, genSum: 0, genW: 0, errors: 0 }
    const q = isNum(t.q) && t.q > 0 ? t.q : 1
    if (isNum(t.q)) row.q += t.q
    if (isNum(t.rate)) { row.rateSum += t.rate * q; row.rateW += q }
    if (isNum(t.general)) { row.genSum += t.general * q; row.genW += q }
    m.set(k, row)
  }
  for (const x of mistakes) {
    const m = bySub[x.subjectId]
    if (!m || !x.topic) continue
    const k = norm(x.topic)
    const row = m.get(k) || { topic: x.topic.trim(), q: 0, rateSum: 0, rateW: 0, genSum: 0, genW: 0, errors: 0 }
    row.errors++
    m.set(k, row)
  }
  return settings.subjects
    .map(s => ({
      subject: s,
      rows: [...bySub[s.id].values()].map(r => ({
        topic: r.topic,
        q: r.q || null,
        rate: r.rateW ? r.rateSum / r.rateW : null,
        general: r.genW ? r.genSum / r.genW : null,
        errors: r.errors
      }))
    }))
    .filter(g => g.rows.length)
}

export function examReport(data, exam) {
  const { settings } = data
  const sorted = sortExams(data.exams)
  const idx = sorted.findIndex(e => e.id === exam.id)
  const prev = idx > 0 ? sorted[idx - 1] : null
  const sum = examSummary(exam, settings)
  const prevSum = prev ? examSummary(prev, settings) : null
  const rep = exam.report || {}

  const rows = settings.subjects
    .map(s => {
      const r = sum.per[s.id]
      if (!r) return null
      const p = prevSum?.per[s.id]
      return { subject: s, q: r.q, d: r.d, y: r.y, b: r.blank, net: r.net, rate: r.rate, prevNet: p ? p.net : null }
    })
    .filter(Boolean)

  const mistakes = data.mistakes.filter(m => m.examId === exam.id)
  return {
    kind: 'exam',
    title: exam.name,
    date: exam.date,
    school: rep.school,
    className: rep.className,
    score: isNum(rep.score) ? rep.score : sum.tyt?.score,
    scoreIsEstimate: !isNum(rep.score),
    rank: rankOf(exam),
    prevRank: prev ? rankOf(prev) : null,
    rows,
    total: sum.empty ? null : { q: sum.q, d: sum.d, y: sum.y, b: sum.blank, net: sum.net, rate: sum.rate, prevNet: prevSum && !prevSum.empty ? prevSum.net : null },
    topics: topicRows(settings, rep.topics || [], mistakes),
    mistakes
  }
}

export function overallReport(data) {
  const { settings } = data
  const a = analyze(data)
  const exams = a.exams
  const scores = exams.map(e => (isNum(e.report?.score) ? e.report.score : e.sum.tyt.score)).filter(isNum)
  const ranks = exams.map(e => ({ exam: e, ...rankOf(e) })).filter(r => isNum(r.rank))

  const rows = a.subjects
    .filter(s => s.count)
    .map(s => {
      const first = exams.find(e => e.sum.per[s.id])?.sum.per[s.id]
      return { subject: s, q: s.avgQ, d: s.avgD, y: s.avgY, b: s.avgBlank, net: s.avgNet, rate: s.rate, count: s.count, maxNet: s.maxNet, lastNet: s.lastNet, firstNet: first?.net ?? null, target: s.target }
    })
  const n = exams.length
  const tot = k => avg(exams.map(e => e.sum[k]))
  return {
    kind: 'overall',
    title: 'Genel Analiz Karnesi',
    count: n,
    first: exams[0],
    last: exams[n - 1],
    score: a.lastScore,
    avgScore: avg(scores),
    maxScore: scores.length ? Math.max(...scores) : null,
    minScore: scores.length ? Math.min(...scores) : null,
    ranks,
    rows,
    total: n ? { q: tot('q'), d: tot('d'), y: tot('y'), b: tot('blank'), net: tot('net'), rate: a.overallRate, firstNet: exams[0].sum.net, lastNet: exams[n - 1].sum.net } : null,
    topics: topicRows(settings, exams.flatMap(e => e.report?.topics || []), data.mistakes),
    analysis: a
  }
}
