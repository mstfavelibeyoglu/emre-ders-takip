import { useState } from 'react'
import { useRequests, useAccess, grant, revoke, rejectRequest } from '../lib/cloud'
import { Card, Badge } from './ui'

const ROLE_LABEL = { editor: 'Öğrenci / düzenleyebilir', viewer: 'Sadece görüntüler' }

export default function AccessPanel({ user }) {
  const requests = useRequests(true)
  const { access } = useAccess(user)
  const [err, setErr] = useState('')
  const run = p => p.catch(e => setErr('İşlem yapılamadı: ' + (e.code || e.message)))
  const people = [
    ...(access?.editors || []).map(e => ({ email: e, role: 'editor' })),
    ...(access?.viewers || []).map(e => ({ email: e, role: 'viewer' }))
  ]

  return (
    <Card title="Erişim (yönetici)">
      <div className="stack-sm">
        {err && <div className="error">{err}</div>}
        <div className="label">Bekleyen istekler</div>
        {requests.length ? (
          requests.map(r => (
            <div key={r.uid} className="access-row">
              <div className="grow">
                <b>{r.name || 'İsimsiz'}</b> <span className="muted">{r.email}</span>
              </div>
              <div className="row gap wrap">
                <button className="btn small primary" onClick={() => run(grant(r.email, 'editor', r.uid))}>Öğrenci (düzenler)</button>
                <button className="btn small" onClick={() => run(grant(r.email, 'viewer', r.uid))}>Görüntüleyici</button>
                <button className="btn small ghost danger" onClick={() => run(rejectRequest(r.uid))}>Reddet</button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted" style={{ margin: 0 }}>Bekleyen istek yok. Emre ya da baban siteye ilk kez Google ile girdiğinde burada görünür.</p>
        )}

        <div className="label" style={{ marginTop: 8 }}>Erişimi olanlar</div>
        <div className="access-row">
          <div className="grow"><b>{user.email}</b></div>
          <Badge tone="green">Yönetici</Badge>
        </div>
        {people.map(p => (
          <div key={p.email} className="access-row">
            <div className="grow">{p.email}</div>
            <Badge tone={p.role === 'editor' ? 'blue' : 'gray'}>{ROLE_LABEL[p.role]}</Badge>
            <button className="btn small ghost" onClick={() => run(grant(p.email, p.role === 'editor' ? 'viewer' : 'editor'))}>
              {p.role === 'editor' ? 'Görüntüleyici yap' : 'Düzenleyici yap'}
            </button>
            <button className="btn small ghost danger" onClick={() => confirm(`${p.email} erişimi kaldırılsın mı?`) && run(revoke(p.email))}>Kaldır</button>
          </div>
        ))}
      </div>
    </Card>
  )
}
