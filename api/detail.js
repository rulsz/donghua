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

    // 1. Data Detail Utama
    const title = $('.entry-title, .titl').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    const synopsis = $('.entry-content p, .synopsis p, .desc p').text().trim() || 'Tidak ada sinopsis.';

    // 2. Extrak Daftar Server Video
    const servers = [];
    $('.mirror option, select.mirror option, .select-mirror option').each((_, el) => {
      const option = $(el);
      const name = option.text().trim();
      let value = option.attr('value') || '';

      if (value && name && !name.toLowerCase().includes('pilih')) {
        // Decode base64 jika nilai server di-encode oleh Anichin
        let streamUrl = value;
        if (value.includes('iframe') || value.startsWith('aHR0c')) {
          try {
            const decoded = Buffer.from(value, 'base64').toString('utf-8');
            const iframeMatch = decoded.match(/src=["']([^"']+)["']/);
            if (iframeMatch) streamUrl = iframeMatch[1];
          } catch (e) {}
        }

        servers.push({
          name: name,
          url: streamUrl
        });
      }
    });

    // Fallback Iframe Default jika server option tidak ada
    let defaultStreamUrl = $('iframe').first().attr('src') || '';
    if (servers.length === 0 && defaultStreamUrl) {
      servers.push({ name: 'Default Server', url: defaultStreamUrl });
    }

    // 3. Extrak Daftar Episode
    const episodes = [];
    $('.eplister ul li, .eplister li, .mreplist li').each((_, el) => {
      const item = $(el);
      const link = item.find('a').attr('href');
      const epTitle = item.find('.epl-num, .epl-sub, .epl-title').text().trim() || item.find('a').text().trim();

      if (link) {
        const epSlug = link.replace('https://anichin.moe/', '').replace(/\/$/, '');
        episodes.push({
          title: epTitle,
          slug: epSlug
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        servers,
        streamUrl: servers.length > 0 ? servers[0].url : defaultStreamUrl,
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
