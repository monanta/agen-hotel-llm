/* ==========================================================
   Agen Concierge
   Info hotel, fasilitas, sapaan, dan pertanyaan umum.
   FAQ di sini juga dipakai Orkestrator (kata kunci) dan LLM (fakta hotel).
   ========================================================== */

// Basis pengetahuan hotel.
//   kw = kata kunci yang memicu jawaban ini
//   a  = jawabannya
// Dipakai di tiga tempat:
//   1. faq() di bawah (jalur aturan kata kunci)
//   2. INTENTS di orkestrator.js: semua kw di sini = niat "informasi hotel"
//   3. buildPrompt() di llm.js: semua a di sini = "FAKTA HOTEL" untuk LLM
// Untuk menambah info hotel baru, cukup tambah satu baris di sini.
const FAQ = [
  {kw:['check in','checkin','check out','checkout','jam masuk','jam keluar','early','late'], a:'Check-in mulai pukul 14.00 dan check-out paling lambat pukul 12.00. Early check-in atau late check-out tergantung ketersediaan kamar.'},
  {kw:['sarapan','breakfast','makan pagi','restoran'], a:'Sarapan prasmanan pukul 06.30–10.00 di restoran lantai 1, sudah termasuk untuk semua tipe kamar.'},
  {kw:['wifi','wi fi','internet','password'], a:'Wi-Fi tersedia di seluruh area dengan jaringan Kencana-Tamu. Kata sandinya tercetak di amplop kartu kunci kamar.'},
  {kw:['kolam','renang','gym','fitness','kebugaran'], a:'Kolam renang buka pukul 07.00–21.00. Ruang kebugaran di lantai 3 buka 24 jam dengan kartu kunci.'},
  {kw:['parkir','mobil','motor'], a:'Parkir mobil dan motor gratis untuk tamu yang menginap.'},
  {kw:['laundry','cuci','setrika'], a:'Laundry Rp25.000 per kg, selesai dalam 24 jam. Titipkan pakaian di resepsionis.'},
  {kw:['bandara','antar','jemput','shuttle','airport'], a:'Antar-jemput Bandara YIA Rp250.000 sekali jalan. Pesan paling lambat 6 jam sebelumnya.'},
  {kw:['lokasi','alamat','dimana','di mana','arah'], a:'Hotel Kencana ada di Jl. Kenanga No. 21, Yogyakarta, sekitar 10 menit jalan kaki dari stasiun.'},
  {kw:['fasilitas'], a:'Fasilitas hotel: restoran, kolam renang, ruang kebugaran, laundry, parkir gratis, dan antar-jemput bandara.'},
];

// Tombol menu utama yang ditawarkan saat menyapa tamu
const menuQuick = () => [
  {label:'Pesan kamar'}, {label:'Bayar tagihan'}, {label:'Sampaikan keluhan', payload:'complainHint'}, {label:'Jam sarapan?'}
];

// Menjawab pertanyaan info hotel. n = teks tamu yang sudah dinormalisasi (lihat norm()).
async function faq(g, n){
  // Ambil semua jawaban FAQ yang kata kuncinya muncul di pesan tamu
  const ans = FAQ.filter(f => f.kw.some(k => hit(n, k))).map(f => f.a);
  // Kasus khusus: minta early check-in pagi sekali (sebelum 11.00) → di luar
  // kebijakan, jadi Concierge menjawab lalu meneruskan ke Agen Eskalasi
  if (n.includes('early') && /jam 0?[5-9]|jam 10|pagi|subuh/.test(n)){
    await say(g, 'conc', ans[0] + ' Check-in sebelum pukul 11.00 di luar kebijakan standar.');
    return escalate(g, guestLast(g), 'Di luar kebijakan standar', 'conc');
  }
  return say(g, 'conc', ans.join('\n\n'));
}
// Pesan terakhir yang ditulis tamu (teks asli, untuk dicatat di tiket eskalasi)
const guestLast = g => [...g.messages].reverse().find(m => m.from === 'guest')?.text || '';

// Membalas sapaan ("halo") atau ucapan terima kasih
async function greet(g, n){
  if (/terima kasih|makasih|thank/.test(n)) return say(g, 'conc', `Sama-sama, ${first(g)}. Semoga betah di Kencana.`);
  return say(g, 'conc', `Halo, ${first(g)}. Ada yang bisa kami bantu?`, {quick:menuQuick()});
}
