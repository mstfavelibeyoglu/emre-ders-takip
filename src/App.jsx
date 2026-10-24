import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import Dashboard from './pages/Dashboard'
import ExamForm from './pages/ExamForm'
import Exams from './pages/Exams'
import Mistakes, { MistakeForm } from './pages/Mistakes'
import Review from './pages/Review'
import Settings from './pages/Settings'
import KarnePage from './pages/KarnePage'
import MarkPage from './pages/MarkPage'
import { dueList } from './lib/srs'

const TABS = [
  { id: 'dashboard', label: 'Analiz', icon: '📊' },
  { id: 'exams', label: 'Denemeler', icon: '📝' },
  { id: 'add', label: 'Ekle', icon: '＋', primary: true },
  { id: 'mistakes', label: 'Hata Defteri', icon: '📒' },
  { id: 'review', label: 'Tekrar', icon: '🔁' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️' }
]

const readHash = () => {
  const [h] = location.hash.replace(/^#\/?/, '').split('/')
  return h === 'karne' || h === 'mark' || TABS.some(t => t.id === h) ? h : 'dashboard'
}
const readId = () => location.hash.replace(/^#\/?/, '').split('/')[1] || ''

export default function App({ user }) {
  const [data, update, replace] = useStore()
  const [tab, setTab] = useState(readHash)
  const [karneId, setKarneId] = useState(readId)
  const [editingExam, setEditingExam] = useState(null)
  const [mistakeForm, setMistakeForm] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const on = () => { setTab(readHash()); setKarneId(readId()) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const go = id => {
    setEditingExam(null)
    location.hash = '#/' + id
    setTab(id)
    window.scrollTo({ top: 0 })
  }

  const openExam = id => {
    setEditingExam(null)
    location.hash = '#/karne/' + id
    setTab('karne')
    setKarneId(id)
    window.scrollTo({ top: 0 })
  }
  const markExam = id => {
    setEditingExam(null)
    location.hash = '#/mark/' + id
    setTab('mark')
    setKarneId(id)
    window.scrollTo({ top: 0 })
  }
  const editExam = e => { setEditingExam(e); location.hash = '#/add'; setTab('add') }

  const openCount = dueList(data.mistakes).length
  const current = TABS.find(t => t.id === tab) || { label: tab === 'mark' ? 'Yanlışları seç' : 'Deneme Karnesi' }

  const examDone = exam => {
    const wasEdit = !!editingExam
    if (!exam) return wasEdit ? openExam(editingExam.id) : go('dashboard')
    if (wasEdit) openExam(exam.id)
    else markExam(exam.id)
    setToast(wasEdit ? 'Deneme güncellendi' : 'Deneme kaydedildi 🎯 Şimdi yanlışlarını seç')
  }

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <div className="brand">
          <img src="./icon.svg" alt="" width="32" height="32" />
          <div>
            <b>Ders Takip</b>
            <small>{user?.email || data.settings.studentName}</small>
          </div>
        </div>
        <nav>
          {TABS.map(t => (
            <button key={t.id} className={'nav-item ' + (tab === t.id || ((tab === 'karne' || tab === 'mark') && t.id === 'exams') ? 'on' : '') + (t.primary ? ' primary' : '')} onClick={() => go(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span>{t.id === 'add' ? 'Deneme ekle' : t.label}</span>
              {t.id === 'review' && openCount > 0 && <span className="count">{openCount}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar no-print">
          <h1>{tab === 'add' ? (editingExam ? 'Denemeyi düzenle' : 'Deneme ekle') : current.label}</h1>
          {tab === 'dashboard' && <button className="btn primary hide-mobile" onClick={() => go('add')}>+ Deneme ekle</button>}
        </header>

        {tab === 'dashboard' && <Dashboard data={data} go={go} openExam={openExam} />}
        {tab === 'add' && <ExamForm key={editingExam?.id || 'new'} data={data} update={update} editing={editingExam} done={examDone} />}
        {tab === 'exams' && (
          <Exams
            data={data}
            update={update}
            go={go}
            onEdit={editExam}
            onOpen={openExam}
            onMistakes={e => markExam(e.id)}
          />
        )}
        {tab === 'mark' && <MarkPage data={data} update={update} examId={karneId} openExam={openExam} />}
        {tab === 'karne' && <KarnePage data={data} examId={karneId} go={go} openExam={openExam} onEdit={editExam} onMistakes={e => markExam(e.id)} />}
        {tab === 'mistakes' && <Mistakes data={data} update={update} openForm={setMistakeForm} />}
        {tab === 'review' && <Review data={data} update={update} go={go} />}
        {tab === 'settings' && <Settings data={data} update={update} replace={replace} user={user} />}
      </main>

      <nav className="bottom-nav no-print">
        {TABS.map(t => (
          <button key={t.id} className={(tab === t.id || ((tab === 'karne' || tab === 'mark') && t.id === 'exams') ? 'on' : '') + (t.primary ? ' primary' : '')} onClick={() => go(t.id)} aria-label={t.label}>
            <span className="nav-icon">{t.icon}</span>
            {!t.primary && <small>{t.label.split(' ')[0]}</small>}
            {t.id === 'review' && openCount > 0 && <span className="count">{openCount}</span>}
          </button>
        ))}
      </nav>

      {mistakeForm && <MistakeForm data={data} update={update} {...mistakeForm} onClose={() => setMistakeForm(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
