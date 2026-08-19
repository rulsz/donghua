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
    let html = await cloudscraper.get({
      uri: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    let $ = cheerio.load(html);

    // 1. Ambil Data Detail Utama
    const title = $('.entry-title, .titl').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    const synopsis = $('.entry-content p, .synopsis p, .desc p').text().trim() || 'Tidak ada sinopsis.';

    // 2. Ambil Daftar Episode
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

    // 3. Fungsi Pengambil Server Video dari HTML
    function extractServers($doc) {
      const serverList = [];
      $doc('.mirror option, select.mirror option, .select-mirror option').each((_, el) => {
        const option = $doc(el);
        const name = option.text().trim();
        let value = option.attr('value') || '';

        if (value && name && !name.toLowerCase().includes('pilih')) {
          let streamUrl = value;
          if (value.includes('iframe') || value.startsWith('aHR0c')) {
            try {
              const decoded = Buffer.from(value, 'base64').toString('utf-8');
              const iframeMatch = decoded.match(/src=["']([^"']+)["']/);
              if (iframeMatch) streamUrl = iframeMatch[1];
            } catch (e) {}
          }
          serverList.push({ name: name, url: streamUrl });
        }
      });

      let fallbackUrl = $doc('iframe').first().attr('src') || '';
      if (serverList.length === 0 && fallbackUrl) {
        serverList.push({ name: 'Default Server', url: fallbackUrl });
      }
      return serverList;
    }

    let servers = extractServers($);

    // BILA HALAMAN UTAMA TIDAK PUNYA VIDEO: Ambil otomatis dari Episode Terbaru (Episode Pertama di List)
    if (servers.length === 0 && episodes.length > 0) {
      try {
        const latestEpSlug = episodes[0].slug;
        const epHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${latestEpSlug}/`,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        });
        const $ep = cheerio.load(epHtml);
        servers = extractServers($ep);
      } catch (err) {}
    }

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        servers,
        streamUrl: servers.length > 0 ? servers[0].url : '',
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
