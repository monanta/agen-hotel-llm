/* ==========================================================
   Agen Reservasi
   Cek kamar kosong, tawarkan kamar, buat dan batalkan pemesanan,
   info tarif. Alur pemesanan: tanggal → jumlah malam → pilih kamar.
   ========================================================== */

// ---------- Membaca tanggal dan jumlah malam dari teks tamu ----------

// Mengubah teks menjadi tanggal check-in. Contoh yang dikenali:
//   "hari ini", "besok", "lusa", "tanggal 15", "tgl 15", "15 okt"
// bareNumber = true → angka saja ("15") juga dianggap tanggal
//   (dipakai saat agen memang sedang menanyakan tanggal)
// Hasilnya null jika tidak ada tanggal di teks.
function parseDate(text, bareNumber){
  const n = norm(text);
  if (/ (hari ini|malam ini|sekarang) /.test(n)) return today;
  if (n.includes(' lusa ')) return addDays(today, 2);
  if (n.includes(' besok ')) return addDays(today, 1);
  let m = n.match(/ tanggal (\d{1,2}) /) || n.match(/ tgl (\d{1,2}) /) || n.match(/ (\d{1,2}) (jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des)/);
  if (!m && bareNumber) m = n.match(/^ (\d{1,2}) $/);
  if (m){
    const day = Number(m[1]); if (day < 1 || day > 31) return null;
    let d = new Date(today.getFullYear(), today.getMonth(), day);
    // Tanggal yang sudah lewat bulan ini dianggap bulan depan
    if (d < today) d = new Date(today.getFullYear(), today.getMonth()+1, day);
    return d;
  }
  return null;
}
// Mengubah teks menjadi jumlah malam (1–14). Contoh: "2 malam", "3 hari", "dua malam".
// bareNumber = true → angka saja ("2") juga diterima.
function parseNights(text, bareNumber){
  const n = norm(text);
  let m = n.match(/ (\d{1,2}) (malam|hari|mlm) /);
  if (!m && bareNumber) m = n.match(/ (\d{1,2}) /);
  if (!m){ const w = {satu:1,dua:2,tiga:3,empat:4,lima:5}; const mw = n.match(/ (satu|dua|tiga|empat|lima) (malam|hari) /); if (mw) return w[mw[1]]; }
  if (!m) return null;
  const v = Number(m[1]); return v >= 1 && v <= 14 ? v : null;
}

// ---------- Alur pemesanan ----------

// Langkah awal: tamu bilang mau pesan kamar.
// Tanggal/malam yang sudah disebut di kalimat pertama langsung dipakai,
// misal "pesan kamar besok 2 malam" → langsung ke pilihan kamar.
async function startBooking(g, text){
  const r = bookingOf(g);
  if (r){
    const b = r.booking;
    return say(g, 'res', `Anda sudah punya pemesanan Kamar ${r.no} (${b.folio}), ${fmtD(b.in)} – ${fmtD(b.out)}. Mau pesan kamar tambahan?`,
      {quick:[{label:'Ya, pesan kamar lain', payload:'newbook'}, {label:'Lihat tagihan'}]});
  }
  // g.flow menyimpan posisi tamu di alur pemesanan (step: 'date' → 'nights' → 'room')
  g.flow = {type:'book', step:'date', in:parseDate(text), nights:parseNights(text)};
  return bookStep(g);
}

// Menanyakan data yang masih kurang, satu per satu.
// Dipanggil ulang setiap kali tamu menjawab, sampai semua lengkap.
async function bookStep(g){
  const f = g.flow;
  // 1. Belum ada tanggal → tanya tanggal (dengan tombol pilihan cepat)
  if (!f.in){
    f.step = 'date';
    return say(g, 'res', `Baik, ${first(g)}. Mau check-in tanggal berapa?`, {quick:[
      {label:'Hari ini · ' + fmtD(today), payload:'date:'+iso(today)},
      {label:'Besok · ' + fmtD(addDays(today,1)), payload:'date:'+iso(addDays(today,1))},
      {label:fmtD(addDays(today,3)), payload:'date:'+iso(addDays(today,3))},
    ]});
  }
  // 2. Belum ada jumlah malam → tanya jumlah malam
  if (!f.nights){
    f.step = 'nights';
    return say(g, 'res', `Check-in ${fmtLong(f.in)}. Menginap berapa malam?`, {quick:[1,2,3].map(n => ({label:n+' malam', payload:'n:'+n}))});
  }
  // 3. Data lengkap → tampilkan kamar kosong.
  // Catatan: prototipe ini menganggap kamar "kosong" = belum ada booking sama sekali
  // (belum memeriksa bentrok tanggal).
  const avail = rooms.filter(r => !r.booking);
  const out = addDays(f.in, f.nights);
  if (!avail.length){
    // Semua kamar penuh → serahkan ke Agen Eskalasi untuk daftar tunggu
    g.flow = null;
    await say(g, 'res', `Maaf, kelima kamar sedang terisi atau dipesan untuk ${fmtD(f.in)} – ${fmtD(out)}.`);
    return escalate(g, `Minta kamar ${fmtD(f.in)} – ${fmtD(out)} (${f.nights} malam), semua kamar penuh`, 'Kamar penuh, perlu daftar tunggu', 'res');
  }
  f.step = 'room';
  return say(g, 'res', `Untuk ${fmtD(f.in)} – ${fmtD(out)} (${f.nights} malam) ada ${avail.length} kamar tersedia. Harga sudah termasuk sarapan. Pilih kamar:`,
    {rooms:avail.map(r => r.no), nights:f.nights});
}

// Tamu memilih kamar → buat pemesanan, lalu serah terima ke Agen Billing.
async function createBooking(g, no){
  const r = roomBy(no), f = g.flow;
  // Tanggal/malam belum diketahui → ulang dari awal
  if (!f || !f.in || !f.nights){ g.flow = {type:'book', step:'date'}; return bookStep(g); }
  // Kamar keburu dipesan tamu lain (di tab lain) → minta pilih ulang
  if (r.booking){ await say(g, 'res', `Kamar ${no} baru saja dipesan tamu lain. Silakan pilih kamar lain.`); return bookStep(g); }
  // Simpan pemesanan ke "database" kamar
  const folio = 'F-' + String(++folioSeq).padStart(4,'0');
  const out = addDays(f.in, f.nights);
  r.booking = {folio, guestId:g.id, in:f.in, out, nights:f.nights, status:'booked', paid:false, method:null, total:r.price*f.nights};
  g.flow = null;   // alur pemesanan selesai
  log('res', g, `Membuat pemesanan ${folio} untuk Kamar ${no}`);
  await say(g, 'res', `Kamar ${no} (${r.type}) sudah saya kunci atas nama ${g.name}.\nMasuk ${fmtLong(f.in)} mulai 14.00, keluar ${fmtLong(out)} paling lambat 12.00.\nNomor folio: ${folio}. Saya serahkan ke Agen Billing untuk pembayaran.`);
  // Serah terima antar-agen: Reservasi → Billing
  log('orch', g, 'Serah terima Agen Reservasi → Agen Billing');
  g.lastRoute = {agent:'bill', label:'serah terima', conf:1};
  return invoice(g, 'Agen Reservasi');
}

// ---------- Pembatalan ----------

// Tamu minta batal. Aturannya:
//   - belum punya pemesanan    → tidak ada yang dibatalkan
//   - sudah check-in           → eskalasi ke staf
//   - sudah bayar / minta refund → eskalasi ke staf (refund butuh persetujuan manusia)
//   - selain itu               → minta konfirmasi dulu (tombol Ya/Tidak)
async function cancelBooking(g, text){
  const r = bookingOf(g);
  if (!r) return say(g, 'res', 'Anda belum punya pemesanan aktif, jadi tidak ada yang perlu dibatalkan.');
  const b = r.booking;
  if (b.status === 'in'){
    await say(g, 'res', `Anda sudah check-in di Kamar ${r.no}. Pembatalan setelah check-in perlu keputusan staf.`);
    return escalate(g, text, 'Pembatalan setelah check-in', 'res');
  }
  if (b.paid || /refund|uang kembali|pengembalian/.test(text.toLowerCase())){
    await say(g, 'res', `Folio ${b.folio} sudah dibayar, jadi pembatalan dan pengembalian dana harus disetujui staf.`);
    return escalate(g, text, 'Pembatalan dengan pengembalian dana', 'res');
  }
  return say(g, 'res', `Batalkan pemesanan Kamar ${r.no} (${b.folio}), ${fmtD(b.in)} – ${fmtD(b.out)}?`,
    {quick:[{label:'Ya, batalkan', payload:'cancel:yes'}, {label:'Tidak jadi', payload:'cancel:no'}]});
}

// Jawaban tombol konfirmasi batal. yes = true jika tamu menekan "Ya, batalkan".
async function confirmCancel(g, yes){
  const r = bookingOf(g);
  if (yes && r && !r.booking.paid){
    const folio = r.booking.folio; r.booking = null;   // kamar kembali kosong
    log('res', g, `Membatalkan ${folio}, Kamar ${r.no} kembali tersedia`);
    return say(g, 'res', `Pemesanan ${folio} untuk Kamar ${r.no} sudah dibatalkan. Tidak ada biaya yang ditagihkan.`);
  }
  return say(g, 'res', 'Baik, pemesanan Anda tetap aktif.');
}

// ---------- Info tarif ----------

// Menampilkan daftar harga semua kamar
async function priceList(g){
  const lines = rooms.map(r => `${r.no} · ${r.type} — ${rp(r.price)}${r.booking ? ' (terisi)' : ''}`).join('\n');
  return say(g, 'res', `Tarif per malam, sudah termasuk sarapan untuk 2 orang:\n${lines}`, {quick:[{label:'Pesan kamar'}]});
}
