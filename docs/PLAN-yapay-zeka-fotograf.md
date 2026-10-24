# Plan: Kitapçık fotoğraflarından yanlış soruları yapay zekâyla bulma

Durum: taslak plan, uygulanmadı · 24 Ekim 2026 · rev. 2

Revizyon 2'de iki şey değişti:
- **Optik form çekilemiyor.** Emre şıkları kitapçığın üstüne işaretliyor, dolayısıyla denemenin tüm sayfaları fotoğraflanacak.
- **Servis olarak Google Gemini API** kullanılacak (senin tercihin).

## 1. Hedef ve akış

1. Emre deneme bitince kitapçığın bütün sayfalarını telefonla çeker (ya da tarar).
2. Cevap anahtarı girilir: anahtar sayfasının fotoğrafı, PDF'in son sayfası ya da elle tek satır ("ABCDA BCE…").
3. **🤖 Otomatik bul** butonuna basılır. Her sayfa için yapay zekâ şunları döndürür:
   - Sorunun numarası ve sayfadaki kutusu
   - Varsa ortak metnin kutusu ("1-3. soruları metne göre…")
   - Emre'nin daire içine aldığı ya da işaretlediği şık (A–E, boş, birden fazla ya da belirsiz)
4. Kod işaretleri anahtarla karşılaştırır, yanlış ve boşları çıkarır, kutuları fotoğraftan kırpar.
5. **Onay ekranı:** yanlış ve boşlar kırpılmış görselleriyle listelenir. Emin olunmayanlar sarı görünür. Emre kontrol eder, ders ve konu seçer, kaydeder.

Kitapçığın dijital PDF'i de varsa, kutular ücretsiz olarak bugünkü koddan alınır. Yapay zekâ o zaman sadece işaretli şıkları okumak için kullanılır.

## 2. Mimari

```
Tarayıcı (GitHub Pages, PWA)
   │  sayfa fotoğrafı (küçültülmüş JPEG) + aile şifresi
   ▼
Cloudflare Worker  /api/analyze          ← GEMINI_API_KEY burada (secret)
   │  şifre kontrolü · günlük limit · yalnızca github.io kaynağına izin (CORS)
   ▼
Gemini API  (görsel girdi + JSON şemasıyla zorlanmış çıktı)
```

- **API anahtarı Gemini için de asla tarayıcıya konmaz.** GitHub Pages'teki kodu herkes görür ve anahtar başkası tarafından kullanılabilir. Bu yüzden Worker şart.
- **Sağlayıcı katmanı ince tutulacak.** Worker'da tek bir `analyzePage(image) → SayfaSonucu` fonksiyonu olacak. Gemini'den başka bir servise geçmek gerekirse yalnızca bu fonksiyon değişir; uygulama tarafı aynı JSON'u almaya devam eder.
- **Kötüye kullanım önlemleri:** günlük sayfa limiti (ör. 80) ve Google Cloud tarafında bütçe uyarısı.

## 3. Yapay zekâ çağrısı

- **Model:** Gemini'nin görsel destekli, hızlı ve ucuz modeli (Flash sınıfı). Güncel model adı ve fiyatı uygulamaya başlarken Google AI Studio'dan kontrol edilecek; buraya ezbere yazmıyorum.
- **Çıktı:** JSON şemasıyla zorlanmış yanıt. Serbest metin ayrıştırılmaz.
- **Kutu koordinatları:** Gemini kutuları genelde görsel boyutuna göre normalize edilmiş biçimde (0–1000) döndürür. Worker bunu piksele çevirecek. Biçim ilk testte doğrulanacak.
- **Görsel hazırlığı (tarayıcıda):**
  - Uzun kenar ~2000 px, JPEG kalitesi 0,85.
  - Kapak sayfası (ad ve numara olabilir) gönderilmez. Emre ilk soru sayfasından başlatır.

### Sayfa şeması

```ts
SayfaSonucu = {
  test: string | null,            // sayfa başlığındaki test adı, ör. "MATEMATİK TESTİ"
  sorular: [{
    n: number,                    // soru no
    kutu: [ymin, xmin, ymax, xmax],         // 0–1000
    ortakMetinKutu: [ymin, xmin, ymax, xmax] | null,
    isaret: "A"|"B"|"C"|"D"|"E"|"BOS"|"COKLU"|"BELIRSIZ",
    guven: number                 // 0–1
  }],
  uyarilar: string[]              // ör. "sayfa bulanık", "alt kısım kesik"
}
```

### Yapay zekâya güvenmeden kodla yapılan kontroller

- Soru numaraları sayfalar boyunca ardışık mı, atlanan ya da tekrar eden var mı? Numara 1'e dönünce yeni test başlar.
- Her test için bulunan soru sayısı anahtardaki soru sayısıyla tutuyor mu?
- Kutular sayfa sınırları içinde mi ve birbirinin üstüne biniyor mu?
- `guven < 0,85`, `BELIRSIZ` ya da `COKLU` olan her soru sarı işaretlenir ve Emre'ye sorulur.
- **Anahtarda yanlış görünen ama `guven` değeri düşük olan sorular "belki yanlış" listesine girer**, atlanmaz. Kaçırılan bir yanlış, fazladan sorulan bir sorudan daha kötüdür.

## 4. Maliyet

Bir deneme yaklaşık 30–40 sayfa tutar, haftada 1 deneme ile ayda ~150 sayfa eder. Flash sınıfı modellerde görsel başı maliyet çok düşük olduğu için bu kullanımın ayda birkaç doları geçmemesi beklenir. Gerçek rakamı ilk denemede Worker loglarından ölçüp buraya yazacağım.

## 5. Doğruluk ölçümü (açmadan önce şart)

- 2–3 gerçek denemenin bütün sayfa fotoğrafları ve her biri için elle hazırlanmış doğru tablo: Emre'nin işaretleri, gerçek yanlışlar ve soru kutuları.
- Ölçülecekler:
  - Şık okuma doğruluğu
  - **Kaçırılan yanlış sayısı** (en kritik metrik)
  - Fazladan işaretlenen soru sayısı
  - Kutu örtüşmesi
- **Eşik:** kaçırılan yanlış = 0 ve şık okuma ≥ %97. Eşik tutmazsa sonuçlar yalnızca "öneri" olarak gösterilir ve Emre her sayfayı onaylar.
- Aynı test seti ileride başka bir modelle de çalıştırılabilir; Gemini'nin diğer modelleriyle ya da başka bir servisle karşılaştırmak için.

## 6. Şeytanın avukatı

| İtiraz | Önlem |
|---|---|
| Kurşun kalemle hafif işaretlenmiş, silinmiş ya da karalanmış şıkları yanlış okur | `BELIRSIZ` / `COKLU`, güven skoru, sarı işaretleme, "belki yanlış" listesi |
| Eğik, gölgeli ya da bulanık fotoğraf | Çekim ekranında kısa ipuçları; sayfa bazında `uyarilar` gösterilir ve o sayfa yeniden çekilebilir |
| Kutu kayar, soru yarım kırpılır | Onay ekranında kutu sürüklenerek düzeltilir; kırpılmış görsel kayıttan önce görünür |
| 40 sayfa yüklemek uzun sürer | Sayfalar paralel gönderilir (aynı anda 4); ilerleme çubuğu; yarıda kalırsa kaldığı yerden devam eder |
| Ücretsiz katmanda Google verileri ürün geliştirmede kullanabilir | Reşit olmayan bir öğrenci söz konusu. Faturalandırması açık (ücretli) katman kullanılmalı; güncel veri koşulları kurulumda kontrol edilecek. Kapak gönderilmez |
| Anahtar sızarsa? | Anahtar sadece Worker'da; şifre ve limit var. Sızıntıda Google AI Studio'dan iptal edilir |
| Emre her şeyi onaylayıp geçer | Sarı sorular tek tek onaylanmadan "Kaydet" açılmaz |
| İnternet ya da servis yoksa? | Elle seçim ve dijital PDF modu her zaman çalışır; yapay zekâ isteğe bağlı bir hızlandırıcıdır |

## 7. Uygulama adımları

| # | İş | Tahmini süre |
|---|---|---|
| 1 | Worker: şifre, limit, CORS, `/api/analyze` → Gemini | 0,5 gün |
| 2 | Cevap anahtarı girişi: elle, PDF'ten ya da fotoğraftan | 0,5 gün |
| 3 | Toplu sayfa yükleme, paralel analiz, ilerleme çubuğu | 0,5 gün |
| 4 | Onay ekranı: yanlış ve boş listesi, sarı onaylar, kutu düzeltme, toplu kayıt | 1 gün |
| 5 | Gerçek denemelerle doğruluk ölçümü ve ayar | 0,5–1 gün |

## 8. Senden gerekenler

1. **Gemini API anahtarı:** Google AI Studio'dan. Faturalandırmayı açıp bir bütçe uyarısı kur.
2. **Ücretsiz bir Cloudflare hesabı:** Worker'ı ben yazarım, birlikte yayınlarız.
3. **Test için 2–3 gerçek deneme:** Emre'nin işaretlediği kitapçığın tüm sayfalarının fotoğrafları ve cevap anahtarı.
4. **Aile şifresi:** Worker'a erişim için.

## 9. Açık sorular

- Cevap anahtarı nasıl geliyor: kitapçığın sonunda mı, ayrı bir kâğıtta mı, yoksa okulun sitesinde mi?
- Emre şıkları **daire içine mi alıyor**, yoksa çarpı ya da tik mi atıyor? Kurşun kalem mi, tükenmez mi? Prompt bunlara göre ayarlanacak.
