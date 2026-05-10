/* HIMA - /api/chat
   v2.0 - support Vision (images), model overridable, max_tokens overridable
   - Forward complet du body a l'API Anthropic
   - Defaults safes pour le chat texte normal
   - Compatible Wave 6 Form Check Video (Claude Vision)
*/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const {
      system,
      messages,
      model,
      max_tokens,
      temperature
    } = req.body;

    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    // Defaults safes (May 2026 : Sonnet 4.6 = meilleur rapport qualite/prix, supporte Vision)
    const useModel = model || 'claude-sonnet-4-6';
    const useMaxTokens = (typeof max_tokens === 'number' && max_tokens > 0)
      ? Math.min(max_tokens, 4096)
      : 800;
    const useSystem = system || 'Tu es HIMA, coach sportif IA.';

    // Detection si messages contiennent une image (Vision)
    let hasImage = false;
    try {
      for (const m of messages) {
        if (Array.isArray(m.content)) {
          for (const c of m.content) {
            if (c && c.type === 'image') { hasImage = true; break; }
          }
        }
        if (hasImage) break;
      }
    } catch(e) {}

    // Si Vision, on bump max_tokens si pas deja fait
    const finalMaxTokens = hasImage && useMaxTokens < 1500
      ? 1500
      : useMaxTokens;

    const payload = {
      model: useModel,
      max_tokens: finalMaxTokens,
      system: useSystem,
      messages: messages
    };
    if (typeof temperature === 'number') payload.temperature = temperature;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', response.status, JSON.stringify(data).slice(0, 500));
      return res.status(response.status).json({
        error: data.error || data,
        hint: hasImage
          ? 'Vision request failed. Check model supports vision.'
          : 'Check model name and max_tokens.'
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
