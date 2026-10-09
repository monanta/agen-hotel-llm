// Fungsi server (Vercel) yang meneruskan prompt Orkestrator ke Gemini API.
// API key hanya ada di environment variable server, tidak pernah dikirim ke browser.
//
// Environment variable:
//   GEMINI_API_KEY  (wajib)    API key gratis dari https://aistudio.google.com/apikey
//   GEMINI_MODEL    (opsional) default: gemini-3.8-flash

const MAX_PROMPT_CHARS = 30000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Gunakan metode POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // 404 membuat halaman otomatis beralih ke aturan kata kunci lokal.
    return res.status(404).json({ error: 'GEMINI_API_KEY belum diatur di server.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) return res.status(400).json({ error: 'Prompt kosong.' });
  if (prompt.length > MAX_PROMPT_CHARS) return res.status(413).json({ error: 'Prompt terlalu panjang.' });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'Kamu adalah mesin orkestrasi multiagen layanan pelanggan hotel. Selalu balas dengan satu objek JSON valid sesuai format yang diminta, tanpa teks lain.' }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.6,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (r.status === 429) return res.status(429).json({ error: 'Kuota Gemini tercapai, coba lagi sebentar.' });
    if (!r.ok) {
      const detail = await r.text();
      console.error('Gemini API error', r.status, detail.slice(0, 500));
      return res.status(502).json({ error: 'Gemini API gagal menjawab.' });
    }

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
    if (!text.trim()) {
      console.error('Gemini empty response', JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: 'Gemini tidak mengembalikan teks.' });
    }
    return res.status(200).json({ text, model: MODEL });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Tidak bisa menghubungi Gemini API.' });
  }
}
