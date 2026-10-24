// Hesaplamalar Excel formülleriyle birebir aynıdır:
// net = D − Y / yanlışKatsayısı ; başarı % = net ÷ soru (soru sayısı denemeye göre değişebildiği için).

export const isNum = v => typeof v === 'number' && Number.isFinite(v)

export function subjectResult(exam, subject, penalty) {
  const r = exam.results?.[subject.id]
  if (!r || (!isNum(r.d) && !isNum(r.y))) return null
  const d = isNum(r.d) ? r.d : 0
  const y = isNum(r.y) ? r.y : 0
  const q = isNum(r.q) && r.q > 0 ? r.q : subject.questions
  const net = d - (penalty > 0 ? y / penalty : 0)
  return { d, y, q, blank: Math.max(0, q - d - y), net, rate: q > 0 ? net / q : null, overflow: d + y > q }
}

export function examSummary(exam, settings) {
  const per = {}
  let d = 0, y = 0, q = 0, net = 0, any = false
  for (const s of settings.subjects) {
    const r = subjectResult(exam, s, settings.wrongPenalty)
    per[s.id] = r
    if (r) { any = true; d += r.d; y += r.y; q += r.q; net += r.net }
  }
  if (!any) return { per, empty: true }
  return { per, d, y, q, blank: q - d - y, net, rate: q > 0 ? net / q : null, tyt: tytEstimate(per, settings) }
}

// Her ders bir TYT testine sayılır; testteki başarı % × TYT soru sayısı = tahmini test neti.
export function tytEstimate(per, settings) {
  const tests = {}
  for (const t of Object.keys(settings.tyt.tests)) {
    let net = 0, q = 0
    for (const s of settings.subjects) {
      const r = per[s.id]
      if (s.tyt === t && r) { net += r.net; q += r.q }
    }
    tests[t] = q > 0 ? (net / q) * settings.tyt.tests[t].questions : null
  }
  const complete = Object.values(tests).every(isNum)
  const score = complete
    ? settings.tyt.base + Object.entries(tests).reduce((a, [t, n]) => a + n * settings.tyt.tests[t].coef, 0)
    : null
  return { tests, score }
}

export const sortExams = exams => [...exams].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt)

export function analyze(data) {
  const { settings } = data
  const exams = sortExams(data.exams).map(e => ({ ...e, sum: examSummary(e, settings) })).filter(e => !e.sum.empty)

  const subjects = settings.subjects.map(s => {
    const rs = exams.map(e => e.sum.per[s.id]).filter(Boolean)
    const n = rs.length
    const avg = k => (n ? rs.reduce((a, r) => a + r[k], 0) / n : null)
    const totalNet = rs.reduce((a, r) => a + r.net, 0)
    const totalQ = rs.reduce((a, r) => a + r.q, 0)
    const last = n ? rs[n - 1] : null
    const rate = totalQ > 0 ? totalNet / totalQ : null
    return {
      ...s,
      count: n,
      avgQ: avg('q'), avgD: avg('d'), avgY: avg('y'), avgBlank: avg('blank'), avgNet: avg('net'),
      maxNet: n ? Math.max(...rs.map(r => r.net)) : null,
      lastNet: last?.net ?? null,
      rate,
      gap: last ? Math.max(0, s.target - last.net) : null,
      status: rate == null ? null : rate >= 0.75 ? 'Güçlü' : rate >= 0.5 ? 'Orta' : 'Geliştirilmeli',
      mistakes: data.mistakes.filter(m => m.subjectId === s.id).length
    }
  })

  const rated = subjects.filter(s => s.rate != null)
  const strongest = rated.length ? rated.reduce((a, b) => (b.rate > a.rate ? b : a)) : null
  const weakest = rated.length ? rated.reduce((a, b) => (b.rate < a.rate ? b : a)) : null

  const totalNet = exams.reduce((a, e) => a + e.sum.net, 0)
  const totalQ = exams.reduce((a, e) => a + e.sum.q, 0)
  const last = exams[exams.length - 1]
  const first = exams[0]
  const scores = exams.map(e => e.sum.tyt.score).filter(isNum)

  return {
    exams,
    subjects,
    strongest,
    weakest,
    overallRate: totalQ > 0 ? totalNet / totalQ : null,
    last,
    progress: exams.length >= 2 ? last.sum.rate - first.sum.rate : null,
    avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    lastScore: last?.sum.tyt.score ?? null
  }
}

// Hata defterindeki konuları gruplar; tekrar önceliği = çalışılmamış hata sayısı ağırlıklı.
export function topicStats(data) {
  const map = new Map()
  for (const m of data.mistakes) {
    if (!m.topic) continue
    const key = m.subjectId + '|' + m.topic.trim().toLocaleLowerCase('tr')
    let t = map.get(key)
    if (!t) {
      t = { key, subjectId: m.subjectId, topic: m.topic.trim(), total: 0, open: 0, lastDate: '', reasons: {}, ids: [] }
      map.set(key, t)
    }
    t.total++
    t.ids.push(m.id)
    if (!m.reviewed) t.open++
    if ((m.date || '') > t.lastDate) t.lastDate = m.date || ''
    if (m.reason) t.reasons[m.reason] = (t.reasons[m.reason] || 0) + 1
  }
  const list = [...map.values()]
  for (const t of list) {
    t.level = t.total >= 3 ? 'red' : t.total === 2 ? 'yellow' : 'none'
    t.priority = t.open * 2 + t.total + (t.reasons['Konuyu bilmiyorum'] || 0) + (t.reasons['Kavram yanılgısı'] || 0)
  }
  return list.sort((a, b) => b.priority - a.priority || b.lastDate.localeCompare(a.lastDate))
}

export function repeatCount(mistakes, m) {
  const k = (m.topic || '').trim().toLocaleLowerCase('tr')
  if (!k) return 0
  return mistakes.filter(x => x.subjectId === m.subjectId && (x.topic || '').trim().toLocaleLowerCase('tr') === k).length
}

export const fmt = (v, d = 1) => (isNum(v) ? v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—')
export const pct = v => (isNum(v) ? '%' + (v * 100).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) : '—')
export const fmtDate = s => (s ? new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
