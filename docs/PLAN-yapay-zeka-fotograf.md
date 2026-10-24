# Plan: Fotoğraftan soruları ve işaretli şıkları yapay zekâyla bulma

Durum: taslak plan, uygulanmadı · 24 Ekim 2026

## 1. Hedef

Emre denemeden sonra fotoğraf çeker. Uygulama, elle seçim yapmadan şunları bulur:

1. Emre'nin her soruda **hangi şıkkı işaretlediği**
2. Bunun cevap anahtarına göre **doğru, yanlış ya da boş** olduğu
3. Yanlış ve boş soruların **kitapçıktaki yeri**, kırpılıp hata defterine eklenmek üzere

Emre sonucu bir **onay ekranında** görür, gerekirse düzeltir ve kaydeder. Yapay zekâ hiçbir zaman doğrudan kayıt oluşturmaz.

## 2. Akış: üç mod, en ucuzdan pahalıya

| Mod | Girdi | Yapay zekâ ne yapar | Kod ne yapar | Deneme başı tahmini maliyet* |
|---|---|---|---|---|
| **A. Optik form** (önerilen ilk adım) | Cevap kâğıdının 1 fotoğrafı + cevap anahtarı | İşaretli şıkları okur (120 soru) | Anahtarla karşılaştırır, yanlış ve boşları çıkarır | ~0,10–0,20 $ |
| **B. Kitapçık fotoğrafı** | Sayfa fotoğrafları (yalnızca yanlış soruların olduğu sayfalar) | Her sorunun kutusunu, ortak metnin kutusunu ve kitapçıkta daire içine alınan şıkkı bulur | Kutuları kırpar, kaydeder | Sayfa başı ~0,05–0,08 $ |
| **C. Dijital PDF** (bugün var) | Yayınevinin PDF'i | — | Soru numaralarının konumundan kutuları bulur | 0 $ |

\* Claude Opus 5.5 ile (girdi 4 $ / 1M token, çıktı 20 $ / 1M token). Bir görsel en fazla ~4.800 token tutar. Gerçek maliyet ilk denemelerde ölçülecek; tabloyu ona göre güncelleyeceğiz.

En verimli birleşim **A + C**: optik formdan hangi soruların yanlış olduğu bulunur, dijital PDF'ten o sorular ücretsiz kırpılır. B yalnızca PDF olmayan denemeler için gerekir.

Cevap anahtarı üç yoldan gelebilir:
- PDF'in son sayfasından kodla okunur (dijital PDF'te metin var)
- Anahtarın fotoğrafından yapay zekâyla okunur
- Elle yazılır (ör. "ABCDA BCE…" diye tek satır)

## 3. Mimari

```
Tarayıcı (GitHub Pages, PWA)
   │  fotoğraf (küçültülmüş JPEG) + aile şifresi
   ▼
Cloudflare Worker  /api/analyze        ← ANTHROPIC_API_KEY burada (secret)
   │  şifre kontrolü · günlük limit · yalnızca github.io kaynağına izin (CORS)
   ▼
Claude API  (claude-opus-5-5, structured output)
```

- **Anahtar asla tarayıcıya konmaz.** GitHub Pages statik bir site; kodu herkes görebilir.
- **Worker** küçük bir TypeScript fonksiyonu olacak (`@anthropic-ai/sdk`). Cloudflare'in ücretsiz kotası bu kullanım için fazlasıyla yeterli.
- **Kötüye kullanım önlemleri:**
  - Worker isteğin yanında bir aile şifresi bekler.
  - Günlük çağrı limiti olur (ör. 60 görsel).
  - Anthropic Console'da aylık harcama sınırı konur (ör. 10 $).
- **Çevrimdışıyken** A ve B modları çalışmaz, C modu ve elle seçim çalışmaya devam eder.

## 4. Yapay zekâ çağrısının tasarımı

- **Model:** `claude-opus-5-5`, `output_config.effort: "medium"` (açıkça yazılacak).
  - Daha ucuz bir modele (Sonnet 5.5 / Haiku 5.5) geçmek **senin kararın**. Ancak 5. bölümdeki doğruluk ölçümüyle karşılaştırıldıktan sonra yapılmalı.
- **Ret durumunda yedek model:** `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Ret olursa istek otomatik olarak başka modele yönlendirilir. Bu plan ret beklemiyor ama koruma ucuz.
- **Çıktı:** `client.messages.parse` + Zod şeması. Serbest metin ayrıştırılmaz.
- **Görsel hazırlığı (tarayıcıda):**
  - Uzun kenar ≤ 2576 px, JPEG kalitesi 0,85.
  - Koordinatlar gönderilen görselin pikselleriyle 1:1 döner.
  - Optik formda öğrenci adı ve numarası bölgesi **göndermeden önce tarayıcıda kırpılır**.

### Mod A şeması (optik form)

```ts
const AnswerSheet = z.object({
  tests: z.array(z.object({
    name: z.string(),                 // formda yazan test adı, ör. "Matematik"
    answers: z.array(z.object({
      n: z.number().int(),            // soru no
      mark: z.enum(["A", "B", "C", "D", "E", "BOS", "COKLU", "BELIRSIZ"]),
      confidence: z.number(),         // 0–1
    })),
  })),
  warnings: z.array(z.string()),      // ör. "Fotoğraf eğik, 3. test kısmen görünmüyor"
})
```

### Mod B şeması (kitapçık sayfası)

```ts
const BookletPage = z.object({
  questions: z.array(z.object({
    n: z.number().int(),
    box: z.tuple([z.number(), z.number(), z.number(), z.number()]),        // x1,y1,x2,y2 piksel
    sharedTextBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(), // "1-3. soruları metne göre…"
    circled: z.enum(["A", "B", "C", "D", "E", "YOK", "BELIRSIZ"]),
    confidence: z.number(),
  })),
})
```

### Yapay zekâya güvenmeden kodla yapılan kontroller

- Soru numaraları ardışık mı, eksik ya da tekrar eden var mı?
- Okunan soru sayısı ile anahtardaki soru sayısı aynı mı?
- Kutular görselin içinde mi ve birbirinin üstüne biniyor mu?
- `confidence < 0,85`, `BELIRSIZ` ya da `COKLU` olan her soru onay ekranında **sarı** işaretlenir ve Emre'ye sorulur.

## 5. Doğruluk ölçümü (açmadan önce şart)

Gerçek veriyle küçük bir test seti kurulacak:

- 3–5 gerçek deneme, her biri için cevap kâğıdı fotoğrafı, kitapçık fotoğrafları ve elle hazırlanmış doğru tablo (Emre'nin işaretleri + soru kutuları)
- Ölçülecekler:
  - Şık okuma doğruluğu
  - Yanlış soru tespiti (kaçırılan ve fazladan bulunan)
  - Kutu örtüşmesi (IoU)
- **Eşik:** Şık okuma ≥ %98 ve kaçırılan yanlış = 0 olmadan otomatik mod varsayılan yapılmaz. Eşik tutmazsa sonuç yalnızca "öneri" olarak gösterilir.
- Her ölçüm turu gerçek para harcar (birkaç dolar). Turdan önce onayın alınacak.

## 6. Şeytanın avukatı

| İtiraz | Önlem |
|---|---|
| Silik işaret, karalama ya da iki şık işaretlenmiş soruda yanlış okur | `BELIRSIZ` / `COKLU` seçenekleri, güven skoru, sarı işaretleme; son söz Emre'de |
| Kutu biraz kayar, soru yarım kırpılır | Onay ekranında kutular sürüklenerek düzeltilebilir; kırpılan görsel kayıttan önce gösterilir |
| Ayda kaç dolar tutar? | Haftada 1 deneme ile A+C modunda ayda ~1 $. B modu yoğun kullanılırsa ~5–8 $. Console'daki aylık sınır sürprizi önler |
| Anahtar sızarsa? | Anahtar sadece Worker'da. Şifre ve günlük limit var. Sızıntıda anahtar Console'dan iptal edilir |
| Reşit olmayan bir öğrencinin verisi dışarı gider | Yalnızca sayfa ve form görüntüleri gider; ad ve numara tarayıcıda kırpılır. İstatistikler, hata defteri ve analiz cihazda kalır |
| Hiç yapay zekâ olmadan da olur mu? | Olur: C modu ve elle seçim kalıcı olarak çalışmaya devam eder. Yapay zekâ isteğe bağlı bir hızlandırıcıdır |
| İnternet ya da servis kesilirse? | Uygulama çalışmaya devam eder, sadece "🤖 Otomatik bul" butonu devre dışı kalır |
| Emre her şeyi onaylayıp geçer, yanlış kayıtlar birikir | Sarı (emin olunmayan) sorular onaylanmadan kayıt butonu açılmaz |

## 7. Uygulama adımları

| # | İş | Tahmini süre |
|---|---|---|
| 1 | Worker iskeleti: şifre, günlük limit, CORS, `/api/analyze` | 0,5 gün |
| 2 | Cevap anahtarı: PDF'ten otomatik okuma + elle giriş | 0,5 gün |
| 3 | Mod A: optik form okuma, onay ekranı, anahtarla karşılaştırma, mevcut PDF kırpma ile bağlama | 1 gün |
| 4 | Doğruluk ölçümü gerçek denemelerle; eşik tutarsa A modunu aç | 0,5–1 gün |
| 5 | Mod B: kitapçık fotoğrafından kutu ve işaretli şık bulma | 1 gün |

1–4 tek parça olarak çıkar. 5. adım, A modu kullanıldıktan ve gerçekten gerek olduğu görüldükten sonra yapılır.

## 8. Senden gerekenler

1. **Anthropic API anahtarı:** console.anthropic.com → API Keys. Bir aylık harcama sınırı koy.
2. **Cloudflare hesabı:** ücretsiz plan yeterli. Worker'ı ben yazarım, `wrangler` ile birlikte yayınlarız.
3. **Test için 2–3 gerçek deneme:** cevap kâğıdı fotoğrafı, cevap anahtarı ve varsa kitapçık.
4. **Aile şifresi:** Worker'a erişim için basit bir parola.

## 9. Açık sorular

- Emre işaretlerini **optik forma mı** yapıyor, yoksa **kitapçığın üstüne mi**? Mod A mı, B mi öncelikli olacak, buna bağlı.
- Deneme sonrası **cevap anahtarı** nasıl geliyor: PDF'in sonunda mı, ayrı bir kâğıtta mı, yoksa okulun sitesinde mi?
- Denemeler çoğunlukla **dijital PDF** olarak mı geliyor, yoksa sadece basılı kitapçık mı var?
