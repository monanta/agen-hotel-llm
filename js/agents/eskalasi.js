/* ==========================================================
   Agen Eskalasi
   Meneruskan kasus ke Front Office Manager (staf manusia).
   Eskalasi muncul di antrean admin; balasan admin masuk ke chat tamu.
   ========================================================== */

// Dipakai jalur aturan kata kunci: membuat tiket dan langsung membalas tamu
//   question = pertanyaan/keluhan tamu yang diteruskan
//   reason   = alasan eskalasi (tampil di halaman admin)
//   via      = agen yang meneruskan ('orch' jika langsung dari Orkestrator)
async function escalate(g, question, reason, via){
  // Buat tiket baru di antrean eskalasi (tampil di halaman admin)
  const id = 'ESK-' + String(++escSeq).padStart(4,'0');
  const r = bookingOf(g);
  escalations.unshift({id, guestId:g.id, room:r ? r.no : null, question, reason, via, time:new Date(), status:'open', replies:[]});
  log('esc', g, `Meneruskan ${id} ke Front Office Manager (${reason.toLowerCase()})`);
  // Label di chat: "diserahkan Agen X" jika datang dari agen lain
  const route = via === 'orch' ? null : {handoff:AGENTS[via].name};
  // Langsung dari Orkestrator tanpa rute → berarti pesannya tidak dikenali
  if (via === 'orch' && !g.pendingRoute) g.pendingRoute = {label:'tidak dikenali', conf:0.31};
  g.lastRoute = {agent:'esc', label:reason.toLowerCase(), conf: g.pendingRoute?.conf ?? 1};
  await say(g, 'esc', `Pertanyaan Anda saya teruskan ke Front Office Manager dengan tiket ${id}. Staf akan membalas langsung di percakapan ini.`, route ? {route} : {});
}

// Dipakai jalur LLM: hanya mencatat tiket (nomor tiket sudah ditentukan di prompt)
// Teks balasan ke tamu sudah ditulis LLM, jadi fungsi ini tidak memanggil say().
function addEscalation(g, question, reason, via, id){
  const r = bookingOf(g);
  // Majukan penghitung supaya nomor tiket berikutnya tidak bentrok
  escSeq = Math.max(escSeq, parseInt(id.split('-')[1], 10));
  escalations.unshift({id, guestId:g.id, room:r ? r.no : null, question, reason, via, time:new Date(), status:'open', replies:[]});
  log('esc', g, `Meneruskan ${id} ke Front Office Manager (${reason.toLowerCase()})`);
  refreshBadge();
}
