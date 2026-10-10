/* ==========================================================
   utils.js — fungsi bantu umum (DOM, tanggal, rupiah, teks)
   Dipakai oleh semua file lain, jadi dimuat paling awal.
   ========================================================== */

// ---------- DOM & umum ----------
// $('#id') = ambil satu elemen HTML (seperti jQuery, tapi versi mini)
const $ = s => document.querySelector(s);
// Mengamankan teks sebelum dimasukkan ke HTML, supaya pesan tamu
// seperti "<script>" tidak dijalankan browser (mencegah XSS)
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Menunggu sekian milidetik (dipakai untuk efek "agen sedang mengetik")
const sleep = ms => new Promise(r => setTimeout(r, ms));
// true jika pengguna mematikan animasi di pengaturan OS → jeda mengetik dipersingkat
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Tanggal ----------
const now0 = new Date();
// "Hari ini" pukul 00.00, dipakai sebagai acuan semua perhitungan tanggal
const today = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate());
// Tambah n hari ke tanggal d, misal addDays(today, 1) = besok
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => a.toDateString() === b.toDateString();
// Format tampilan: fmtD → "Sab, 11 Okt", fmtLong → "Sabtu, 11 Oktober", fmtT → "14.05"
const fmtD = d => d.toLocaleDateString('id-ID', {weekday:'short', day:'numeric', month:'short'});
const fmtLong = d => d.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long'});
const fmtT = d => d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
// Format rupiah: rp(650000) → "Rp650.000"
const rp = n => 'Rp' + n.toLocaleString('id-ID');
// Tanggal ↔ teks "2026-10-11", dipakai di payload tombol cepat (mis. "date:2026-10-11")
const iso = d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
const fromIso = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
// Label relatif untuk papan admin: "hari ini" / "besok" / kosong
const rel = d => sameDay(d, today) ? 'hari ini' : sameDay(d, addDays(today,1)) ? 'besok' : '';
// Nama depan tamu, untuk sapaan: "Rina Kusuma" → "Rina"
const first = g => g.name.split(' ')[0];

// ---------- Untuk jalur LLM ----------
// Format tanggal ISO dan validasi angka (dipakai saat membaca jawaban LLM)
// pad4(18) → "0018", untuk nomor folio/eskalasi
const pad4 = n => String(n).padStart(4,'0');
// Tanggal → "2026-10-11" (format yang diminta dari LLM)
const isoDash = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// Membaca tanggal "YYYY-MM-DD" dari LLM. Hasilnya null jika formatnya salah
// atau tanggalnya sudah lewat, supaya LLM tidak bisa memesan untuk masa lalu.
function parseIsoSafe(s){
  const m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  return isNaN(d) || d < today ? null : d;
}
// Angka bulat dalam rentang lo..hi, selain itu null (mis. jumlah malam 1–14)
const intOk = (v, lo, hi) => { const n = parseInt(v, 10); return n >= lo && n <= hi ? n : null; };

// ---------- Teks ----------
// Normalisasi teks untuk pencocokan kata kunci
// "Mau PESAN kamar!" → " mau pesan kamar " (huruf kecil, tanda baca jadi spasi,
// diberi spasi di awal & akhir supaya kata bisa dicocokkan utuh)
const norm = t => ' ' + t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
// Apakah kata kunci kw ada di teks n? Kata pendek (≤3 huruf, mis. "ac", "tv")
// harus cocok sebagai kata utuh, supaya "ac" tidak cocok dengan "acara".
const hit = (n, kw) => kw.length <= 3 ? n.includes(' ' + kw + ' ') : n.includes(kw);
