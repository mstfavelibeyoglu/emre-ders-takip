// Varsayılanlar Excel'deki Ayarlar sayfasıyla aynıdır.

export const TYT_TESTS = ['Türkçe', 'Sosyal', 'Matematik', 'Fen']

// Dersler her yerde (form, tablolar, karne) bu sırayla gösterilir: TYT sırası.
// DEFAULT_SETTINGS'teki sıra Excel şablonunun sütun sırasıdır; içe aktarma ona dayanır, değiştirme.
export const SUBJECT_ORDER = ['edb', 'tar', 'cog', 'din', 'mat', 'fiz', 'kim', 'bio']

export const DEFAULT_SETTINGS = {
  studentName: 'Emre',
  wrongPenalty: 4,
  subjects: [
    { id: 'edb', name: 'Türk Dili ve Edebiyatı', questions: 20, target: 15, tyt: 'Türkçe', color: '#e11d48' },
    { id: 'mat', name: 'Matematik', questions: 20, target: 12, tyt: 'Matematik', color: '#4f46e5' },
    { id: 'fiz', name: 'Fizik', questions: 10, target: 6, tyt: 'Fen', color: '#0891b2' },
    { id: 'kim', name: 'Kimya', questions: 10, target: 6, tyt: 'Fen', color: '#16a34a' },
    { id: 'bio', name: 'Biyoloji', questions: 10, target: 6, tyt: 'Fen', color: '#65a30d' },
    { id: 'tar', name: 'Tarih', questions: 10, target: 7, tyt: 'Sosyal', color: '#b45309' },
    { id: 'cog', name: 'Coğrafya', questions: 10, target: 7, tyt: 'Sosyal', color: '#ca8a04' },
    { id: 'din', name: 'Din Kültürü', questions: 10, target: 8, tyt: 'Sosyal', color: '#9333ea' }
  ],
  errorReasons: [
    'Konuyu bilmiyorum',
    'Kavram yanılgısı',
    'İşlem hatası',
    'Dikkatsizlik / yanlış okuma',
    'Süre yetmedi',
    'Tahmin ettim',
    'Diğer'
  ],
  tyt: {
    base: 100,
    tests: {
      'Türkçe': { questions: 40, coef: 3.3 },
      'Sosyal': { questions: 20, coef: 3.4 },
      'Matematik': { questions: 40, coef: 3.3 },
      'Fen': { questions: 20, coef: 3.4 }
    }
  }
}

// Konu önerileri: serbest yazılabilir, bunlar yalnızca otomatik tamamlama içindir.
export const TOPIC_SUGGESTIONS = {
  edb: ['Edebiyat ve metin türleri', 'Hikâye', 'Şiir', 'Masal / Fabl', 'Roman', 'Tiyatro', 'Biyografi / Otobiyografi', 'Mektup / Günlük', 'Söz sanatları', 'Ses bilgisi', 'Kelime yapısı', 'Sözcükte anlam', 'Cümlede anlam', 'Paragraf', 'Yazım ve noktalama'],
  mat: ['Sayılar', 'Kümeler', 'Mantık', 'Üslü ifadeler', 'Köklü ifadeler', 'Denklem ve eşitsizlikler', 'Mutlak değer', 'Oran orantı', 'Problemler', 'Fonksiyonlar', 'Algoritma', 'Üçgenler', 'Eşlik ve benzerlik', 'İstatistik', 'Olasılık'],
  fiz: ['Fizik bilimine giriş', 'Madde ve özellikleri', 'Kuvvet ve hareket', 'Newton yasaları', 'Akışkanlar / basınç', 'İş, güç ve enerji', 'Isı ve sıcaklık', 'Elektrostatik'],
  kim: ['Kimya bilimi', 'Atom modelleri', 'Periyodik sistem', 'Kimyasal türler arası etkileşimler', 'Maddenin halleri', 'Doğa ve kimya', 'Laboratuvar güvenliği'],
  bio: ['Canlıların ortak özellikleri', 'İnorganik bileşikler', 'Organik bileşikler', 'Enzimler', 'Hücre ve organeller', 'Hücre zarından madde geçişi', 'Canlıların sınıflandırılması'],
  tar: ['Tarih ve zaman', 'İnsanlığın ilk dönemleri', 'İlk Çağ medeniyetleri', 'Orta Çağ\'da dünya', 'İlk Türk devletleri', 'İslamiyet\'in doğuşu', 'İlk Türk-İslam devletleri'],
  cog: ['Coğrafyanın konusu', 'Harita bilgisi', 'Dünya\'nın şekli ve hareketleri', 'Coğrafi konum', 'Atmosfer ve iklim', 'Sıcaklık, basınç, rüzgâr', 'Nem ve yağış', 'İç ve dış kuvvetler'],
  din: ['Bilgi ve inanç', 'İslam ve ibadet', 'Gençlik ve değerler', 'Peygamber ve kitaplar', 'Ahlak', 'Din ve kültür']
}

export const emptyData = () => ({
  version: 1,
  settings: structuredClone(DEFAULT_SETTINGS),
  exams: [],
  mistakes: []
})
