/* ==========================================================
   Orkestrator
   Membaca maksud (niat) setiap pesan tamu lalu memilih agen.
   Ada dua mesin:
   1. LLM (lihat llm.js) — dipakai bila tersedia.
   2. Aturan kata kunci (INTENTS + classify di bawah) — cadangan.
   ========================================================== */

// Daftar niat (intent) untuk jalur aturan kata kunci.
//   key   = nama niat
//   agent = agen yang menangani niat ini
//   label = teks yang tampil di chat ("dipilih Orkestrator · pembayaran")
//   kw    = kata kunci pemicu
// Urutan menentukan prioritas jika jumlah kata yang cocok sama.
const INTENTS = [
  {key:'human',     agent:'esc',  label:'minta staf manusia', kw:['manusia','petugas','staf','staff','manajer','manager','operator','bicara dengan orang','orang asli']},
  {key:'cancel',    agent:'res',  label:'pembatalan',        kw:['batal','cancel','membatalkan','refund','uang kembali','pengembalian dana']},
  {key:'pay',       agent:'bill', label:'pembayaran',        kw:['bayar','pembayaran','dibayar','transfer','tagihan','invoice','qris','kartu kredit','lunas','folio','struk']},
  {key:'complaint', agent:'care', label:'keluhan',           kw:['komplain','keluhan','rusak','kotor','bocor','berisik','bising','tidak berfungsi','tidak menyala','mati','bau','kecewa','lambat','handuk','bantal','selimut','sabun','air panas','tidak keluar','kecoa','semut','ac','tv','lampu','toilet','kloset','wastafel']},
  {key:'book',      agent:'res',  label:'pemesanan kamar',   kw:['pesan kamar','memesan','pesan','booking','book','reservasi','menginap','nginap','kamar kosong','kamar tersedia','ketersediaan','sewa kamar','cari kamar','mau kamar']},
  {key:'price',     agent:'res',  label:'tarif kamar',       kw:['harga','tarif','per malam','biaya kamar','tipe kamar','jenis kamar']},
  // Akses kamar mandiri. Diletakkan sebelum 'faq' supaya "check-in" (perintah) menang
  // atas FAQ jam check-in saat skornya sama; pertanyaan "jam check-in?" dibelokkan ke FAQ di handle().
  {key:'unlock',    agent:'door', label:'buka pintu',        kw:['buka pintu','bukakan pintu','bukain pintu','buka kamar','buka kunci','unlock']},
  {key:'lock',      agent:'door', label:'kunci pintu',       kw:['kunci pintu','kunci kamar','kuncikan','tutup pintu','lock']},
  {key:'checkin',   agent:'door', label:'check-in mandiri',  kw:['check in','checkin','cek in']},
  {key:'checkout',  agent:'door', label:'check-out mandiri', kw:['check out','checkout','cek out','keluar kamar']},
  {key:'faq',       agent:'conc', label:'informasi hotel',   kw:FAQ.flatMap(f => f.kw)},   // semua kata kunci FAQ di concierge.js
  {key:'greet',     agent:'conc', label:'sapaan',            kw:['halo','hallo','hai','hi','selamat pagi','selamat siang','selamat sore','selamat malam','permisi','assalamualaikum','terima kasih','makasih','thanks','thank you']},
];

// Menebak niat pesan dengan menghitung kata kunci yang cocok.
// Niat dengan kecocokan terbanyak menang. Tingkat keyakinan (conf, 0–1):
//   - makin banyak kata cocok → makin yakin
//   - ada niat lain yang juga cocok (pesan ambigu) → kurang yakin
// Tidak ada yang cocok → niat 'unknown', diteruskan ke Agen Eskalasi.
function classify(text){
  const n = norm(text);
  const scored = INTENTS.map(it => ({...it, hits: it.kw.filter(k => hit(n, k)).length}));
  const sorted = [...scored].sort((a,b) => b.hits - a.hits);
  const best = sorted[0];
  if (!best.hits) return {key:'unknown', agent:'esc', label:'tidak dikenali', conf:0.31, n};
  const second = sorted[1].hits;
  const conf = Math.min(0.97, 0.6 + best.hits*0.12 + (second ? 0 : 0.1) - second*0.05);
  return {...best, conf:Math.round(conf*100)/100, n};
}

// Mencatat keputusan rute Orkestrator: label rute akan ditempel ke balasan
// agen berikutnya (lihat say() di chat.js) dan dicatat di log admin.
function setRoute(g, agent, label, conf, text){
  g.pendingRoute = {label, conf};
  g.lastRoute = {agent, label, conf};
  const short = text.length > 38 ? text.slice(0,38) + '…' : text;
  log('orch', g, `"${short}" → ${AGENTS[agent].name} (${label}, ${conf.toFixed(2)})`);
}

// ============ Titik masuk utama: setiap pesan tamu diproses di sini ============
async function handle(g, text, payload){
  // --- Jalur 1: LLM ---
  // Jika LLM aktif, seluruh pesan ditangani llmHandle() di llm.js.
  // Kalau gagal, catat alasannya lalu lanjut ke jalur 2 (aturan kata kunci).
  if (useLLM && (sampleFn || serverLLM)){
    try { return await llmHandle(g, text); }
    catch (e){
      g.typing = null;
      const code = e && e.code;
      if (['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(code)){
        // Izin LLM di claude.ai ditolak → matikan LLM untuk sesi ini
        sampleFn = null; llmNote = 'Izin LLM tidak diberikan, memakai aturan lokal.';
      } else if (code === 'no_server'){
        // /api/chat tidak ada (mis. dibuka sebagai file lokal) → matikan LLM untuk sesi ini
        serverLLM = false; llmNote = 'Server LLM tidak tersedia, memakai aturan lokal.';
      } else if (code === 'rate_limited'){
        // Kuota habis → pesan ini saja yang pakai aturan lokal, berikutnya coba LLM lagi
        llmNote = 'Batas pemakaian LLM tercapai, pesan ini dijawab aturan lokal.';
      } else {
        llmNote = 'LLM gagal menjawab pesan terakhir, dijawab aturan lokal.';
      }
      log('orch', g, 'Fallback ke aturan lokal (' + (code || 'error') + ')');
      renderAgents();
    }
  }

  // --- Jalur 2: aturan kata kunci ---
  // Pesan dari tombol cepat membawa payload, langsung diproses tanpa klasifikasi
  if (payload) return handlePayload(g, payload, text);

  let c = classify(text);
  // "Jam check-in berapa?" atau "boleh late check-out?" adalah pertanyaan info (Concierge),
  // bukan perintah check-in/check-out
  if ((c.key === 'checkin' || c.key === 'checkout') && / (jam|kapan|pukul|berapa|early|late) /.test(c.n)){
    c = {...c, key:'faq', agent:'conc', label:'informasi hotel'};
  }

  // Alur pemesanan yang sedang berjalan
  // Jika Agen Reservasi sedang menanyakan tanggal/malam/kamar, jawaban tamu
  // ("besok", "2", "101") dibaca sebagai jawaban, bukan pesan baru.
  if (g.flow && g.flow.type === 'book'){
    const f = g.flow;
    if (f.step === 'date'){
      const d = parseDate(text, true);
      if (d){ f.in = d; const n = parseNights(text); if (n) f.nights = n; return bookStep(g); }
    } else if (f.step === 'nights'){
      const n = parseNights(text, true);
      if (n){ f.nights = n; return bookStep(g); }
    } else if (f.step === 'room'){
      const m = text.match(/\b(101|102|201|202|301)\b/);
      if (m) return createBooking(g, m[1]);
    }
    // Jawaban tidak dipahami dan bukan topik lain → minta ulang
    if (c.key === 'unknown' || c.key === 'book'){
      g.pendingRoute = {label:'melanjutkan pemesanan', conf:0.8};
      await say(g, 'res', 'Maaf, saya belum menangkap jawabannya. ' + (f.step==='date' ? 'Tulis tanggal check-in, misalnya "besok" atau "tanggal 15".' : f.step==='nights' ? 'Tulis jumlah malam, misalnya "2 malam".' : 'Pilih salah satu nomor kamar di atas.'));
      return;
    }
    g.flow = null; // pindah topik, alur dihentikan
  }

  setRoute(g, c.agent, c.label, c.conf, text);

  // Serahkan pesan ke agen sesuai niat
  switch (c.key){
    case 'human':     return escalate(g, text, 'Tamu minta bicara dengan staf', 'orch');   // Agen Eskalasi
    case 'cancel':    return cancelBooking(g, text);   // Agen Reservasi
    case 'pay':       return billing(g);               // Agen Billing
    case 'complaint': return complaint(g, text);       // Agen Layanan Kamar
    case 'book':      return startBooking(g, text);    // Agen Reservasi
    case 'price':     return priceList(g);             // Agen Reservasi
    case 'faq':       return faq(g, c.n);              // Agen Concierge
    case 'greet':     return greet(g, c.n);            // Agen Concierge
    case 'checkin':   return selfCheckin(g);           // Agen Akses Kamar
    case 'checkout':  return selfCheckout(g);          // Agen Akses Kamar
    case 'unlock':    return door(g, true);            // Agen Akses Kamar
    case 'lock':      return door(g, false);           // Agen Akses Kamar
    default:          return escalate(g, text, 'Di luar kemampuan agen', 'orch');   // tidak dikenali → manusia
  }
}

// Tombol cepat di chat mengirim payload "jenis:nilai", misal "room:101" atau "pay:QRIS"
//   date:2026-10-11  → tanggal check-in dipilih
//   n:2              → jumlah malam dipilih
//   room:101         → kamar dipilih
//   pay:QRIS         → metode bayar dipilih
//   newbook          → pesan kamar tambahan
//   cancel:yes/no    → konfirmasi pembatalan
//   complainHint     → tamu menekan "Sampaikan keluhan"
async function handlePayload(g, p, text){
  const [k, v] = p.split(':');
  const f = g.flow;
  if (k === 'date' && f){ f.in = fromIso(v); return bookStep(g); }
  if (k === 'n' && f){ f.nights = Number(v); return bookStep(g); }
  if (k === 'room'){ return createBooking(g, v); }
  if (k === 'pay'){ return pay(g, v); }
  if (k === 'newbook'){ g.flow = {type:'book', step:'date'}; return bookStep(g); }
  if (k === 'cancel'){ return confirmCancel(g, v === 'yes'); }
  if (k === 'complainHint'){
    g.pendingRoute = {label:'keluhan', conf:0.9};
    return say(g, 'care', 'Silakan ceritakan keluhannya, misalnya "handuk belum diganti" atau "AC tidak dingin". Saya akan langsung buatkan tiket.');
  }
}
