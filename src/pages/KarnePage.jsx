import { useMemo } from 'react'
import { examReport } from '../lib/report'
import { sortExams } from '../lib/calc'
import Karne from '../components/Karne'
import { Empty } from '../components/ui'

export default function KarnePage({ data, examId, go, openExam, onEdit, onMistakes }) {
  const sorted = useMemo(() => sortExams(data.exams), [data.exams])
  const i = sorted.findIndex(e => e.id === examId)
  const exam = sorted[i]
  const rep = useMemo(() => (exam ? examReport(data, exam) : null), [data, exam])

  if (!exam) {
    return (
      <Empty icon="🔎" title="Deneme bulunamadı">
        <button className="btn" onClick={() => go('exams')}>Denemelere dön</button>
      </Empty>
    )
  }

  return (
    <div className="stack">
      <div className="row gap wrap no-print">
        <button className="btn small" disabled={i <= 0} onClick={() => openExam(sorted[i - 1].id)}>← Önceki</button>
        <select value={exam.id} onChange={e => openExam(e.target.value)} aria-label="Deneme seç" style={{ width: 'auto', flex: 1, minWidth: 160 }}>
          {sorted.map((e, j) => <option key={e.id} value={e.id}>{j + 1}. {e.name}</option>)}
        </select>
        <button className="btn small" disabled={i >= sorted.length - 1} onClick={() => openExam(sorted[i + 1].id)}>Sonraki →</button>
      </div>
      <Karne
        rep={rep}
        studentName={data.settings.studentName}
        actions={
          <span className="row gap no-print">
            <button className="band-btn" onClick={() => onMistakes(exam)}>+ Yanlış</button>
            <button className="band-btn" onClick={() => onEdit(exam)}>Düzenle</button>
            <button className="band-btn" onClick={() => window.print()}>Yazdır / PDF</button>
          </span>
        }
      />
    </div>
  )
}
