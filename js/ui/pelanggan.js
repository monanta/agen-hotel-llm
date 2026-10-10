/* ==========================================================
   ui/pelanggan.js — tampilan pelanggan: registrasi dan chat
   Pola umumnya: data diubah dulu (di data.js / oleh agen), lalu
   fungsi render*() menggambar ulang HTML dari data tersebut.
   ========================================================== */

// Daftar tombol "lanjutkan percakapan" untuk tamu yang sudah terdaftar
function renderResume(){
  const list = Object.values(guests);
  $('#resumeList').innerHTML = list.map(g => {
    const r = bookingOf(g);
    return `<button class="chipbtn" type="button" data-g="${g.id}">${esc(g.name)}${r ? ' · Kamar ' + r.no : ''}</button>`;
  }).join('');
}
// Membuka chat milik tamu tertentu (sembunyikan form registrasi)
function openGuest(id){
  cur = id; const g = guests[id];
  $('#reg').hidden = true; $('#chat').hidden = false;
  $('#gName').textContent = g.name;
  renderMsgs(); renderAgents(); setComposer();
  $('#msgInput').focus();
}
// Baris info di bawah nama tamu: folio, kamar, tanggal, status bayar
function renderMeta(g){
  const r = bookingOf(g);
  if (!r){ $('#gMeta').textContent = 'Belum ada pemesanan'; return; }
  const b = r.booking;
  $('#gMeta').innerHTML = `<span class="mono">${b.folio}</span> · Kamar ${r.no} · ${fmtD(b.in)} – ${fmtD(b.out)} · ${b.paid ? '<span class="paid">Lunas</span>' : '<span class="unpaid">Belum bayar</span>'}`;
}
// Membuat HTML satu gelembung chat.
// isLast = pesan terakhir; hanya pesan terakhir yang tombolnya bisa diklik,
// supaya tamu tidak menekan tombol lama (mis. memilih kamar dua kali).
function bubbleHTML(m, isLast){
  const text = esc(m.text).replace(/\n/g, '<br>');
  // Pesan tamu: gelembung sederhana di kanan
  if (m.from === 'guest') return `<div class="msg guest"><div class="bubble">${text}</div><div class="time">${fmtT(m.time)}</div></div>`;
  // Pesan agen: nama agen + label rute + isi + tambahan (kartu kamar / folio / tombol)
  const a = AGENTS[m.from];
  let route = '';
  if (m.route?.handoff) route = `diserahkan ${esc(m.route.handoff)}`;
  else if (m.route?.label) route = `dipilih Orkestrator${m.route.llm ? ' (LLM)' : ''} · ${esc(m.route.label)} · ${m.route.conf.toFixed(2)}`;
  let extra = '';
  // Kartu pilihan kamar (dari Agen Reservasi)
  if (m.rooms){
    extra += `<div class="roomopts">${m.rooms.map(no => { const r = roomBy(no); const taken = !!r.booking && isLast;
      return `<button class="roomopt" type="button" data-pay="room:${no}" ${(!isLast || taken) ? 'disabled' : ''}><span><span class="no">${no}</span>${r.type}</span><span class="pr">${rp(r.price)} × ${m.nights} = ${rp(r.price*m.nights)}</span></button>`; }).join('')}</div>`;
  }
  // Rincian tagihan/folio (dari Agen Billing). Selalu membaca data terbaru,
  // jadi status berubah jadi LUNAS setelah dibayar.
  if (m.folio){
    const r = roomBy(m.folio); const b = r.booking;
    if (b) extra += `<div class="folio" aria-label="Rincian folio">
      <div><span>Folio</span><span>${b.folio}</span></div>
      <div><span>Kamar ${r.no} · ${r.type}</span><span>${b.nights} malam</span></div>
      <div><span>${fmtD(b.in)} → ${fmtD(b.out)}</span><span>${rp(r.price)}/mlm</span></div>
      <div class="tot"><span>Total</span><span>${rp(b.total)}</span></div>
      <div><span>Status</span><span>${b.paid ? 'LUNAS · ' + esc(b.method) : 'MENUNGGU PEMBAYARAN'}</span></div></div>`;
  }
  // Tombol saran balasan
  if (m.quick && isLast && !busy){
    extra += `<div class="quick">${m.quick.map(q => `<button type="button" data-q="${esc(q.label)}" ${q.payload ? `data-pay="${esc(q.payload)}"` : ''}>${esc(q.label)}</button>`).join('')}</div>`;
  }
  return `<div class="msg bot a-${m.from}">
    <div class="who"><span class="dot"></span>${a.name}${m.from==='human' ? ' <span class="human-tag">Manusia</span>' : ''}${route ? ` <span class="route">· ${route}</span>` : ''}</div>
    <div class="bubble">${text}${extra}</div><div class="time">${fmtT(m.time)}</div></div>`;
}
// Menggambar ulang seluruh isi chat tamu yang sedang dibuka,
// ditambah indikator "sedang mengetik" jika ada agen yang sedang memproses
function renderMsgs(){
  const g = guests[cur]; if (!g) return;
  const box = $('#msgs');
  const last = g.messages.length - 1;
  let html = g.messages.map((m,i) => bubbleHTML(m, i === last && !g.typing)).join('');
  if (g.typing) html += `<div class="typing a-${g.typing}"><span class="dot"></span>${AGENTS[g.typing].name} ${g.typing === 'orch' ? 'membaca pesan dan memilih agen' : 'sedang mengetik'} <i></i><i></i><i></i></div>`;
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
  renderMeta(g);
}
// Panel samping (#agentPanel di index.html): daftar agen, rute terakhir,
// dan sakelar LLM untuk membandingkan balasan LLM dengan aturan kata kunci.
function renderAgents(){
  const g = guests[cur]; if (!g || !$('#agentPanel')) return;
  const lastBot = [...g.messages].reverse().find(m => m.from !== 'guest');
  const active = g.typing || lastBot?.from;
  const counts = {}; g.messages.forEach(m => { counts[m.from] = (counts[m.from]||0) + 1; });
  counts.orch = g.messages.filter(m => m.route?.label).length;
  const lr = g.lastRoute;
  // LLM tersedia jika ada akses claude.ai (sampleFn) atau server /api/chat (Gemini)
  const llmReady = !!(sampleFn || serverLLM);
  const llmName = sampleFn ? 'Claude' : 'Gemini';
  $('#agentPanel').innerHTML = `<h2>Agen di percakapan ini</h2>
    <p class="muted" style="margin:0;font-size:12.5px">Angka = jumlah pesan yang ditangani</p>
    <ul class="ag-list">${ORDER.map(k => `<li class="a-${k} ${k===active ? 'active' : ''}"><span class="dot"></span><span class="nm">${AGENTS[k].name}</span><span class="ct">${counts[k]||0}</span><span class="rl">${k===active ? 'Sedang menangani' : AGENTS[k].role}</span></li>`).join('')}</ul>
    <div class="trace"><div class="eyebrow" style="margin-bottom:4px">Rute terakhir</div>${lr ? `<span class="a-${lr.agent}"><span class="dot"></span></span> ${AGENTS[lr.agent].name}<br><span class="muted">${esc(lr.label)}</span> · <span class="mono">${lr.conf.toFixed(2)}</span>` : '<span class="muted">Belum ada pesan</span>'}</div>
    <div class="engine">
      <div class="eyebrow" style="margin-bottom:6px">Mesin balasan</div>
      <label class="switch" for="llmToggle"><input type="checkbox" id="llmToggle" ${useLLM && llmReady ? 'checked' : ''} ${llmReady ? '' : 'disabled'}><span>Balasan natural dengan LLM${llmReady ? ' (' + llmName + ')' : ''}</span></label>
      <p class="eng-note">${llmReady ? (useLLM ? 'Orkestrator dan agen memakai LLM. Aksi pemesanan, pembayaran, dan eskalasi tetap dieksekusi sistem.' : 'Memakai aturan kata kunci lokal.') : 'LLM tidak tersedia di tampilan ini, memakai aturan kata kunci lokal.'}${llmNote ? `<br><span class="warnline">${esc(llmNote)}</span>` : ''}</p>
    </div>`;
  // Sakelar diubah → simpan pilihan; pesan berikutnya memakai mesin yang dipilih (lihat handle() di orkestrator.js)
  const t = $('#llmToggle'); if (t) t.onchange = () => { useLLM = t.checked; llmNote = ''; renderAgents(); };
}
// Kunci kolom ketik selama agen memproses pesan, buka lagi setelah selesai
function setComposer(){
  $('#sendBtn').disabled = busy;
  $('#msgInput').disabled = busy;
  if (!busy && view === 'cust' && !$('#chat').hidden) $('#msgInput').focus({preventScroll:true});
}

/* ---------- Event ---------- */
// Registrasi: nama yang sudah ada → lanjutkan chat lama; nama baru → tamu baru
// disambut Agen Concierge
$('#regForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#regName').value.trim().replace(/\s+/g, ' ');
  if (name.length < 2){ $('#regErr').hidden = false; $('#regName').focus(); return; }
  $('#regErr').hidden = true;
  let g = Object.values(guests).find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!g){
    g = newGuest(name);
    log('orch', g, 'Tamu baru terdaftar, sesi percakapan dibuat');
    g.messages.push({from:'conc', time:new Date(), text:`Selamat datang di Hotel Kencana, ${first(g)}. Saya Agen Concierge. Tulis saja kebutuhan Anda: pesan kamar, bayar tagihan, sampaikan keluhan, atau tanya fasilitas. Pesan Anda akan dijawab agen yang paling sesuai.`, quick:menuQuick()});
    g.lastRoute = {agent:'conc', label:'sambutan', conf:1};
  }
  $('#regName').value = '';
  openGuest(g.id);
});
$('#resumeList').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) openGuest(b.dataset.g); });
$('#switchGuest').onclick = () => { cur = null; $('#chat').hidden = true; $('#reg').hidden = false; renderResume(); $('#regName').focus(); };
// Tamu mengetik pesan lalu menekan Kirim
$('#composer').addEventListener('submit', e => { e.preventDefault(); const v = $('#msgInput').value; $('#msgInput').value = ''; send(v); });
// Tamu menekan tombol di dalam chat (kartu kamar atau tombol saran).
// Teks tombol dikirim sebagai pesan, payload-nya (data-pay) ikut dikirim.
$('#msgs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled || busy) return;
  if (b.classList.contains('roomopt')){ const no = b.dataset.pay.split(':')[1]; send('Saya pilih Kamar ' + no, b.dataset.pay); return; }
  if (b.dataset.q) send(b.dataset.q, b.dataset.pay);
});
