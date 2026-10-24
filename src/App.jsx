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
import { app, firebaseEnabled } from './lib/firebase'
import { useCloudStore } from './lib/cloud'
import { enableCloudFiles, uploadAllLocal } from './lib/images'
import { RoleContext, canEditRole } from './lib/role'
import { STUDENT_ID } from './config'

const MIGRATED = 'emre-buluta-aktarildi'
const hasLocal = d => d.exams.length > 0 || d.mistakes.length > 0
const localFileIds = d => [...new Set([...d.mistakes.flatMap(m => m.imageIds || []), ...d.exams.flatMap(e => (e.files || []).map(f => f.key))])]

function Loading({ text }) {
  return <div className="auth-screen"><div className="muted">{text}</div></div>
}

// Bu cihazda daha önce girilmiş veriler varsa ve ortak hesap boşsa, bir kez buluta aktarmayı önerir.
function MigrateBanner({ local, replace, onDone }) {
  const [busy, setBusy] = useState('')
  const run = async () => {
    setBusy('Veriler aktarılıyor…')
    replace(local)
    const ids = localFileIds(local)
    await uploadAllLocal(ids, (i, n) => setBusy(`Görseller yükleniyor ${i}/${n}`))
    localStorage.setItem(MIGRATED, '1')
    onDone(`${local.exams.length} deneme ve ${local.mistakes.length} kayıt ortak hesaba aktarıldı ✓`)
  }
  return (
    <div className="card migrate">
      <b>Bu cihazda daha önce girilmiş veriler var</b>
      <p className="muted" style={{ margin: '4px 0 10px' }}>
        {local.exams.length} deneme ve {local.mistakes.length} hata kaydı. Ortak hesaba aktarılsın mı? Aktarınca herkes görür.
      </p>
      <div className="row gap wrap">
        <button className="btn primary" disabled={!!busy} onClick={run}>{busy || 'Ortak hesaba aktar'}</button>
        {!busy && <button className="btn ghost" onClick={() => { localStorage.setItem(MIGRATED, '1'); onDone('') }}>Aktarma</button>}
      </div>
    </div>
  )
}

const ALL_TABS = [
  { id: 'dashboard', label: 'Analiz', icon: '📊' },
  { id: 'exams', label: 'Denemeler', icon: '📝' },
  { id: 'add', label: 'Ekle', icon: '＋', primary: true },
  { id: 'mistakes', label: 'Hata Defteri', icon: '📒' },
  { id: 'review', label: 'Tekrar', icon: '🔁' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️' }
]

const readHash = () => {
  const [h] = location.hash.replace(/^#\/?/, '').split('/')
  return h === 'karne' || h === 'mark' || ALL_TABS.some(t => t.id === h) ? h : 'dashboard'
}
const readId = () => location.hash.replace(/^#\/?/, '').split('/')[1] || ''

export default function App({ user, role }) {
  const [localData, localUpdate, localReplace] = useStore()
  const cloudOn = firebaseEnabled && !!user
  const canEdit = canEditRole(role)
  const [toast, setToast] = useState('')
  const [filesReady, setFilesReady] = useState(!cloudOn)
  const [askMigrate, setAskMigrate] = useState(() => localStorage.getItem(MIGRATED) !== '1')
  const cloud = useCloudStore(cloudOn, canEdit, () => setToast('Sadece görüntüleme yetkin var; değişiklik yapamazsın.'))

  useEffect(() => {
    if (!cloudOn) return
    enableCloudFiles(app, STUDENT_ID, canEdit).finally(() => setFilesReady(true))
  }, [cloudOn, canEdit])

  if (cloudOn && cloud.error && !cloud.data) return <Loading text={cloud.error} />
  if (cloudOn && (!cloud.data || !filesReady)) return <Loading text="Veriler yükleniyor…" />

  const data = cloudOn ? cloud.data : localData
  const update = cloudOn ? cloud.update : localUpdate
  const replace = cloudOn ? cloud.replace : localReplace
  const showMigrate = cloudOn && canEdit && askMigrate && cloud.empty && hasLocal(localData)

  return (
    <RoleContext.Provider value={role}>
      <Shell {...{ user, role, canEdit, data, update, replace, toast, setToast }}>
        {showMigrate && <MigrateBanner local={localData} replace={replace} onDone={m => { setAskMigrate(false); if (m) setToast(m) }} />}
        {cloud.error && <div className="error">{cloud.error}</div>}
      </Shell>
    </RoleContext.Provider>
  )
}

function Shell({ user, role, canEdit, data, update, replace, toast, setToast, children }) {
  const [tab, setTab] = useState(readHash)
  const [karneId, setKarneId] = useState(readId)
  const [editingExam, setEditingExam] = useState(null)
  const [mistakeForm, setMistakeForm] = useState(null)

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

  const TABS = canEdit ? ALL_TABS : ALL_TABS.filter(t => t.id !== 'add')
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
          {tab === 'dashboard' && canEdit && <button className="btn primary hide-mobile" onClick={() => go('add')}>+ Deneme ekle</button>}
          {role === 'viewer' && <span className="badge blue">Görüntüleyici</span>}
        </header>
        {children}

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
        {tab === 'settings' && <Settings data={data} update={update} replace={replace} user={user} role={role} />}
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

      {mistakeForm && canEdit && <MistakeForm data={data} update={update} {...mistakeForm} onClose={() => setMistakeForm(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
