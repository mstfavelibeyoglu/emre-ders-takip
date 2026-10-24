// Gemini (Firebase AI Logic): API anahtarı Firebase'in sunucusunda kalır, tarayıcıya hiç gelmez.
import { getAI, getGenerativeModel, GoogleAIBackend, ThinkingLevel } from 'firebase/ai'
import { app, firebaseEnabled } from './firebase'
import { GEMINI_MODEL } from '../config'

// Yalnızca geliştirmede: localStorage 'ai-mock' = '1' iken Gemini yerine sahte yanıt (arayüzü ücretsiz denemek için).
const MOCK = import.meta.env.DEV && typeof localStorage !== 'undefined' && localStorage.getItem('ai-mock') === '1'
let mockN = 0
const mockPage = () => {
  const start = mockN % 30 === 0 ? 1 : (mockN % 30) + 1
  const qs = [0, 1, 2, 3].map(i => {
    const n = start + i
    const r = (n * 7) % 10
    return { n, kutu: [i % 2 ? 520 : 150, i < 2 ? 60 : 510, i % 2 ? 900 : 500, i < 2 ? 490 : 950], ortakMetinKutu: null, isaret: r < 6 ? 'ABCDE'[n % 5] : r < 8 ? 'ABCDE'[(n + 1) % 5] : r < 9 ? 'BOS' : 'BELIRSIZ', guven: r === 9 ? 0.5 : 0.95 }
  })
  mockN = (mockN + 4) % 30
  return { test: '', sorular: qs, uyarilar: [], tokens: { in: 1500, out: 300 } }
}

export const aiEnabled = firebaseEnabled || MOCK

const CHOICE = ['A', 'B', 'C', 'D', 'E', 'BOS', 'COKLU', 'BELIRSIZ']
const BOX = { type: 'array', items: { type: 'integer' }, minItems: 4, maxItems: 4, description: '[ymin, xmin, ymax, xmax], görsel boyutuna göre 0-1000 arası' }

const PAGE_SCHEMA = {
  type: 'object',
  properties: {
    test: { type: 'string', description: 'Sayfa başlığındaki test adı, ör. "MATEMATİK TESTİ"; yoksa boş metin' },
    sorular: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer', description: 'Soru numarası' },
          kutu: BOX,
          ortakMetinKutu: { type: 'array', items: { type: 'integer' }, description: 'Soru bir ortak metne/şiire/görsele dayanıyorsa o metnin kutusu [ymin, xmin, ymax, xmax]; yoksa boş dizi' },
          isaret: { type: 'string', enum: CHOICE },
          guven: { type: 'number', description: 'İşaret okumasına güven, 0-1' }
        },
        required: ['n', 'kutu', 'ortakMetinKutu', 'isaret', 'guven']
      }
    },
    uyarilar: { type: 'array', items: { type: 'string' } }
  },
  required: ['test', 'sorular', 'uyarilar']
}

const PAGE_PROMPT = `Bu, bir öğrencinin çözdüğü deneme sınavı kitapçığının bir sayfası (fotoğraf ya da tarama).
Sayfadaki HER soru için:
- n: soru numarası (sorunun başındaki "12." gibi numara).
- kutu: sorunun tamamını (soru kökü, görseller ve A-E şıkları dahil) kapsayan kutu, [ymin, xmin, ymax, xmax], 0-1000 normalize.
- ortakMetinKutu: "1, 2 ve 3. soruları aşağıdaki metne göre cevaplayınız" gibi birden çok soruya ait ortak bir metin/şiir/tablo varsa onun kutusu; yoksa boş dizi [].
- isaret: öğrencinin şıklardan hangisini DAİRE İÇİNE ALDIĞI. Kalem/kurşun kalemle çizilmiş elle yapılmış daireye bak; basılı harflerin kendisi işaret değildir.
  Hiç daire yoksa "BOS". Birden fazla şık daire içindeyse ya da biri karalanıp diğeri seçildiyse ve hangisinin geçerli olduğu net değilse "COKLU".
  Emin olamıyorsan "BELIRSIZ". Tahmin etme.
- guven: isaret okumasına 0-1 arası güven.
Sayfa bulanık, eğik, kesik ya da okunmuyorsa uyarilar listesine kısa Türkçe not yaz. Soru yoksa (kapak, yönerge, cevap anahtarı sayfası) sorular boş liste olsun.`

const KEY_SCHEMA = {
  type: 'object',
  properties: {
    testler: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ad: { type: 'string', description: 'Test adı, ör. "Türkçe", "Matematik"' },
          cevaplar: { type: 'array', items: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E', 'X'] }, description: 'Soru 1den başlayarak sırayla doğru şıklar; iptal/okunamayan için X' }
        },
        required: ['ad', 'cevaplar']
      }
    },
    uyarilar: { type: 'array', items: { type: 'string' } }
  },
  required: ['testler', 'uyarilar']
}

const KEY_PROMPT = `Bu bir deneme sınavının cevap anahtarı. Biçimi herhangi bir şey olabilir (tablo, yan yana harfler, sütunlar, A/B kitapçık türleri).
Her testi sınavdaki sırasıyla ayrı ayrı çıkar. Her test için 1. sorudan başlayarak doğru şıkları sırayla yaz.
Birden fazla kitapçık türü (A ve B) varsa yalnızca A kitapçığını al ve uyarilar'a not düş. Okunamayan ya da iptal edilen soru için X yaz.`

const models = {}
function model(key, schema) {
  if (!aiEnabled) throw new Error('Yapay zekâ için Firebase ayarlanmamış (src/config.js).')
  models[key] ??= getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
  })
  return models[key]
}

const toBase64 = blob =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })

async function ask(key, schema, prompt, images, text) {
  const parts = []
  for (const b of images) parts.push({ inlineData: { mimeType: b.type || 'image/jpeg', data: await toBase64(b) } })
  parts.push({ text: text ? `${prompt}\n\nMetin:\n${text}` : prompt })
  const res = await model(key, schema).generateContent(parts)
  const usage = res.response.usageMetadata
  return { json: JSON.parse(res.response.text()), tokens: usage ? { in: usage.promptTokenCount, out: usage.candidatesTokenCount + (usage.thoughtsTokenCount || 0) } : null }
}

const validBox = b => Array.isArray(b) && b.length === 4 && b.every(v => Number.isFinite(v)) && b[2] > b[0] && b[3] > b[1]
const clampBox = b => b.map(v => Math.min(1000, Math.max(0, Math.round(v))))

// Modelin çıktısına körü körüne güvenme: bozuk kutuları ele, işaretleri normalize et.
export async function analyzePage(blob) {
  if (MOCK) return new Promise(r => setTimeout(() => r(mockPage()), 300))
  const { json, tokens } = await ask('page', PAGE_SCHEMA, PAGE_PROMPT, [blob])
  const sorular = (json.sorular || [])
    .filter(q => Number.isInteger(q.n) && q.n > 0 && validBox(q.kutu))
    .map(q => ({
      n: q.n,
      kutu: clampBox(q.kutu),
      ortakMetinKutu: validBox(q.ortakMetinKutu) ? clampBox(q.ortakMetinKutu) : null,
      isaret: CHOICE.includes(q.isaret) ? q.isaret : 'BELIRSIZ',
      guven: Number.isFinite(q.guven) ? Math.min(1, Math.max(0, q.guven)) : 0
    }))
    .sort((a, b) => a.n - b.n)
  return { test: (json.test || '').trim(), sorular, uyarilar: json.uyarilar || [], tokens }
}

export async function readAnswerKey({ images = [], text = '' }) {
  if (MOCK) return { testler: [1, 2, 3, 4].map(t => ({ ad: ['Türkçe', 'Sosyal', 'Matematik', 'Fen'][t - 1], cevaplar: Array.from({ length: 30 }, (_, i) => 'ABCDE'[(i + 1) % 5]) })), uyarilar: [], tokens: null }
  const { json, tokens } = await ask('key', KEY_SCHEMA, KEY_PROMPT, images, text)
  return { ...json, tokens }
}
