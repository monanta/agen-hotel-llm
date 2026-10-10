/* ==========================================================
   data.js — "database" aplikasi
   Semua data (kamar, tamu, eskalasi, log) hanya disimpan di
   memori browser (variabel JavaScript). Data hilang saat
   halaman di-refresh. Tidak ada database server.
   ========================================================== */

/* ---------- Agen ---------- */
// Daftar agen. Kunci pendeknya (orch, res, bill, ...) dipakai di seluruh kode,
// misalnya pesan {from:'res'} artinya pesan itu ditulis Agen Reservasi.
// Kunci yang sama juga dipakai sebagai kelas CSS warna agen (a-res, a-bill, ...).
const AGENTS = {
  orch:  {name:'Orkestrator',          role:'Membaca maksud setiap pesan lalu memilih agen'},
  res:   {name:'Agen Reservasi',       role:'Cek kamar kosong, buat dan batalkan pemesanan'},
  bill:  {name:'Agen Billing',         role:'Tagihan, folio, dan pembayaran'},
  care:  {name:'Agen Layanan Kamar',   role:'Keluhan dan permintaan housekeeping'},
  conc:  {name:'Agen Concierge',       role:'Info hotel, fasilitas, dan pertanyaan umum'},
  esc:   {name:'Agen Eskalasi',        role:'Meneruskan kasus ke staf manusia'},
  human: {name:'Front Office Manager', role:'Staf manusia yang menjawab eskalasi'},
};
// Urutan tampil agen di panel/log admin
const ORDER = ['orch','res','bill','care','conc','esc','human'];

/* ---------- Data ---------- */
// "Tabel" kamar. booking = null berarti kamar kosong.
// Kalau dipesan, booking berisi:
//   {folio, guestId, in, out, nights, status:'booked'|'in', paid, method, total}
//   status 'booked' = sudah dipesan, 'in' = tamu sudah check-in
const rooms = [
  {no:'101', type:'Deluxe King',    price:650000,  booking:null},
  {no:'102', type:'Deluxe Twin',    price:650000,  booking:null},
  {no:'201', type:'Superior Twin',  price:550000,  booking:null},
  {no:'202', type:'Family Room',    price:900000,  booking:null},
  {no:'301', type:'Kencana Suite',  price:1450000, booking:null},
];
// Cari kamar berdasarkan nomor: roomBy('101')
const roomBy = no => rooms.find(r => r.no === no);
// "Tabel" tamu, diindeks id: { g1: {...}, g2: {...} }
const guests = {};
// "Tabel" eskalasi ke staf manusia:
//   {id:'ESK-0042', guestId, room, question, reason, via, time, status:'open'|'replied'|'done', replies:[]}
const escalations = [];
// Log aktivitas agen yang tampil di halaman admin (terbaru di depan)
const logs = [];
// Penghitung nomor berikutnya: id tamu, folio (F-0018), eskalasi (ESK-0040), tiket housekeeping (HK-113)
let gSeq = 0, folioSeq = 17, escSeq = 39, hkSeq = 112;

/* ---------- State tampilan ---------- */
// cur     = id tamu yang chat-nya sedang dibuka
// busy    = true selama agen sedang memproses pesan (input dikunci)
// adminIn = admin sudah login atau belum
// view    = tab yang aktif: 'cust' (pelanggan) atau 'admin'
let cur = null, busy = false, adminIn = false, view = 'cust';
// Draf balasan admin yang belum terkirim, per id eskalasi
const drafts = {};

// Mendaftarkan tamu baru.
//   messages     = riwayat chat
//   flow         = alur yang sedang berjalan (mis. pemesanan: pilih tanggal → malam → kamar)
//   typing       = agen yang sedang "mengetik" (untuk animasi)
//   lastRoute    = rute terakhir yang dipilih Orkestrator
//   pendingRoute = info rute yang akan ditempel ke balasan agen berikutnya
function newGuest(name){
  const id = 'g' + (++gSeq);
  guests[id] = {id, name, messages:[], flow:null, typing:null, lastRoute:null, pendingRoute:null};
  return guests[id];
}
// Kamar yang sedang dipesan tamu g (atau undefined jika belum memesan)
const bookingOf = g => rooms.find(r => r.booking && r.booking.guestId === g.id);
// Mencatat aktivitas agen ke log admin (maksimal 80 baris)
function log(agent, g, text){
  logs.unshift({t:new Date(), agent, guest:g ? g.name : '', text});
  if (logs.length > 80) logs.pop();
}

/* ---------- Seed (data contoh) ---------- */
// Dijalankan sekali saat halaman dibuka, supaya demo langsung punya isi:
// - Sari Wulandari: sudah check-in di Kamar 201, keluhan AC → dieskalasi
// - Budi Santoso: memesan Kamar 102 untuk besok, minta early check-in → dieskalasi
(function seed(){
  const ago = m => new Date(now0.getTime() - m*60000);
  const sari = newGuest('Sari Wulandari');
  roomBy('201').booking = {folio:'F-0015', guestId:sari.id, in:addDays(today,-2), out:addDays(today,1), nights:3, status:'in', paid:true, method:'Transfer VA', total:550000*3};
  sari.messages.push(
    {from:'guest', text:'AC di kamar saya bocor dan berisik, sudah lapor dua kali tapi belum diperbaiki.', time:ago(42)},
    {from:'care', text:'Mohon maaf atas ketidaknyamanannya, Bu Sari. Keluhan untuk Kamar 201 sudah saya catat. Karena keluhan ini berulang, kasusnya perlu ditangani langsung oleh staf.', time:ago(42), route:{label:'keluhan', conf:0.93}},
    {from:'esc', text:'Pertanyaan Anda saya teruskan ke Front Office Manager dengan tiket ESK-0041. Staf akan membalas langsung di percakapan ini.', time:ago(41), route:{handoff:'Agen Layanan Kamar'}}
  );
  const budi = newGuest('Budi Santoso');
  roomBy('102').booking = {folio:'F-0017', guestId:budi.id, in:addDays(today,1), out:addDays(today,3), nights:2, status:'booked', paid:false, method:null, total:650000*2};
  budi.messages.push(
    {from:'guest', text:'Saya mau pesan kamar besok 2 malam', time:ago(95)},
    {from:'res', text:'Kamar 102 (Deluxe Twin) sudah saya kunci atas nama Budi Santoso. Nomor folio: F-0017.', time:ago(94), route:{label:'pemesanan kamar', conf:0.91}},
    {from:'bill', text:'Tagihan Rp1.300.000 menunggu pembayaran. Ketik "bayar" kapan saja untuk melunasinya.', time:ago(94), route:{handoff:'Agen Reservasi'}},
    {from:'guest', text:'Boleh early check-in jam 08.00? Pesawat saya mendarat subuh.', time:ago(30)},
    {from:'conc', text:'Check-in standar mulai pukul 14.00. Check-in sebelum pukul 11.00 di luar kebijakan standar dan perlu persetujuan staf.', time:ago(30), route:{label:'informasi hotel', conf:0.74}},
    {from:'esc', text:'Pertanyaan Anda saya teruskan ke Front Office Manager dengan tiket ESK-0040. Staf akan membalas langsung di percakapan ini.', time:ago(29), route:{handoff:'Agen Concierge'}}
  );
  escalations.push(
    {id:'ESK-0041', guestId:sari.id, room:'201', question:'AC di kamar saya bocor dan berisik, sudah lapor dua kali tapi belum diperbaiki.', reason:'Keluhan berat / berulang', via:'care', time:ago(41), status:'open', replies:[]},
    {id:'ESK-0040', guestId:budi.id, room:'102', question:'Boleh early check-in jam 08.00? Pesawat saya mendarat subuh.', reason:'Di luar kebijakan standar', via:'conc', time:ago(29), status:'open', replies:[]}
  );
  escSeq = 41;
  logs.push(
    {t:ago(29), agent:'esc', guest:'Budi Santoso', text:'Meneruskan ESK-0040 ke Front Office Manager (di luar kebijakan standar)'},
    {t:ago(30), agent:'orch', guest:'Budi Santoso', text:'"Boleh early check-in jam 08.00?" → Agen Concierge (informasi hotel, 0.74)'},
    {t:ago(41), agent:'esc', guest:'Sari Wulandari', text:'Meneruskan ESK-0041 ke Front Office Manager (keluhan berat)'},
    {t:ago(42), agent:'orch', guest:'Sari Wulandari', text:'"AC di kamar saya bocor…" → Agen Layanan Kamar (keluhan, 0.93)'},
    {t:ago(94), agent:'bill', guest:'Budi Santoso', text:'Menerbitkan tagihan F-0017 sebesar Rp1.300.000'},
    {t:ago(94), agent:'res', guest:'Budi Santoso', text:'Membuat pemesanan F-0017 untuk Kamar 102'}
  );
  sari.lastRoute = {agent:'care', label:'keluhan', conf:0.93};
  budi.lastRoute = {agent:'conc', label:'informasi hotel', conf:0.74};
})();
