// Dijital (metin içeren) PDF'lerde soru kutularını bulur: "12." gibi soru numaralarının konumundan
// sütunları ve her sorunun dikey aralığını çıkarır. Taranmış PDF/fotoğrafta metin olmadığı için boş döner.

const ANCHOR = /^\s*(\d{1,3})\s*[.)]\s*$/

async function anchorsOf(page) {
  const tc = await page.getTextContent()
  return tc.items
    .filter(it => ANCHOR.test(it.str))
    .map(it => ({ n: +it.str.match(ANCHOR)[1], x: it.transform[4], y: it.transform[5], size: Math.round(Math.abs(it.transform[3])), font: it.fontName }))
}

// Belgenin genelinde en sık görülen (yazı tipi, boyut) grubu soru numaralarıdır; yönergelerdeki "1." gibi maddeler elenir.
export async function analyzeDocument(doc) {
  const perPage = []
  const freq = new Map()
  for (let i = 1; i <= doc.numPages; i++) {
    const a = await anchorsOf(await doc.getPage(i))
    perPage.push(a)
    for (const x of a) {
      const k = x.font + '|' + x.size
      freq.set(k, (freq.get(k) || 0) + 1)
    }
  }
  const main = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return perPage.map(a => a.filter(x => x.font + '|' + x.size === main))
}

// PDF koordinatlarında (sol-alt orijin) kutular döndürür: [x1, y1, x2, y2]
export function boxesForPage(anchors, pageWidth, pageHeight) {
  if (!anchors.length) return []
  const margin = 28
  const bottom = 52
  const xs = [...new Set(anchors.map(a => Math.round(a.x / 20) * 20))].sort((a, b) => a - b)
  const colOf = a => xs.indexOf(Math.round(a.x / 20) * 20)
  const cols = xs.map((x, i) => ({ left: Math.max(margin / 2, x - 10), right: i < xs.length - 1 ? xs[i + 1] - 14 : pageWidth - margin }))
  return anchors.map(a => {
    const ci = colOf(a)
    const top = a.y + a.size * 1.4
    const below = anchors.filter(b => colOf(b) === ci && b.y < a.y - 1).sort((p, q) => q.y - p.y)[0]
    const end = below ? below.y + below.size * 1.4 + 2 : bottom
    return { n: a.n, rect: [cols[ci].left, end, cols[ci].right, Math.min(pageHeight - 4, top)] }
  })
}
