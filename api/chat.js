export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { system, messages } = req.body;

    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 600,
        system: system || 'Tu es HIMA, coach sportif IA.',
        messages: messages
      })
    });

    const data = await response.json();
    console.log('Anthropic response status:', response.status);
    if (!response.ok) console.error('Anthropic error:', JSON.stringify(data));
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
