import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { topicStats } from './lib/calc'
import Dashboard from './pages/Dashboard'
import ExamForm from './pages/ExamForm'
import Exams from './pages/Exams'
import Mistakes, { MistakeForm } from './pages/Mistakes'
import Review from './pages/Review'
import Settings from './pages/Settings'

const TABS = [
  { id: 'dashboard', label: 'Analiz', icon: '📊' },
  { id: 'exams', label: 'Denemeler', icon: '📝' },
  { id: 'add', label: 'Ekle', icon: '＋', primary: true },
  { id: 'mistakes', label: 'Hata Defteri', icon: '📒' },
  { id: 'review', label: 'Tekrar', icon: '🔁' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️' }
]

const readHash = () => {
  const h = location.hash.replace('#/', '').replace('#', '')
  return TABS.some(t => t.id === h) ? h : 'dashboard'
}

export default function App() {
  const [data, update, replace] = useStore()
  const [tab, setTab] = useState(readHash)
  const [editingExam, setEditingExam] = useState(null)
  const [mistakeForm, setMistakeForm] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const on = () => setTab(readHash())
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

  const openCount = topicStats(data).reduce((a, t) => a + (t.open > 0 ? 1 : 0), 0)
  const current = TABS.find(t => t.id === tab)

  const examDone = exam => {
    const wasEdit = !!editingExam
    if (!exam) return go(wasEdit ? 'exams' : 'dashboard')
    go(wasEdit ? 'exams' : 'dashboard')
    setToast(wasEdit ? 'Deneme güncellendi' : 'Deneme kaydedildi 🎯')
    if (!wasEdit) setMistakeForm({ exam })
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="./icon.svg" alt="" width="32" height="32" />
          <div>
            <b>Ders Takip</b>
            <small>{data.settings.studentName}</small>
          </div>
        </div>
        <nav>
          {TABS.map(t => (
            <button key={t.id} className={'nav-item ' + (tab === t.id ? 'on' : '') + (t.primary ? ' primary' : '')} onClick={() => go(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span>{t.id === 'add' ? 'Deneme ekle' : t.label}</span>
              {t.id === 'review' && openCount > 0 && <span className="count">{openCount}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <h1>{tab === 'add' ? (editingExam ? 'Denemeyi düzenle' : 'Deneme ekle') : current.label}</h1>
          {tab === 'dashboard' && <button className="btn primary hide-mobile" onClick={() => go('add')}>+ Deneme ekle</button>}
        </header>

        {tab === 'dashboard' && <Dashboard data={data} go={go} />}
        {tab === 'add' && <ExamForm key={editingExam?.id || 'new'} data={data} update={update} editing={editingExam} done={examDone} />}
        {tab === 'exams' && (
          <Exams
            data={data}
            update={update}
            go={go}
            onEdit={e => { setEditingExam(e); location.hash = '#/add'; setTab('add') }}
            onMistakes={e => setMistakeForm({ exam: e })}
          />
        )}
        {tab === 'mistakes' && <Mistakes data={data} update={update} openForm={setMistakeForm} />}
        {tab === 'review' && <Review data={data} update={update} />}
        {tab === 'settings' && <Settings data={data} update={update} replace={replace} />}
      </main>

      <nav className="bottom-nav">
        {TABS.map(t => (
          <button key={t.id} className={(tab === t.id ? 'on' : '') + (t.primary ? ' primary' : '')} onClick={() => go(t.id)} aria-label={t.label}>
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
