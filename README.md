# Emre Ders Takip

`Deneme_Takip_9_Sinif.xlsx` dosyasının web uygulamasına dönüştürülmüş hâli. Chrome'da "uygulama olarak yükle" ile masaüstüne veya telefona kurulabilir ve internet olmadan da çalışır.

## Neler var?

- **Analiz:** son net, başarı %, ilk denemeden son denemeye gelişim, tahmini TYT puanı, ders bazında trend ve hedef grafikleri, hata nedeni dağılımı
- **Deneme ekle:** ders başına doğru ve yanlış girilir. Net, başarı ve TYT anında hesaplanır. Doğru + yanlış soru sayısını geçerse uyarı verir.
- **Hata defteri:** yanlış veya boş soruları konu ve hata nedeniyle kaydeder. Aynı konudaki 2. hata sarı, 3. hata ve sonrası kırmızı görünür.
- **Tekrar:** en çok hata yapılan ve henüz çalışılmamış konuları öncelik sırasıyla listeler
- **Ayarlar:** dersler, soru sayıları, hedef netler, yanlış katsayısı, TYT katsayıları. Excel şablonundan içe aktarma, Excel'e dışa aktarma ve JSON yedek alma da buradadır.

Hesaplamalar Excel'deki formüllerle aynıdır: `net = D − Y/4` ve `başarı % = net ÷ soru`.

## Veriler nerede?

Veriler, uygulamanın açıldığı tarayıcıda (`localStorage`) tutulur. Hiçbir sunucuya gönderilmez. Bilgisayar değiştirirken veya tarayıcı verilerini silmeden önce **Ayarlar → Yedek indir** ile JSON yedeği alın.

## Geliştirme

```bash
npm install
npm run dev
```

Yayınlamak için:

```bash
npm run deploy
```

Komut siteyi derler ve `gh-pages` dalına gönderir; GitHub Pages bu daldan yayınlar: https://mstfavelibeyoglu.github.io/emre-ders-takip/

## Firebase anahtarı hakkında

`src/config.js` içindeki Firebase `apiKey` bir **sır değildir**. Her Firebase web uygulamasında tarayıcıya gönderilir ve projeyi tanıtır. `.env` dosyasına taşınsa bile derlenen sitede görünür. Güvenliği şunlar sağlar:

- Google Cloud'da anahtara konan **site ve API kısıtlamaları**
- **App Check** (reCAPTCHA Enterprise)
- **Google ile giriş** ve izinli e-posta listesi


