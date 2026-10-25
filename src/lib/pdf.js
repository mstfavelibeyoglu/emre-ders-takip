// Karneyi yazdırma penceresi açmadan tek sayfalık A4 PDF olarak indirir.
// Karne geniş bir masaüstü düzeninde ve açık temada ekran dışında kopyalanır, resme çevrilir, sayfaya sığdırılır.
const loadImage = src =>
  new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })

export const safeName = s =>
  (s || 'karne')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, '_')
    .slice(0, 80)

export async function downloadKarnePdf(node, filename) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const holder = document.createElement('div')
  holder.className = 'pdf-export'
  const clone = node.cloneNode(true)
  clone.querySelectorAll('.no-print').forEach(e => e.remove())
  holder.appendChild(clone)
  document.body.appendChild(holder)
  try {
    await document.fonts?.ready
    const jpg = await toJpeg(clone, { pixelRatio: 2, quality: 0.9, backgroundColor: '#ffffff' })
    const img = await loadImage(jpg)
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const margin = 8
    const pw = 210 - 2 * margin
    const ph = 297 - 2 * margin
    const k = Math.min(pw / img.width, ph / img.height)
    const w = img.width * k
    const h = img.height * k
    pdf.addImage(jpg, 'JPEG', margin + (pw - w) / 2, margin, w, h)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(pdf.output('blob'))
    a.download = filename.endsWith('.pdf') ? filename : filename + '.pdf'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  } finally {
    holder.remove()
  }
}
