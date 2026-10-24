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
  const src = blob ? local : stored
  if (!src) return <div className={className + ' qimg-empty'} />
  return <img src={src} className={className} alt={alt} onClick={onClick} draggable={false} />
}
