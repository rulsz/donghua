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
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://anichin.moe/'
      }
    });

    let $ = cheerio.load(html);

    const title = $('.infox h1, h1.entry-title').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    
    let synopsis = $('.entry-content p, .synopsis p, .desc p').first().text().trim();
    if (!synopsis || synopsis.toLowerCase().includes('shortlink')) synopsis = 'Tidak ada sinopsis.';

    // 1. Ekstraksi Episode
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

    // 2. Fungsi Ekstraksi URL Player Super Lengkap
    function extractEmbedUrl(val) {
      if (!val) return '';
      let str = val.trim();

      // Dekode Base64 jika string terenkripsi
      if (!str.startsWith('http') && !str.startsWith('//') && str.length > 15) {
        try {
          let decoded = Buffer.from(str, 'base64').toString('utf-8');
          if (decoded.includes('http') || decoded.includes('iframe') || decoded.includes('src=')) {
            str = decoded;
          }
        } catch (e) {}
      }

      // Ambil URL dari tag iframe jika berupa HTML string
      const match = str.match(/src=["']([^"']+)["']/i);
      if (match) str = match[1];

      // Format protocol URL
      if (str.startsWith('//')) str = 'https:' + str;

      return str.startsWith('http') ? str : '';
    }

    function parseServers($doc) {
      const servers = [];
      const addedUrls = new Set();

      // Method A: Ambil dari Option Dropdown Server (Paling Umum)
      $doc('.mirror option, select#selectserver option, select.mirror option').each((_, el) => {
        const name = $doc(el).text().trim();
        const val = $doc(el).attr('value') || $doc(el).attr('data-em') || $doc(el).attr('data-content') || '';
        
        if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('ads')) {
          const embedUrl = extractEmbedUrl(val);
          if (embedUrl && !addedUrls.has(embedUrl) && !embedUrl.includes('dailymotion') && !embedUrl.includes('shortlink')) {
            addedUrls.add(embedUrl);
            servers.push({ name, url: embedUrl });
          }
        }
      });

      // Method B: Ambil dari Iframe Langsung di Player Box
      $doc('.player-embed iframe, #pembed iframe, .responsive-embed-stream iframe, iframe').each((_, el) => {
        let src = $doc(el).attr('src') || $doc(el).attr('data-src') || $doc(el).attr('data-lazy-src') || '';
        const embedUrl = extractEmbedUrl(src);
        
        if (embedUrl && !addedUrls.has(embedUrl) && !embedUrl.includes('facebook') && !embedUrl.includes('disqus') && !embedUrl.includes('ads')) {
          addedUrls.add(embedUrl);
          servers.push({ name: 'Server Utama', url: embedUrl });
        }
      });

      return servers;
    }

    let rawServers = parseServers($);

    // 3. Fallback: Jika Halaman Anime Utama Tidak Punya Server, Ambil dari Episode Pertama
    if (rawServers.length === 0 && episodes.length > 0) {
      try {
        const firstEpHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${episodes[0].slug}/`,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://anichin.moe/'
          }
        });
        const $ep = cheerio.load(firstEpHtml);
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
