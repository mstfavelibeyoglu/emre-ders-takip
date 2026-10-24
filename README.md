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

`main` dalına yapılan her push, GitHub Actions üzerinden GitHub Pages'e otomatik olarak yayınlanır (Settings → Pages → Source: **GitHub Actions**).
