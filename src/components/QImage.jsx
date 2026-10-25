import { useEffect, useState } from 'react'
import { useImageUrl } from '../lib/images'

// Kayıtlı (id) ya da henüz kaydedilmemiş (blob) bir soru görseli.
export default function QImage({ id, blob, className = 'qimg', onClick, alt = 'Soru görseli' }) {
  const stored = useImageUrl(blob ? null : id)
  const [local, setLocal] = useState(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setLocal(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  const src = blob ? local : stored.url
  if (!src) {
    if (!blob && stored.error) {
      return (
        <div className={className + ' qimg-empty qimg-error'} title={'Görsel açılamadı: ' + stored.error} onClick={e => { e.stopPropagation(); stored.retry() }}>
          <span>⚠︎ {stored.error}</span>
          <small>dokun: tekrar dene</small>
        </div>
      )
    }
    return <div className={className + ' qimg-empty'} />
  }
  return <img src={src} className={className} alt={alt} onClick={onClick} draggable={false} />
}
