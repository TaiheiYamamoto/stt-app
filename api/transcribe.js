// /api/transcribe.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { base64, mime = 'audio/webm', language = 'ja' } = await readJson(req);
    if (!base64) return res.status(400).json({ error: 'base64 required' });

    const boundary = '----form' + Date.now();
    const CRLF = '\r\n';
    const filename = mime.includes('wav') ? 'audio.wav' : 'audio.webm';

    const push = (arr, s) => arr.push(Buffer.from(s));
    const parts = [];
    for (const [k, v] of Object.entries({ model: 'whisper-1', language })) {
      push(parts, `--${boundary}${CRLF}Content-Disposition: form-data; name="${k}"${CRLF}${CRLF}${v}${CRLF}`);
    }
    push(parts, `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}`);
    push(parts, `Content-Type: ${mime}${CRLF}${CRLF}`);
    parts.push(Buffer.from(base64, 'base64'));
    push(parts, `${CRLF}--${boundary}--${CRLF}`);

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.concat(parts),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `OpenAI ${r.status}`, detail: t });
    }

    const json = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    return res.status(200).json({ text: json.text || '' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
