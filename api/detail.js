const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ success: false, error: 'Slug dibutuhkan' });

    const targetUrl = `https://anichin.moe/${slug}/`;
    let html = await cloudscraper.get({
      uri: targetUrl,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    let $ = cheerio.load(html);

    const title = $('.infox h1, h1.entry-title').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    
    let synopsis = $('.entry-content p, .synopsis p, .desc p').first().text().trim();
    if (!synopsis || synopsis.toLowerCase().includes('shortlink')) {
      synopsis = 'Tidak ada sinopsis.';
    }

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

    // Ambil server khusus halaman episode
    let rawServers = [];
    $('.mirror option, select.mirror option').each((_, el) => {
      const name = $(el).text().trim();
      let val = $(el).attr('value') || '';

      if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('dailymotion') && !name.toLowerCase().includes('ads')) {
        if (val.startsWith('aHR0c')) {
          try { val = Buffer.from(val, 'base64').toString('utf-8'); } catch(e){}
        }
        const match = val.match(/src=["']([^"']+)["']/);
        let embedUrl = match ? match[1] : val;
        if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
        
        // Buang URL yang mengarah ke internal anichin/shortlink
        if (!embedUrl.includes('anichin.moe') && !embedUrl.includes('dailymotion')) {
          rawServers.push({ name, url: embedUrl });
        }
      }
    });

    // Indikator jika ini adalah halaman utama anime (bukan episode)
    const isMainPage = rawServers.length === 0 && episodes.length > 0;

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        servers: rawServers,
        streamUrl: rawServers.length > 0 ? rawServers[0].url : '',
        episodes,
        isMainPage,
        latestEpSlug: episodes.length > 0 ? episodes[0].slug : null
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
