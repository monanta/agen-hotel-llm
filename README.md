# Agen Hotel LLM — CS Hotel Kencana

Prototipe customer service hotel berbasis **sistem multiagen** dengan balasan natural dari LLM (Google Gemini API).
Tugas Kelompok 5, mata kuliah Agen Cerdas Enterprise, Magister Kecerdasan Artifisial UGM.

## Fitur

**Sisi pelanggan**
- Registrasi cukup dengan nama.
- Chat untuk pemesanan kamar, pembayaran (simulasi), keluhan, dan pertanyaan umum.
- Setiap balasan diberi label agen yang menjawab, beserta niat dan tingkat keyakinan dari Orkestrator.

**Sisi admin** (akun demo `admin` / `kencana`)
- Papan 5 kamar: status (Tersedia / Sudah dipesan / Terisi), nama tamu, tanggal masuk dan keluar, status bayar.
- Antrean pertanyaan yang dieskalasi ke manusia. Balasan admin langsung muncul di chat tamu.
- Log aktivitas agen.

## Arsitektur agen

| Agen | Tugas |
|---|---|
| Orkestrator | Membaca maksud pesan lalu memilih agen |
| Agen Reservasi | Cek kamar kosong, buat dan batalkan pemesanan |
| Agen Billing | Tagihan, folio, pembayaran |
| Agen Layanan Kamar | Keluhan dan housekeeping |
| Agen Concierge | Info hotel dan fasilitas |
| Agen Eskalasi | Meneruskan kasus ke Front Office Manager (manusia) |

Alurnya: pesan tamu → Orkestrator (LLM) mengembalikan JSON berisi agen, niat, teks balasan, dan **aksi** →
aksi (pesan kamar, bayar, batal, tiket, eskalasi) divalidasi dan dijalankan oleh kode, bukan oleh LLM.
Jadi LLM tidak bisa memesan kamar yang sudah terisi atau mengaku sudah menerima bayaran.

Kalau LLM tidak tersedia (API key belum diatur, kuota habis, atau dibuka sebagai file lokal),
sistem otomatis memakai aturan kata kunci.

## Struktur

```
index.html      Halaman (UI pelanggan + admin, logika agen)
api/chat.js     Fungsi server Vercel yang memanggil Gemini API
.env.example    Contoh environment variable
```

## Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new), impor repo ini dari GitHub.
2. Framework preset: **Other**. Build command dan output directory dikosongkan.
3. Di **Environment Variables**, tambahkan:
   - `GEMINI_API_KEY` = API key gratis dari [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - `GEMINI_MODEL` (opsional), default `gemini-3.8-flash`
4. Klik **Deploy**. Setiap push ke branch `main` akan otomatis di-deploy ulang.

## Menjalankan lokal

```bash
npm i -g vercel
cp .env.example .env.local   # isi API key
vercel dev
```

Buka http://localhost:3000. Membuka `index.html` langsung tanpa server juga bisa, tapi balasan memakai aturan kata kunci.

## Catatan

- Data (kamar, tamu, eskalasi) tersimpan di memori browser dan hilang saat halaman di-refresh.
  Tampilan pelanggan dan admin harus di tab yang sama.
- Kamar 102 dan 201 beserta tamu Budi Santoso dan Sari Wulandari adalah data contoh.
- Pembayaran hanya simulasi.
- Kuota gratis Gemini terbatas per project. Kalau kuota habis, balasan sementara memakai aturan kata kunci.
  Data di kuota gratis dapat dipakai Google untuk pengembangan produk, jadi jangan masukkan data pribadi sungguhan.
