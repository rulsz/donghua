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

    // Ambil daftar episode
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

    // Helper Dekode URL Embed dari Anichin
    function parseEmbedUrl(val) {
      if (!val) return '';
      let decoded = val;

      // Dekode Base64 jika string di-encode
      if (val.startsWith('aHR0c') || val.length > 30 && !val.includes('http')) {
        try { 
          decoded = Buffer.from(val, 'base64').toString('utf-8'); 
        } catch(e){}
      }

      // Ambil atribut src jika val berupa tag iframe HTML
      const match = decoded.match(/src=["']([^"']+)["']/i);
      let finalUrl = match ? match[1] : decoded;

      if (finalUrl.startsWith('//')) finalUrl = 'https:' + finalUrl;

      // BIFURKASI: Jika URL masih mengarah ke anichin/shortlink/dailymotion, BUANG!
      if (finalUrl.includes('anichin.moe') || finalUrl.includes('dailymotion') || finalUrl.includes('shortlink')) {
        return '';
      }

      return finalUrl;
    }

    // Ambil server dari halaman saat ini
    let rawServers = [];
    $('.mirror option, select.mirror option').each((_, el) => {
      const name = $(el).text().trim();
      const val = $(el).attr('value') || '';

      if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('ads')) {
        const cleanUrl = parseEmbedUrl(val);
        if (cleanUrl) {
          rawServers.push({ name, url: cleanUrl });
        }
      }
    });

    // Jika halaman utama anime, ambil dari episode terbaru
    if (rawServers.length === 0 && episodes.length > 0) {
      try {
        const epHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${episodes[0].slug}/`,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ep = cheerio.load(epHtml);
        $ep('.mirror option, select.mirror option').each((_, el) => {
          const name = $ep(el).text().trim();
          const val = $ep(el).attr('value') || '';

          if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('ads')) {
            const cleanUrl = parseEmbedUrl(val);
            if (cleanUrl) {
              rawServers.push({ name, url: cleanUrl });
            }
          }
        });
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
