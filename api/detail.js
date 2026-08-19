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

    // 1. Ambil Judul Utama (Saring dari elemen blog/tutorial)
    let title = $('.infox h1, h1.entry-title').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    
    // 2. Ambil Sinopsis
    let synopsis = $('.entry-content p, .synopsis p, .desc p').first().text().trim();
    if (!synopsis || synopsis.toLowerCase().includes('shortlink')) {
      synopsis = 'Tidak ada sinopsis.';
    }

    // 3. Ambil List Episode Murni (Hanya dari area eplister, abaikan blog/tutorial)
    const episodes = [];
    $('.eplister ul li a, .eplister li a').each((_, el) => {
      const link = $(el).attr('href');
      const epTitle = $(el).find('.epl-num, .epl-title').text().trim() || $(el).text().trim();
      
      if (link) {
        const cleanSlug = link.replace('https://anichin.moe/', '').replace(/\/$/, '');
        // STRICT FILTER: Buang link yang mengandung blog, tutorial, atau shortlink
        if (!cleanSlug.includes('blog') && !cleanSlug.includes('tutorial') && !cleanSlug.includes('shortlink')) {
          episodes.push({ title: epTitle, slug: cleanSlug });
        }
      }
    });

    // 4. Extrak Opsi Server Streaming Dari Halaman Ini
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
        
        if (!embedUrl.includes('dailymotion') && !embedUrl.includes('shortlink')) {
          rawServers.push({ name, url: embedUrl });
        }
      }
    });

    // 5. BILA HALAMAN DONGHUA UTAMA: Ambil otomatis server dari episode pertama di list
    if (rawServers.length === 0 && episodes.length > 0) {
      try {
        const latestEpSlug = episodes[0].slug;
        const epHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${latestEpSlug}/`,
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
            if (!embedUrl.includes('dailymotion') && !embedUrl.includes('shortlink')) {
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
