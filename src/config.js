// Firebase konsolu → Proje ayarları → Genel → "Uygulamalarınız" → Web uygulaması → SDK yapılandırması.
// Bu değerler gizli değildir (her web uygulamasında tarayıcıya gider); güvenliği App Check ve
// Authentication sağlar. apiKey boşsa uygulama girişsiz ve yapay zekâsız çalışır.
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
}

// Siteye girebilecek Google hesapları (küçük harf). Boş bırakılırsa her Google hesabı girebilir.
export const ALLOWED_EMAILS = []

// Firebase konsolu → App Check → web uygulaması → reCAPTCHA Enterprise site anahtarı.
export const RECAPTCHA_ENTERPRISE_SITE_KEY = ''

// İşi gören en ucuz model (Ekim 2026): 0,25 $ / 1,50 $ (1M token, girdi / çıktı).
// Görsel okuma yetersiz kalırsa bir üst seçenek: 'gemini-3.5-flash-lite'.
export const GEMINI_MODEL = 'gemini-3.1-flash-lite'
