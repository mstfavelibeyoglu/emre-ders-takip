import * as XLSX from 'xlsx'
import { examSummary, sortExams, uid, isNum } from './calc'
import { emptyData } from './defaults'

const num = v => (v === '' || v == null ? null : Number.isFinite(+v) ? +v : null)
const toDate = v => {
  if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : ''
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  if (typeof v === 'string' && /^\d{1,2}[./]\d{1,2}[./]\d{4}$/.test(v.trim())) {
    const [g, a, y] = v.trim().split(/[./]/)
    return `${y}-${a.padStart(2, '0')}-${g.padStart(2, '0')}`
  }
  return ''
}
const isSample = s => /örnek yayın|silebilirsin/i.test(String(s || ''))

// "Deneme_Takip_9_Sinif.xlsx" şablonunu okur (Ayarlar, Deneme Girişi, Konu Takibi).
export async function importTemplate(file, current) {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  const cell = (sheet, ref) => wb.Sheets[sheet]?.[ref]?.v
  if (!wb.Sheets['Deneme Girişi'] || !wb.Sheets['Ayarlar']) {
    throw new Error('Bu dosya Deneme Takip şablonu değil ("Deneme Girişi" ve "Ayarlar" sayfaları bulunamadı).')
  }

  const data = emptyData()
  const s = data.settings
  s.studentName = current.settings.studentName
  s.subjects = s.subjects.map((sub, i) => {
    const row = 4 + i
    return {
      ...sub,
      name: String(cell('Ayarlar', 'A' + row) ?? sub.name),
      questions: num(cell('Ayarlar', 'B' + row)) ?? sub.questions,
      target: num(cell('Ayarlar', 'C' + row)) ?? sub.target,
      tyt: String(cell('Ayarlar', 'B' + (21 + i)) ?? sub.tyt)
    }
  })
  const pen = num(cell('Ayarlar', 'B16'))
  if (pen != null) s.wrongPenalty = pen
  const reasons = []
  for (let r = 4; r <= 20; r++) { const v = cell('Ayarlar', 'E' + r); if (v && r < 19) reasons.push(String(v)) }
  if (reasons.length) s.errorReasons = reasons
  for (let i = 0; i < 4; i++) {
    const name = cell('Ayarlar', 'E' + (21 + i))
    if (name && s.tyt.tests[name]) {
      s.tyt.tests[name] = { questions: num(cell('Ayarlar', 'F' + (21 + i))) ?? s.tyt.tests[name].questions, coef: num(cell('Ayarlar', 'G' + (21 + i))) ?? s.tyt.tests[name].coef }
    }
  }
  s.tyt.base = num(cell('Ayarlar', 'F25')) ?? s.tyt.base

  // Deneme Girişi: her ders 4 sütun (D, Y, Soru, Net), D sütunundan başlar.
  const ws = wb.Sheets['Deneme Girişi']
  const range = XLSX.utils.decode_range(ws['!ref'])
  let skipped = 0
  for (let r = 4; r <= range.e.r; r++) {
    const v = c => ws[XLSX.utils.encode_cell({ r, c })]?.v
    const name = v(2)
    const results = {}
    let has = false
    s.subjects.forEach((sub, i) => {
      const c0 = 3 + i * 4
      const d = num(v(c0)), y = num(v(c0 + 1)), q = num(v(c0 + 2))
      if (d != null || y != null) { has = true; results[sub.id] = { d, y, q } }
    })
    if (!has) continue
    if (isSample(name)) { skipped++; continue }
    data.exams.push({ id: uid(), date: toDate(v(1)), name: String(name || 'Deneme'), results, createdAt: Date.now() + r })
  }

  const kt = wb.Sheets['Konu Takibi']
  if (kt) {
    const kr = XLSX.utils.decode_range(kt['!ref'])
    for (let r = 3; r <= kr.e.r; r++) {
      const v = c => kt[XLSX.utils.encode_cell({ r, c })]?.v
      const subName = v(2), topic = v(3)
      if (!subName && !topic) continue
      if (isSample(v(1))) { skipped++; continue }
      const sub = s.subjects.find(x => x.name === String(subName).trim())
      data.mistakes.push({
        id: uid(),
        date: toDate(v(0)),
        examName: v(1) ? String(v(1)) : '',
        subjectId: sub?.id || s.subjects[0].id,
        topic: topic ? String(topic) : '',
        qNo: v(4) != null ? String(v(4)) : '',
        kind: v(5) === 'Boş' ? 'Boş' : 'Yanlış',
        reason: v(6) ? String(v(6)) : '',
        reviewed: v(7) === 'Evet',
        note: v(8) ? String(v(8)) : '',
        createdAt: Date.now() + r
      })
    }
  }
  return { data, skipped }
}

export function exportExcel(data) {
  const { settings } = data
  const wb = XLSX.utils.book_new()

  const head = ['Tarih', 'Deneme']
  settings.subjects.forEach(s => head.push(`${s.name} D`, `${s.name} Y`, `${s.name} Soru`, `${s.name} Net`))
  head.push('Toplam D', 'Toplam Y', 'Toplam Soru', 'Boş', 'Toplam Net', 'Başarı %', 'Tahmini TYT')
  const rows = sortExams(data.exams).map(e => {
    const sum = examSummary(e, settings)
    const row = [e.date, e.name]
    settings.subjects.forEach(s => {
      const r = sum.per[s.id]
      row.push(r?.d ?? '', r?.y ?? '', r?.q ?? '', r ? +r.net.toFixed(2) : '')
    })
    if (sum.empty) return row
    row.push(sum.d, sum.y, sum.q, sum.blank, +sum.net.toFixed(2), isNum(sum.rate) ? +(sum.rate * 100).toFixed(1) : '', isNum(sum.tyt.score) ? +sum.tyt.score.toFixed(1) : '')
    return row
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows]), 'Denemeler')

  const subName = id => settings.subjects.find(s => s.id === id)?.name || ''
  const mh = ['Tarih', 'Deneme', 'Ders', 'Konu', 'Soru No', 'Yanlış / Boş', 'Hata Nedeni', 'Tekrar Çalışıldı mı?', 'Not']
  const mr = data.mistakes.map(m => [m.date, m.examName, subName(m.subjectId), m.topic, m.qNo, m.kind, m.reason, m.reviewed ? 'Evet' : 'Hayır', m.note])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([mh, ...mr]), 'Hata Defteri')

  const sh = [['Ders', 'Soru Sayısı', 'Hedef Net', 'TYT Testi'], ...settings.subjects.map(s => [s.name, s.questions, s.target, s.tyt]), [], ['Yanlış katsayısı', settings.wrongPenalty]]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh), 'Ayarlar')

  XLSX.writeFile(wb, `Ders_Takip_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function downloadJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ders-takip-yedek-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
