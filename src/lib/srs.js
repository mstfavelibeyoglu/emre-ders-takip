// Aralıklı tekrar (Leitner): doğru çözdükçe soru bir sonraki kutuya geçer ve daha seyrek gelir.
// Yapamazsa 1. kutuya döner. Son kutuyu da geçen soru "öğrenildi" sayılır.
import { today } from './calc'

export const INTERVALS = [1, 3, 7, 14, 30]
export const MASTERED = INTERVALS.length

export const addDays = (date, n) => {
  const d = new Date((date || today()) + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const boxOf = m => (Number.isInteger(m.box) ? m.box : 0)
export const dueOf = m => m.due || addDays(m.date, INTERVALS[0])
export const isMastered = m => boxOf(m) >= MASTERED
export const isDue = (m, on = today()) => !isMastered(m) && dueOf(m) <= on

export function dueList(mistakes, on = today()) {
  return mistakes.filter(m => isDue(m, on)).sort((a, b) => dueOf(a).localeCompare(dueOf(b)) || (b.imageIds?.length || 0) - (a.imageIds?.length || 0))
}

// Tekrar sonucu kaydı; m yerinde güncellenir.
export function applyReview(m, solved, on = today()) {
  const box = solved ? boxOf(m) + 1 : 0
  m.box = box
  m.due = box >= MASTERED ? null : addDays(on, INTERVALS[box])
  m.lastReview = on
  m.history = [...(m.history || []), { date: on, solved }]
  if (box >= MASTERED) m.reviewed = true
  return m
}

export function upcoming(mistakes, days = 7) {
  const t = today()
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(t, i)
    return { date: d, count: mistakes.filter(m => !isMastered(m) && (i === 0 ? dueOf(m) <= d : dueOf(m) === d)).length }
  })
}
