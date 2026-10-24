// Firebase konsolu → Proje ayarları → Genel → "Uygulamalarınız" → Web uygulaması → SDK yapılandırması.
// Bu değerler gizli değildir (her web uygulamasında tarayıcıya gider); güvenliği App Check ve
// Authentication sağlar. apiKey boşsa uygulama girişsiz ve yapay zekâsız çalışır.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBE6WjXDJhCdLeIdUFFQtTf7UlON6239K4',
  authDomain: 'pediatri-asistans.firebaseapp.com',
  projectId: 'pediatri-asistans',
  storageBucket: 'pediatri-asistans.firebasestorage.app',
  messagingSenderId: '52789517949',
  appId: '1:52789517949:web:df5ba16a159bf21b761b14'
}

// Siteye girebilecek Google hesapları (küçük harf). Boş bırakılırsa her Google hesabı girebilir.
export const ALLOWED_EMAILS = []

// Firebase konsolu → App Check → web uygulaması → reCAPTCHA Enterprise site anahtarı.
export const RECAPTCHA_ENTERPRISE_SITE_KEY = '6LdB_f4tAAAAANXM8wy73X0Qe6coLmAkGe-LzYjY'

// İşi gören en ucuz model (Ekim 2026): 0,25 $ / 1,50 $ (1M token, girdi / çıktı).
// Görsel okuma yetersiz kalırsa bir üst seçenek: 'gemini-3.5-flash-lite'.
export const GEMINI_MODEL = 'gemini-3.1-flash-lite'
