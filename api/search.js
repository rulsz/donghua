const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ success: false, error: 'Query dibutuhkan' });

    let searchUrl = `https://anichin.moe/?s=${encodeURIComponent(query)}`;
    let html = await cloudscraper.get({
      uri: searchUrl,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36', 'Referer': 'https://anichin.moe/' }
    });

    let $ = cheerio.load(html);
    const results = [];

    $('.bsx').each((_, el) => {
      const title = $(el).find('.tt h2').text().trim() || $(el).find('.title').text().trim();
      const link = $(el).find('a').attr('href') || '';
      const poster = $(el).find('img').attr('src') || '';
      const episode = $(el).find('.epx, .episode').text().trim() || '';

      if (link) {
        const cleanSlug = link.replace('https://anichin.moe/', '').replace(/\/$/, '');
        results.push({ title, slug: cleanSlug, poster, episode });
      }
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
