/* ==========================================================
   Agen Akses Kamar
   Hotel Kencana adalah hotel mandiri (self-service): tamu melakukan
   check-in, check-out, serta membuka dan mengunci pintu kamar
   langsung dari chat, tanpa resepsionis.

   Setiap aksi diperiksa dulu oleh checkinProblem, checkoutProblem,
   dan doorProblem di bawah. Pemeriksaan yang sama dipakai jalur aturan
   kata kunci (selfCheckin, selfCheckout, door) dan jalur LLM
   (llmHandle di llm.js), jadi LLM tidak bisa membuka pintu kamar
   yang bukan milik tamu atau check-in sebelum lunas.
   ========================================================== */

// Jam paling awal check-in mandiri (kebijakan hotel: mulai 14.00).
// Ubah ke 0 kalau ingin mencoba check-in kapan saja saat demo.
const CHECKIN_HOUR = 14;
const jamCheckin = String(CHECKIN_HOUR).padStart(2, '0') + '.00';

// Tombol cepat setelah tamu berada di kamar
const DOOR_QUICK = [{label:'Buka pintu'}, {label:'Kunci pintu'}, {label:'Check-out'}];

// ---------- Pemeriksaan syarat ----------
// Mengembalikan null jika aksi boleh dilakukan, atau teks alasan jika tidak.

// Syarat check-in: punya pemesanan, belum check-in, sudah lunas,
// hari ini tanggal check-in, dan sudah lewat jam check-in
function checkinProblem(g){
  const r = bookingOf(g);
  if (!r) return 'Anda belum punya pemesanan. Silakan pesan kamar dulu, setelah itu check-in bisa dilakukan langsung di chat ini.';
  const b = r.booking;
  if (b.status === 'in') return `Anda sudah check-in di Kamar ${r.no}. Ketik "buka pintu" untuk masuk kamar.`;
  if (!b.paid) return `Tagihan ${b.folio} sebesar ${rp(b.total)} belum lunas. Check-in mandiri bisa dilakukan setelah pembayaran.`;
  if (today < b.in) return `Check-in Kamar ${r.no} baru bisa dilakukan mulai ${fmtLong(b.in)} pukul ${jamCheckin}.`;
  if (sameDay(b.in, today) && new Date().getHours() < CHECKIN_HOUR) return `Kamar ${r.no} baru siap pukul ${jamCheckin}. Silakan check-in lagi setelah jam tersebut, atau ketik "minta staf" kalau perlu masuk lebih awal.`;
  return null;
}

// Syarat check-out: sudah check-in
function checkoutProblem(g){
  const r = bookingOf(g);
  if (!r) return 'Anda tidak punya kamar yang sedang ditempati, jadi tidak ada yang perlu di-check-out.';
  if (r.booking.status !== 'in') return `Anda belum check-in di Kamar ${r.no}. Kalau ingin membatalkan pemesanan, ketik "batal".`;
  return null;
}

// Syarat buka/kunci pintu: sudah check-in (kunci digital hanya aktif selama menginap)
function doorProblem(g){
  const r = bookingOf(g);
  if (!r) return 'Anda belum punya kamar. Pintu kamar hanya bisa dibuka oleh tamu yang sudah check-in.';
  if (r.booking.status !== 'in') return `Kunci digital Kamar ${r.no} aktif setelah Anda check-in. Ketik "check-in" untuk memulai.`;
  return null;
}

// ---------- Aksi (mengubah data) ----------
// Dipanggil hanya setelah pemeriksaan di atas lolos.

function doCheckin(g){
  const r = bookingOf(g);
  r.booking.status = 'in';
  r.booking.door = 'locked';   // kunci digital aktif, pintu masih terkunci
  log('door', g, `Check-in mandiri Kamar ${r.no} (${r.booking.folio}), kunci digital aktif`);
  return r;
}

function doCheckout(g){
  const r = bookingOf(g), folio = r.booking.folio;
  r.booking = null;            // pintu dikunci, kunci digital mati, kamar kembali tersedia
  log('door', g, `Check-out mandiri Kamar ${r.no} (${folio}), pintu dikunci, kamar kembali tersedia`);
  return r;
}

// state = 'open' (buka) atau 'locked' (kunci)
function setDoor(g, state){
  const r = bookingOf(g);
  r.booking.door = state;
  log('door', g, `${state === 'open' ? 'Membuka' : 'Mengunci'} pintu Kamar ${r.no}`);
  return r;
}

// ---------- Balasan untuk jalur aturan kata kunci ----------

async function selfCheckin(g){
  const p = checkinProblem(g);
  if (p){
    const r = bookingOf(g);
    const quick = !r ? [{label:'Pesan kamar'}] : !r.booking.paid ? [{label:'Bayar tagihan'}] : r.booking.status === 'in' ? DOOR_QUICK : [];
    return say(g, 'door', p, {quick});
  }
  const r = doCheckin(g), b = r.booking;
  return say(g, 'door', `Check-in berhasil, ${first(g)}. Selamat datang di Kamar ${r.no} (${r.type}).\nKunci digital aktif sampai ${fmtLong(b.out)} pukul 12.00. Pintu masih terkunci; tekan "Buka pintu" saat Anda sudah di depan kamar.`, {quick:DOOR_QUICK});
}

async function selfCheckout(g){
  const p = checkoutProblem(g);
  if (p) return say(g, 'door', p);
  const r = doCheckout(g);
  return say(g, 'door', `Check-out Kamar ${r.no} selesai. Pintu sudah dikunci dan kunci digital dinonaktifkan. Terima kasih telah menginap di Hotel Kencana, ${first(g)}.`);
}

// open = true untuk membuka pintu, false untuk mengunci
async function door(g, open){
  const p = doorProblem(g);
  if (p) return say(g, 'door', p);
  const r = bookingOf(g), state = open ? 'open' : 'locked';
  if (r.booking.door === state) return say(g, 'door', `Pintu Kamar ${r.no} memang sudah ${open ? 'terbuka' : 'terkunci'}.`, {quick:DOOR_QUICK});
  setDoor(g, state);
  return say(g, 'door', open
    ? `Pintu Kamar ${r.no} sudah terbuka. Jangan lupa ketik "kunci pintu" saat meninggalkan kamar.`
    : `Pintu Kamar ${r.no} sudah terkunci.`, {quick:DOOR_QUICK});
}
