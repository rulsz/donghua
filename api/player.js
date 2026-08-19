const cloudscraper = require('cloudscraper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  try {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL dibutuhkan');

    // Mengambil player dari server asal dengan memalsukan Referer Anichin
    const html = await cloudscraper.get({
      uri: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://anichin.moe/',
        'Origin': 'https://anichin.moe'
      }
    });

    // Menghapus skrip pemutus iframe (framekiller)
    const cleanHtml = html
      .replace(/top\.location\s*=\s*/gi, '//')
      .replace(/parent\.location\s*=\s*/gi, '//');

    return res.status(200).send(cleanHtml);
  } catch (error) {
    return res.status(500).send('Gagal memuat player.');
  }
};
