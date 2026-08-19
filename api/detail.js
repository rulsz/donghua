const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ success: false, error: 'Slug dibutuhkan' });

    let targetUrl = `https://anichin.moe/${slug}/`;
    let html = await cloudscraper.get({
      uri: targetUrl,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' }
    });

    let $ = cheerio.load(html);

    const title = $('.infox h1, h1.entry-title').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    
    let synopsis = $('.entry-content p, .synopsis p, .desc p').first().text().trim();
    if (!synopsis || synopsis.toLowerCase().includes('shortlink')) {
      synopsis = 'Tidak ada sinopsis.';
    }

    // Ekstraksi Episode List
    const episodes = [];
    $('.eplister ul li a, .eplister li a').each((_, el) => {
      const link = $(el).attr('href');
      const epTitle = $(el).find('.epl-num, .epl-title').text().trim() || $(el).text().trim();
      if (link) {
        const cleanSlug = link.replace('https://anichin.moe/', '').replace(/\/$/, '');
        if (!cleanSlug.includes('blog') && !cleanSlug.includes('tutorial') && !cleanSlug.includes('shortlink')) {
          episodes.push({ title: epTitle, slug: cleanSlug });
        }
      }
    });

    // Dekode Base64 Cepat
    function decodeVal(val) {
      if (!val) return '';
      let result = val;
      if (val.startsWith('aHR0c') || (val.length > 30 && !val.includes('http'))) {
        try { result = Buffer.from(val, 'base64').toString('utf-8'); } catch(e){}
      }
      const match = result.match(/src=["']([^"']+)["']/i);
      if (match) result = match[1];
      if (result.startsWith('//')) result = 'https:' + result;
      return result;
    }

    // Ekstraksi Server Stream
    function parseServers($doc) {
      const servers = [];
      $doc('.mirror option, select.mirror option').each((_, el) => {
        const name = $doc(el).text().trim();
        const val = $doc(el).attr('value') || $doc(el).attr('data-em') || '';
        
        if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('ads')) {
          let embedUrl = decodeVal(val);
          if (embedUrl && !embedUrl.includes('dailymotion') && !embedUrl.includes('shortlink')) {
            servers.push({ name, url: embedUrl });
          }
        }
      });
      return servers;
    }

    let rawServers = parseServers($);

    // Jika membuka halaman utama anime dan server kosong, ambil dari episode pertama (terbaru)
    if (rawServers.length === 0 && episodes.length > 0) {
      try {
        const epHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${episodes[0].slug}/`,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ep = cheerio.load(epHtml);
        rawServers = parseServers($ep);
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        servers: rawServers,
        streamUrl: rawServers.length > 0 ? rawServers[0].url : '',
        episodes
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
