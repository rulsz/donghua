export default async function handler(req, res) {
  const { url, referer } = req.query;

  if (!url) {
    return res.status(400).send('URL video diperlukan.');
  }

  try {
    const targetUrl = decodeURIComponent(url);
    const customReferer = referer ? decodeURIComponent(referer) : '';

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    if (customReferer) {
      headers['Referer'] = customReferer;
    }

    const videoRes = await fetch(targetUrl, { headers });

    if (!videoRes.ok) {
      return res.status(videoRes.status).send('Gagal mengambil stream video');
    }

    // Buka akses CORS ke player frontend milik sendiri
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', videoRes.headers.get('content-type') || 'video/mp4');

    const videoBuffer = await videoRes.arrayBuffer();
    return res.send(Buffer.from(videoBuffer));

  } catch (error) {
    return res.status(500).send('Server Proxy Error');
  }
}
