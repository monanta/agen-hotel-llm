/* ==========================================================
   main.js — pindah tab Pelanggan/Admin dan inisialisasi.
   Dimuat paling akhir.
   ========================================================== */

// Berpindah antara tampilan pelanggan ('cust') dan admin ('admin')
function setView(v){
  view = v;
  $('#tabCust').setAttribute('aria-pressed', v === 'cust');
  $('#tabAdmin').setAttribute('aria-pressed', v === 'admin');
  $('#viewCust').hidden = v !== 'cust';
  $('#viewAdmin').hidden = v !== 'admin';
  // Admin: tampilkan form login atau dasbor. Pelanggan: tampilkan chat atau registrasi.
  if (v === 'admin'){ $('#login').hidden = adminIn; $('#dash').hidden = !adminIn; renderAdmin(); if (!adminIn) $('#lgUser').focus(); }
  else if (cur){ renderMsgs(); renderAgents(); }
  else renderResume();
}
$('#tabCust').onclick = () => setView('cust');
$('#tabAdmin').onclick = () => setView('admin');

// Tampilan awal: halaman registrasi + badge eskalasi dari data contoh
renderResume(); refreshBadge();
// Jika dibuka di claude.ai, minta akses LLM bawaan (lihat sampleFn di llm.js)
if (window.claude && typeof window.claude.use === 'function'){
  window.claude.use('sample').then(s => { sampleFn = s; if (cur) renderAgents(); }).catch(() => {});
}
