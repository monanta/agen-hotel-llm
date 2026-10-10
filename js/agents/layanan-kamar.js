/* ==========================================================
   Agen Layanan Kamar
   Keluhan dan housekeeping. Keluhan ringan → tiket housekeeping.
   Keluhan berat/berulang (kata di SEVERE) → diteruskan ke Agen Eskalasi.
   ========================================================== */

// Kata yang menandakan keluhan berat, berbahaya, atau sudah berulang.
// Jika salah satu muncul, keluhan tidak cukup ditangani housekeeping.
const SEVERE = ['bocor','mati','rusak','hilang','dicuri','keamanan','refund','kecewa','marah','dua kali','2 kali','berkali','darurat','kebakaran','asap','sakit','luka','kecoa','tidak ada yang datang','belum datang','belum diperbaiki'];

// Menangani keluhan tamu
async function complaint(g, text){
  const r = bookingOf(g);
  const where = r ? `Kamar ${r.no}` : 'keluhan Anda';
  const n = norm(text);
  // Keluhan berat → minta maaf, lalu serah terima ke Agen Eskalasi (staf manusia)
  if (SEVERE.some(k => n.includes(k))){
    await say(g, 'care', `Mohon maaf atas ketidaknyamanannya, ${first(g)}. ${r ? 'Keluhan untuk ' + where : 'Keluhan Anda'} sudah saya catat. Kasus seperti ini perlu ditangani langsung oleh staf.`);
    return escalate(g, text, 'Keluhan berat / berulang', 'care');
  }
  // Keluhan ringan (handuk, sabun, dll.) → buat tiket housekeeping
  const hk = 'HK-' + (++hkSeq);
  log('care', g, `Membuat tiket housekeeping ${hk}${r ? ' untuk Kamar ' + r.no : ''}`);
  return say(g, 'care', `Mohon maaf, ${first(g)}. Saya sudah membuat tiket ${hk}${r ? ' untuk Kamar ' + r.no : ''}. Petugas housekeeping datang dalam ±20 menit. Kalau belum ada yang datang, balas "belum datang" dan saya teruskan ke staf.`);
}
