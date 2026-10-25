import { useRef, useState } from 'react'
import { Card } from '../components/ui'
import { TYT_TESTS, emptyData } from '../lib/defaults'
const excel = () => import('../lib/excel')
import { exportZip, readBackup, restoreFiles } from '../lib/backup'
import { clearImages, pendingUploads, flushUploads, checkAndRepair } from '../lib/images'
import { firebaseEnabled, logout } from '../lib/firebase'
import AccessPanel from '../components/AccessPanel'

export default function Settings({ data, update, replace, user, role }) {
  const { settings } = data
  const [msg, setMsg] = useState(null)
  const [zipping, setZipping] = useState('')
  const xlsRef = useRef(null)
  const jsonRef = useRef(null)

  const setS = fn => update(d => { fn(d.settings); return d })
  const setSub = (i, k, v) => setS(s => { s.subjects[i][k] = v })
  const n = v => (v === '' ? 0 : Number(v))

  const onExcel = async e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const { data: imported, skipped } = await (await excel()).importTemplate(file, data)
      const has = data.exams.length || data.mistakes.length
      const mode = has
        ? confirm(`${imported.exams.length} deneme ve ${imported.mistakes.length} hata kaydı bulundu.\n\nTamam: mevcut verilere EKLE\nİptal: işlemi iptal et`)
        : true
      if (!mode) return
      update(d => {
        d.settings = imported.settings
        d.exams.push(...imported.exams)
        d.mistakes.push(...imported.mistakes)
        return d
      })
      setMsg({ ok: true, text: `İçe aktarıldı: ${imported.exams.length} deneme, ${imported.mistakes.length} hata kaydı${skipped ? ` (${skipped} örnek satır atlandı)` : ''}.` })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  const onJSON = async e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const { data: parsed, files } = await readBackup(file)
      const nFiles = Object.keys(files).length
      if (!confirm(`Yedekte ${parsed.exams.length} deneme, ${parsed.mistakes.length} hata kaydı${nFiles ? ` ve ${nFiles} dosya` : ''} var. Mevcut verilerin TAMAMI bununla değiştirilsin mi?`)) return
      if (nFiles) await restoreFiles(files)
      replace(parsed)
      setMsg({ ok: true, text: 'Yedek geri yüklendi.' })
    } catch {
      setMsg({ ok: false, text: 'Bu dosya geçerli bir yedek değil.' })
    }
  }

  const reset = () => {
    if (!confirm('Tüm denemeler, hata kayıtları ve ayarlar silinecek. Önce yedek almanı öneririm. Devam edilsin mi?')) return
    if (!confirm('Emin misin? Bu işlem geri alınamaz.')) return
    clearImages()
    replace(emptyData())
    setMsg({ ok: true, text: 'Tüm veriler sıfırlandı.' })
  }

  return (
    <div className="stack">
      <Card title="Veri ve yedekleme">
        <p className="note">
          {role === 'local'
            ? <>Veriler, soru görselleri ve deneme dosyaları <b>sadece bu cihazdaki tarayıcıda</b> saklanır. Haftada bir <b>tam yedek (ZIP)</b> indir.</>
            : <>Veriler ortak hesapta (Firebase) tutulur; giriş yapan herkes aynı şeyi görür. Yine de ayda bir <b>tam yedek (ZIP)</b> indirmek iyi bir alışkanlıktır.</>}
          {' '}Excel çıktısı yalnızca sayıları içerir.
        </p>
        {msg && <div className={msg.ok ? 'ok' : 'error'}>{msg.text}</div>}
        <div className="btn-grid">
          <button className="btn" onClick={() => xlsRef.current.click()}>📥 Excel şablonundan içe aktar</button>
          <button className="btn" onClick={async () => (await excel()).exportExcel(data)}>📤 Excel'e aktar</button>
          <button className="btn primary" disabled={!!zipping} onClick={async () => { setZipping('0'); try { await exportZip(data, (i, n) => setZipping(`${i}/${n}`)); localStorage.setItem('emre-last-backup', new Date().toISOString()) } finally { setZipping('') } }}>
            {zipping ? `Hazırlanıyor… ${zipping}` : '💾 Tam yedek indir (ZIP)'}
          </button>
          {(role === 'owner' || role === 'local') && <button className="btn" onClick={() => jsonRef.current.click()}>♻️ Yedekten geri yükle</button>}
        </div>
        <input ref={xlsRef} type="file" accept=".xlsx,.xls" hidden onChange={onExcel} />
        <input ref={jsonRef} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={onJSON} />
      </Card>

      <Card title="Hesap">
        {firebaseEnabled ? (
          <div className="row gap wrap" style={{ justifyContent: 'space-between' }}>
            <div>
              <div><b>{user?.displayName}</b> <span className="muted">{user?.email}</span></div>
              <small className="muted">Rol: {{ owner: 'Yönetici', editor: 'Öğrenci / düzenleyici', viewer: 'Görüntüleyici' }[role] || role} · Veriler ortak hesapta (Firebase)</small>
            </div>
            <button className="btn" onClick={logout}>Çıkış yap</button>
          </div>
        ) : (
          <p className="note" style={{ marginTop: 0 }}>Firebase ayarlanmadığı için giriş ve ortak veri kapalı (src/config.js). Uygulamanın geri kalanı normal çalışır.</p>
        )}
      </Card>

      {role === 'owner' && <AccessPanel user={user} />}

      {role !== 'local' && <SyncCard data={data} role={role} />}

      <Card title="Genel">
        <div className="form-row">
          <label className="grow">Öğrenci adı<input value={settings.studentName} onChange={e => setS(s => { s.studentName = e.target.value })} /></label>
          <label>
            Kaç yanlış 1 doğruyu götürür?
            <select value={settings.wrongPenalty} onChange={e => setS(s => { s.wrongPenalty = Number(e.target.value) })}>
              <option value={4}>4 (TYT / YKS)</option>
              <option value={3}>3 (LGS)</option>
              <option value={0}>Götürmez</option>
            </select>
          </label>
        </div>
      </Card>

      <Card title="Dersler">
        <div className="table-wrap">
          <table className="edit-table">
            <thead><tr><th>Renk</th><th>Ders</th><th>Soru</th><th>Hedef net</th><th>TYT testi</th></tr></thead>
            <tbody>
              {settings.subjects.map((s, i) => (
                <tr key={s.id}>
                  <td><input type="color" value={s.color} onChange={e => setSub(i, 'color', e.target.value)} aria-label="Renk" /></td>
                  <td><input value={s.name} onChange={e => setSub(i, 'name', e.target.value)} /></td>
                  <td><input type="number" min="1" value={s.questions} onChange={e => setSub(i, 'questions', n(e.target.value))} /></td>
                  <td><input type="number" min="0" step="0.25" value={s.target} onChange={e => setSub(i, 'target', n(e.target.value))} /></td>
                  <td>
                    <select value={s.tyt} onChange={e => setSub(i, 'tyt', e.target.value)}>
                      {TYT_TESTS.map(t => <option key={t}>{t}</option>)}
                      <option value="">— katma</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Tahmini TYT puanı">
        <div className="table-wrap">
          <table className="edit-table">
            <thead><tr><th>Test</th><th>Soru</th><th>Katsayı</th></tr></thead>
            <tbody>
              {TYT_TESTS.map(t => (
                <tr key={t}>
                  <td>{t}</td>
                  <td><input type="number" value={settings.tyt.tests[t].questions} onChange={e => setS(s => { s.tyt.tests[t].questions = n(e.target.value) })} /></td>
                  <td><input type="number" step="0.01" value={settings.tyt.tests[t].coef} onChange={e => setS(s => { s.tyt.tests[t].coef = n(e.target.value) })} /></td>
                </tr>
              ))}
              <tr>
                <td>Taban puan</td>
                <td colSpan={2}><input type="number" value={settings.tyt.base} onChange={e => setS(s => { s.tyt.base = n(e.target.value) })} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">Katsayılar yaklaşıktır, dershanelerin TYT hesaplamalarına göre seçilmiştir.</p>
      </Card>

      <Card title="Hata nedenleri">
        <textarea
          rows={7}
          value={settings.errorReasons.join('\n')}
          onChange={e => setS(s => { s.errorReasons = e.target.value.split('\n') })}
          onBlur={() => setS(s => { s.errorReasons = s.errorReasons.map(x => x.trim()).filter(Boolean) })}
        />
        <p className="note">Her satıra bir neden yaz.</p>
      </Card>

      {(role === 'owner' || role === 'local') && <Card title="Tehlikeli bölge" className="danger-zone">
        <button className="btn danger" onClick={reset}>Tüm verileri sıfırla</button>
      </Card>}
    </div>
  )
}

function SyncCard({ data, role }) {
  const canWrite = role === 'owner' || role === 'editor'
  const [left, setLeft] = useState(() => pendingUploads().length)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const ids = [...new Set(data.mistakes.flatMap(m => m.imageIds || []))]

  const check = async () => {
    setBusy(true)
    setMsg(null)
    if (canWrite) await flushUploads()
    const r = await checkAndRepair(ids)
    setLeft(pendingUploads().length)
    setBusy(false)
    const lines = [
      `Hata defterinde ${r.total} fotoğraf var; ${r.inCloud + r.uploaded} tanesi bulutta.`,
      r.uploaded ? `${r.uploaded} fotoğraf bu cihazdan buluta yüklendi ✓` : '',
      r.localOnly ? `${r.localOnly} fotoğraf sadece bu cihazda duruyor${canWrite ? '' : ' (görüntüleyici yükleyemez)'}.` : '',
      r.missing ? `${r.missing} fotoğraf ne bulutta ne bu cihazda: fotoğrafı çeken cihazda bu butona basılmalı.` : '',
      r.error || ''
    ].filter(Boolean)
    setMsg({ ok: !r.error && !r.missing && !r.localOnly, text: lines.join('\n') })
  }

  return (
    <Card title="Fotoğraf eşitleme">
      <div className="row gap wrap" style={{ justifyContent: 'space-between' }}>
        <span>{left ? <b>Bu cihazda {left} fotoğraf buluta yüklenmeyi bekliyor.</b> : 'Fotoğrafların bulutta olup olmadığını kontrol et.'}</span>
        <button className="btn small primary" disabled={busy} onClick={check}>{busy ? 'Kontrol ediliyor…' : 'Kontrol et ve onar'}</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'warnbox'} style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{msg.text}</div>}
      <p className="note">Bir fotoğraf başka cihazlarda görünmüyorsa, fotoğrafı çeken cihazda bu butona basın. Rolün: {{ owner: 'Yönetici', editor: 'Öğrenci / düzenleyici', viewer: 'Görüntüleyici' }[role]} · Sürüm: {__BUILD__}</p>
    </Card>
  )
}
