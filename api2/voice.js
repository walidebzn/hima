// ════════════════════════════════════════════════════════════
// HIMA — Proxy ElevenLabs Text-to-Speech
// Sécurise la clé ElevenLabs côté serveur (jamais exposée client)
//
// Variables d'environnement requises (Vercel) :
//   - ELEVENLABS_API_KEY : ta nouvelle clé (jamais dans le code)
//
// Endpoint client : POST /api/voice
// Body : { text, voiceId?, modelId?, voiceSettings? }
// ════════════════════════════════════════════════════════════

const RATE_LIMIT_PER_MINUTE = 30;     // 30 requêtes/min/IP
const MAX_TEXT_LENGTH       = 1500;   // 1500 chars max (≈30 sec audio)
const ALLOWED_ORIGINS = [
  'https://hima-navy.vercel.app',
  'https://hima.app',
  'https://www.hima.app',
  'http://localhost:3000',
  'http://localhost:5173'
];
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

// Rate limiter en mémoire (suffit pour Vercel serverless basique)
// Pour scale, remplacer par Upstash Redis ou équivalent
const _rateBucket = new Map();
function rateLimitOk(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const arr = _rateBucket.get(ip) || [];
  const recent = arr.filter(t => now - t < windowMs);
  if (recent.length >= RATE_LIMIT_PER_MINUTE) {
    _rateBucket.set(ip, recent);
    return false;
  }
  recent.push(now);
  _rateBucket.set(ip, recent);
  // GC : nettoie les buckets froids ponctuellement (1% des appels)
  if (Math.random() < 0.01) {
    for (const [k, v] of _rateBucket.entries()) {
      const fresh = v.filter(t => now - t < windowMs);
      if (fresh.length === 0) _rateBucket.delete(k);
      else _rateBucket.set(k, fresh);
    }
  }
  return true;
}

// CORS validation : autorise seulement les origines whitelistées
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validation env var
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[voice] ELEVENLABS_API_KEY missing');
    return res.status(500).json({ error: 'Voice service unavailable' });
  }

  // Rate limiting par IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || req.headers['x-real-ip']
          || 'unknown';
  if (!rateLimitOk(ip)) {
    return res.status(429).json({ error: 'Trop de requêtes. Réessaie dans une minute.' });
  }

  // Validation body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body required' });
  }

  const text = String(body.text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `Text too long (max ${MAX_TEXT_LENGTH} chars)` });
  }

  const voiceId = String(body.voiceId || DEFAULT_VOICE_ID).replace(/[^a-zA-Z0-9_-]/g, '');
  const modelId = String(body.modelId || DEFAULT_MODEL_ID).replace(/[^a-zA-Z0-9_]/g, '');
  const voiceSettings = body.voiceSettings && typeof body.voiceSettings === 'object'
    ? {
        stability:        Math.min(1, Math.max(0, Number(body.voiceSettings.stability)        || 0.6)),
        similarity_boost: Math.min(1, Math.max(0, Number(body.voiceSettings.similarity_boost) || 0.85)),
        style:            Math.min(1, Math.max(0, Number(body.voiceSettings.style)            || 0.3)),
        use_speaker_boost: !!body.voiceSettings.use_speaker_boost
      }
    : { stability: 0.6, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true };

  // Stream toujours (réduit la latence côté client)
  const stream = body.stream !== false;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}${stream ? '/stream' : ''}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text,
        model_id: modelId,
        voice_settings: voiceSettings
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error('[voice] ElevenLabs error', upstream.status, errText.substring(0, 200));
      // On ne renvoie pas le détail à l'utilisateur (security)
      return res.status(upstream.status === 429 ? 429 : 502).json({
        error: upstream.status === 429
          ? 'Service vocal saturé, réessaie dans un instant.'
          : 'Erreur génération vocale.'
      });
    }

    // Stream audio direct au client
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buffer);

  } catch (err) {
    console.error('[voice] proxy error', err);
    return res.status(500).json({ error: 'Voice proxy error' });
  }
}

// Désactive le body parser par défaut (on parse nous-mêmes pour être sûr)
export const config = {
  api: {
    bodyParser: { sizeLimit: '10kb' }  // text TTS = pas besoin de plus
  }
};
