/* ==========================================================
   ui/admin.js — tampilan admin: papan kamar, eskalasi, log agen
   ========================================================== */

// Angka merah di tab Admin = jumlah eskalasi yang belum dibalas
function refreshBadge(){
  const n = escalations.filter(e => e.status === 'open').length;
  $('#escBadge').textContent = n ? n : '';
}
// Label & warna status kamar: Tersedia / Sudah dipesan / Terisi
function statusOf(r){
  if (!r.booking) return {cls:'st-free', label:'Tersedia'};
  return r.booking.status === 'in' ? {cls:'st-in', label:'Terisi'} : {cls:'st-booked', label:'Sudah dipesan'};
}
// Menggambar ulang seluruh halaman admin (hanya jika sudah login)
function renderAdmin(){
  refreshBadge();
  if (!adminIn) return;
  // --- Ringkasan jumlah kamar per status ---
  $('#dashDate').textContent = fmtLong(today) + ' · ' + fmtT(new Date());
  const cnt = {free:0, booked:0, in:0};
  rooms.forEach(r => { if (!r.booking) cnt.free++; else cnt[r.booking.status === 'in' ? 'in' : 'booked']++; });
  const open = escalations.filter(e => e.status === 'open').length;
  $('#summary').innerHTML = `<span>Terisi <b>${cnt.in}</b></span><span>Sudah dipesan <b>${cnt.booked}</b></span><span>Tersedia <b>${cnt.free}</b></span><span>Eskalasi menunggu <b>${open}</b></span>`;

  // --- Papan kamar: satu kartu per kamar (tamu, tanggal, bayar, eskalasi, tombol check-in/out) ---
  $('#rooms').innerHTML = rooms.map(r => {
    const s = statusOf(r), b = r.booking;
    const escs = escalations.filter(e => e.room === r.no && e.status !== 'done');
    let body;
    if (!b) body = `<p class="empty">Siap dijual · ${rp(r.price)}/malam</p>`;
    else {
      const g = guests[b.guestId]; const soon = rel(b.out);
      body = `<dl class="kv">
        <dt>Tamu</dt><dd>${esc(g.name)}</dd>
        <dt>Masuk</dt><dd>${fmtD(b.in)}</dd>
        <dt>Keluar</dt><dd class="${soon ? 'soon' : ''}">${fmtD(b.out)} · 12.00${soon ? ' (' + soon + ')' : ''}</dd>
        <dt>Folio</dt><dd class="mono">${b.folio}</dd>
        <dt>Bayar</dt><dd class="${b.paid ? 'paid' : 'unpaid'}">${b.paid ? 'Lunas' : 'Belum lunas'}</dd></dl>`;
    }
    const escBox = escs.length ? `<div class="tag-esc"><b>${escs.length} eskalasi${escs[0].status==='open' ? ' menunggu' : ''}</b>"${esc(escs[0].question.length > 70 ? escs[0].question.slice(0,70) + '…' : escs[0].question)}"</div>` : '';
    const act = !b ? '' : b.status === 'booked'
      ? `<button class="ghost" type="button" data-act="in:${r.no}">Check-in</button>`
      : `<button class="ghost" type="button" data-act="out:${r.no}">Check-out</button>`;
    return `<article class="tag" aria-label="Kamar ${r.no}">
      <div><div class="no">${r.no}</div><div class="ty">${r.type}</div></div>
      <span class="chip ${s.cls}">${s.label}</span>${body}${escBox}
      ${act ? `<div class="tag-actions">${act}</div>` : ''}</article>`;
  }).join('');

  // --- Antrean eskalasi: yang belum selesai di atas, terbaru dulu ---
  const sorted = [...escalations].sort((a,b) => (a.status==='done') - (b.status==='done') || b.time - a.time);
  $('#escCount').textContent = `${open} menunggu · ${escalations.length} total`;
  $('#escList').innerHTML = sorted.length ? sorted.map(e => {
    const g = guests[e.guestId];
    const st = e.status === 'open' ? ['st-open','Menunggu'] : e.status === 'replied' ? ['st-rep','Sudah dibalas'] : ['st-done','Selesai'];
    return `<article class="esc ${e.status==='done' ? 'done' : ''}">
      <div class="esc-top"><span><span class="mono">${e.id}</span> · <b>${esc(g.name)}</b> · ${e.room ? 'Kamar ' + e.room : 'tanpa kamar'} · ${fmtT(e.time)}</span>
        <span class="chip ${st[0]}">${st[1]}</span></div>
      <p class="q">${esc(e.question)}</p>
      <div class="ctx">Alasan: ${esc(e.reason)} · diteruskan oleh ${e.via==='orch' ? 'Orkestrator' : AGENTS[e.via].name}</div>
      ${e.replies.length ? `<div class="replies">${e.replies.map(rp_ => `<div class="reply"><small>Balasan staf · ${fmtT(rp_.t)}</small>${esc(rp_.text)}</div>`).join('')}</div>` : ''}
      ${e.status !== 'done' ? `<label for="rep-${e.id}" style="margin:0">Balas ke ${esc(first(g))}</label>
      <textarea id="rep-${e.id}" data-draft="${e.id}" placeholder="Tulis jawaban staf…">${esc(drafts[e.id] || '')}</textarea>
      <div class="esc-actions"><button class="btn" type="button" data-reply="${e.id}">Kirim balasan</button><button class="ghost" type="button" data-done="${e.id}">Tandai selesai</button></div>` : ''}
    </article>`;
  }).join('') : `<div class="empty-state">Belum ada pertanyaan yang diteruskan ke staf. Pertanyaan yang tidak bisa dijawab agen akan muncul di sini.</div>`;

  // --- Log aktivitas agen + jumlah aktivitas per agen ---
  const load = {}; logs.forEach(l => load[l.agent] = (load[l.agent]||0) + 1);
  $('#loads').innerHTML = ORDER.filter(k => load[k]).map(k => `<span class="a-${k}"><span class="dot"></span>${AGENTS[k].name} <b class="mono">${load[k]}</b></span>`).join('');
  $('#log').innerHTML = logs.map(l => `<li class="a-${l.agent}"><span class="t">${fmtT(l.t)}</span><span class="an">${AGENTS[l.agent].name}</span><span class="tx">${esc(l.text)}${l.guest ? ` <small>· ${esc(l.guest)}</small>` : ''}</span></li>`).join('');
}

/* ---------- Event ---------- */
// Login admin. Akun demo ditulis langsung di kode (hanya untuk prototipe, tidak aman).
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  if ($('#lgUser').value.trim() === 'admin' && $('#lgPass').value === 'kencana'){
    adminIn = true; $('#lgErr').hidden = true; $('#lgPass').value = ''; setView('admin');
  } else { $('#lgErr').hidden = false; }
});
$('#logout').onclick = () => { adminIn = false; setView('admin'); };

// Simpan draf balasan saat admin mengetik (supaya tidak hilang saat halaman digambar ulang)
$('#viewAdmin').addEventListener('input', e => { if (e.target.dataset.draft) drafts[e.target.dataset.draft] = e.target.value; });
// Semua tombol di halaman admin ditangani di sini
$('#viewAdmin').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  // Kirim balasan staf → masuk ke chat tamu sebagai pesan "Front Office Manager"
  if (b.dataset.reply){
    const id = b.dataset.reply, txt = (drafts[id] || '').trim();
    const ta = document.getElementById('rep-' + id);
    if (!txt){ ta.focus(); ta.placeholder = 'Tulis balasan dulu sebelum mengirim.'; return; }
    const x = escalations.find(z => z.id === id), g = guests[x.guestId];
    x.replies.push({text:txt, t:new Date()}); x.status = 'replied'; drafts[id] = '';
    g.messages.push({from:'human', text:txt, time:new Date(), route:{handoff:'Agen Eskalasi · ' + id}});
    g.lastRoute = {agent:'human', label:'jawaban staf ' + id, conf:1};
    log('human', g, `Membalas ${id}`);
    renderAdmin(); return;
  }
  // Tandai eskalasi selesai
  if (b.dataset.done){
    const x = escalations.find(z => z.id === b.dataset.done); x.status = 'done';
    log('human', guests[x.guestId], `Menutup ${x.id}`); renderAdmin(); return;
  }
  // Check-in / check-out tamu dari papan kamar.
  // Check-out mengosongkan kamar dan mengirim ucapan terima kasih ke chat tamu.
  if (b.dataset.act){
    const [k, no] = b.dataset.act.split(':'); const r = roomBy(no), g = guests[r.booking.guestId];
    if (k === 'in'){ r.booking.status = 'in'; log('human', g, `Check-in Kamar ${no} (${r.booking.folio})`); }
    else {
      log('human', g, `Check-out Kamar ${no} (${r.booking.folio}), kamar kembali tersedia`);
      g.messages.push({from:'res', text:`Check-out Kamar ${no} sudah tercatat. Terima kasih telah menginap di Hotel Kencana, ${first(g)}.`, time:new Date()});
      r.booking = null;
    }
    renderAdmin();
  }
});
