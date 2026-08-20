export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL required');

  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://ok.ru/'
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');

    const data = await response.arrayBuffer();
    return res.send(Buffer.from(data));
  } catch (e) {
    return res.status(500).send('Proxy error');
  }
}
