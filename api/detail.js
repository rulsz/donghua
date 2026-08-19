const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    const slug = req.query.slug;
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Slug tidak ditemukan' });
    }

    const targetUrl = `https://anichin.moe/${slug}/`;
    const html = await cloudscraper.get({
      uri: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const $ = cheerio.load(html);

    // 1. Ambil Informasi Detail
    const title = $('.entry-title, .titl').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    const synopsis = $('.entry-content p, .synopsis p, .desc p').text().trim() || 'Tidak ada sinopsis.';

    // 2. Ambil Iframe Video (jika ini halaman episode langsung)
    const streamUrl = $('iframe').first().attr('src') || '';

    // 3. Ambil Daftar Episode
    const episodes = [];
    $('.eplister ul li, .eplister li, .mreplist li').each((_, el) => {
      const item = $(el);
      const link = item.find('a').attr('href');
      const epTitle = item.find('.epl-num, .epl-sub, .epl-title').text().trim() || item.find('a').text().trim();
      const date = item.find('.epl-date').text().trim();

      if (link) {
        // Ambil slug episode dari URL
        const epSlug = link.replace('https://anichin.moe/', '').replace(/\/$/, '');
        episodes.push({
          title: epTitle,
          slug: epSlug,
          date: date
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        streamUrl,
        episodes
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Gagal memuat detail: ' + error.message
    });
  }
};
