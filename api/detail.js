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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    let $ = cheerio.load(html);

    // 1. Ambil Judul Utama
    const title = $('h1.entry-title, .infox h1').first().text().trim() || $('.entry-title').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    
    // 2. Ambil Sinopsis
    let synopsis = $('.entry-content p, .synopsis p, .desc p').first().text().trim();
    if (!synopsis || synopsis.toLowerCase().includes('shortlink')) {
      synopsis = 'Tidak ada sinopsis.';
    }

    // 3. Ambil List Episode (Saring link tutorial/shortlink)
    const episodes = [];
    $('.eplister ul li, .eplister li, .mreplist li').each((_, el) => {
      const link = $(el).find('a').attr('href');
      const epTitle = $(el).find('.epl-num, .epl-title').text().trim() || $(el).find('a').text().trim();
      if (link && !link.includes('tutorial') && !link.includes('shortlink')) {
        episodes.push({ title: epTitle, slug: link.replace('https://anichin.moe/', '').replace(/\/$/, '') });
      }
    });

    // 4. Extrak Opsi Server Streaming
    let rawServers = [];
    $('.mirror option, select.mirror option').each((_, el) => {
      const name = $(el).text().trim();
      let val = $(el).attr('value') || '';

      // Saring Dailymotion / ADS yang merusak UI
      if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('dailymotion') && !name.toLowerCase().includes('ads')) {
        if (val.startsWith('aHR0c')) {
          try { val = Buffer.from(val, 'base64').toString('utf-8'); } catch(e){}
        }
        const match = val.match(/src=["']([^"']+)["']/);
        let embedUrl = match ? match[1] : val;
        
        if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
        
        if (!embedUrl.includes('dailymotion')) {
          rawServers.push({ name, url: embedUrl });
        }
      }
    });

    // 5. JIKA DI HALAMAN ANIME UTAMA: Ambil otomatis server dari Episode 1 / Episode Terbaru
    if (rawServers.length === 0 && episodes.length > 0) {
      try {
        const epHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${episodes[0].slug}/`,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ep = cheerio.load(epHtml);
        $ep('.mirror option, select.mirror option').each((_, el) => {
          const name = $ep(el).text().trim();
          let val = $ep(el).attr('value') || '';
          if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('dailymotion') && !name.toLowerCase().includes('ads')) {
            if (val.startsWith('aHR0c')) {
              try { val = Buffer.from(val, 'base64').toString('utf-8'); } catch(e){}
            }
            const match = val.match(/src=["']([^"']+)["']/);
            let embedUrl = match ? match[1] : val;
            if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
            if (!embedUrl.includes('dailymotion')) {
              rawServers.push({ name, url: embedUrl });
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
