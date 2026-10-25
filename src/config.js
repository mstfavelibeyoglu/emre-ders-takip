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

// Uygulamanın sahibi (yönetici). Diğer kişiler ilk girişte erişim isteği bırakır, sahip Ayarlar'dan onaylar.
// Aynı e-posta firebase/firestore.rules ve firebase/storage.rules içinde de yazılı.
export const OWNER_EMAIL = 'mstfavelibeyoglu@gmail.com'

// Firestore'daki ortak öğrenci kaydı.
export const STUDENT_ID = 'emre'

// Firebase konsolu → App Check → web uygulaması → reCAPTCHA Enterprise site anahtarı (kötüye kullanıma karşı).
export const RECAPTCHA_ENTERPRISE_SITE_KEY = '6LdB_f4tAAAAANXM8wy73X0Qe6coLmAkGe-LzYjY'

