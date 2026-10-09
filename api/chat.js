// Fungsi server (Vercel) yang meneruskan prompt Orkestrator ke Claude API.
// API key hanya ada di environment variable server, tidak pernah dikirim ke browser.
//
// Environment variable:
//   ANTHROPIC_API_KEY  (wajib)  API key dari console.anthropic.com
//   ANTHROPIC_MODEL    (opsional) default: claude-haiku-5-5

const MAX_PROMPT_CHARS = 30000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Gunakan metode POST.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // 404 membuat halaman otomatis beralih ke aturan kata kunci lokal.
    return res.status(404).json({ error: 'ANTHROPIC_API_KEY belum diatur di server.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) return res.status(400).json({ error: 'Prompt kosong.' });
  if (prompt.length > MAX_PROMPT_CHARS) return res.status(413).json({ error: 'Prompt terlalu panjang.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: 'Kamu adalah mesin orkestrasi multiagen layanan pelanggan hotel. Selalu balas dengan satu objek JSON valid sesuai format yang diminta, tanpa teks lain.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (r.status === 429) return res.status(429).json({ error: 'Batas pemakaian API tercapai.' });
    if (!r.ok) {
      const detail = await r.text();
      console.error('Claude API error', r.status, detail.slice(0, 500));
      return res.status(502).json({ error: 'Claude API gagal menjawab.' });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return res.status(200).json({ text, model: data.model });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Tidak bisa menghubungi Claude API.' });
  }
}
