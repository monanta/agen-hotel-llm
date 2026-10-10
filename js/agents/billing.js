/* ==========================================================
   Agen Billing
   Tagihan, folio, dan pembayaran (simulasi).
   ========================================================== */

// Tombol pilihan metode bayar. payload "pay:QRIS" diproses pay() di bawah
// (lewat handlePayload di orkestrator.js).
const PAY_QUICK = [{label:'Bayar dengan QRIS', payload:'pay:QRIS'}, {label:'Bayar dengan Transfer VA', payload:'pay:Transfer VA'}, {label:'Bayar dengan kartu kredit', payload:'pay:Kartu kredit'}, {label:'Bayar nanti', payload:'pay:later'}];

// Menerbitkan tagihan (kartu folio + tombol metode bayar).
// handoffFrom diisi nama agen sebelumnya jika ini hasil serah terima,
// mis. dari Agen Reservasi setelah kamar dipesan.
async function invoice(g, handoffFrom){
  const r = bookingOf(g);
  log('bill', g, `Menerbitkan tagihan ${r.booking.folio} sebesar ${rp(r.booking.total)}`);
  return say(g, 'bill', 'Berikut rincian tagihan Anda. Pilih metode pembayaran:', {
    folio:r.no, route: handoffFrom ? {handoff:handoffFrom} : undefined,
    quick:PAY_QUICK
  });
}

// Tamu menanyakan tagihan / mau bayar
async function billing(g){
  const r = bookingOf(g);
  if (!r) return say(g, 'bill', 'Anda belum punya tagihan karena belum ada pemesanan. Mau saya hubungkan ke Agen Reservasi?', {quick:[{label:'Pesan kamar'}]});
  if (r.booking.paid) return say(g, 'bill', `Folio ${r.booking.folio} sudah LUNAS (${rp(r.booking.total)} via ${r.booking.method}). Tidak ada tagihan tertunda.`, {folio:r.no});
  return invoice(g);
}

// Memproses pembayaran (simulasi, tidak ada transaksi sungguhan).
// method = 'QRIS' | 'Transfer VA' | 'Kartu kredit' | 'later' (bayar nanti)
async function pay(g, method){
  const r = bookingOf(g);
  if (!r) return say(g, 'bill', 'Tidak ada tagihan yang perlu dibayar.');
  const b = r.booking;
  if (b.paid) return say(g, 'bill', `Folio ${b.folio} sudah lunas sebelumnya.`);
  if (method === 'later') return say(g, 'bill', 'Baik. Tagihan tetap tersimpan dan bisa dibayar kapan saja dengan mengetik "bayar". Pemesanan tanpa pembayaran ditahan sampai pukul 18.00 sehari sebelum check-in.');
  // Tandai lunas di "database" kamar
  b.paid = true; b.method = method;
  log('bill', g, `Pembayaran ${b.folio} ${rp(b.total)} via ${method} (simulasi)`);
  return say(g, 'bill', `Pembayaran ${rp(b.total)} melalui ${method} diterima (simulasi). Folio ${b.folio} sekarang LUNAS.`, {folio:r.no, quick:[{label:'Check-in mandiri'}, {label:'Jam check-in?'}]});
}
