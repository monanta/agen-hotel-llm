/* ==========================================================
   chat.js — mengirim pesan tamu dan menampilkan balasan agen
   say()  : agen menulis balasan (dengan animasi "sedang mengetik")
   send() : pesan tamu masuk, lalu diteruskan ke Orkestrator
   ========================================================== */

// Agen mengirim balasan ke tamu g.
//   agent = kunci agen penulis ('res', 'bill', ...)
//   extra = isi tambahan pesan, misalnya:
//     quick : tombol saran balasan  [{label, payload?}]
//     rooms : daftar nomor kamar yang bisa dipilih (kartu kamar)
//     folio : nomor kamar yang rincian tagihannya ditampilkan
//     route : info rute ("dipilih Orkestrator" / "diserahkan Agen X")
//     _fast : jeda mengetik dipersingkat (dipakai jalur LLM)
async function say(g, agent, text, extra = {}){
  const fast = extra._fast; delete extra._fast;
  // 1. Tampilkan indikator "Agen X sedang mengetik…"
  g.typing = agent;
  if (g.id === cur) renderMsgs();
  // 2. Jeda sebentar, makin panjang teks makin lama (maks. 1,1 detik)
  await sleep(REDUCE ? 100 : fast ? 260 : Math.min(1100, 380 + text.length * 5));
  // 3. Simpan pesan ke riwayat chat tamu
  g.typing = null;
  const m = {from:agent, text, time:new Date(), ...extra};
  // Pesan pertama setelah Orkestrator memilih rute diberi label rute tersebut
  if (g.pendingRoute && !m.route){ m.route = g.pendingRoute; g.pendingRoute = null; }
  g.messages.push(m);
  // 4. Gambar ulang tampilan
  if (g.id === cur){ renderMsgs(); renderAgents(); }
  refreshBadge();
}

// Titik masuk setiap pesan tamu (dari kolom ketik atau tombol cepat).
//   payload = data tersembunyi dari tombol, mis. "room:101" atau "pay:QRIS"
async function send(text, payload){
  const g = guests[cur];
  if (!g || busy) return;          // abaikan jika agen masih memproses pesan sebelumnya
  const t = text.trim();
  if (!t) return;
  g.messages.push({from:'guest', text:t, time:new Date()});
  busy = true; renderMsgs(); setComposer();   // kunci input selama diproses
  try { await handle(g, t, payload); }       // serahkan ke Orkestrator (agents/orkestrator.js)
  finally { busy = false; renderMsgs(); renderAgents(); setComposer(); if (view==='admin') renderAdmin(); }
}
