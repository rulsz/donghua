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
    if (!synopsis || synopsis.toLowerCase().includes('shortlink')) synopsis = 'Tidak ada sinopsis.';

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

    // FUNGSI EKSTRAKSI LEBIH KUAT
    function parseServers($doc) {
      const servers = [];
      
      // 1. Cek Dropdown Server (Mirror)
      $doc('.mirror option, select#selectserver option').each((_, el) => {
        const name = $doc(el).text().trim();
        const val = $doc(el).attr('value') || '';
        if (val && !name.toLowerCase().includes('pilih')) {
          // Coba dekode jika base64
          let url = val;
          if (val.length > 20 && !val.startsWith('http')) {
             try { url = Buffer.from(val, 'base64').toString('utf-8'); } catch(e) {}
             const match = url.match(/src=["']([^"']+)["']/i);
             if (match) url = match[1];
          }
          if (url.startsWith('//')) url = 'https:' + url;
          if (!url.includes('ads')) servers.push({ name, url });
        }
      });

      // 2. Jika tidak ada di dropdown, cari iframe di konten
      if (servers.length === 0) {
        $doc('iframe').each((_, el) => {
          let src = $doc(el).attr('src') || '';
          if (src && !src.includes('ads') && !src.includes('disqus')) {
            if (src.startsWith('//')) src = 'https:' + src;
            servers.push({ name: 'Mirror Server', url: src });
          }
        });
      }
      return servers;
    }

    let rawServers = parseServers($);

    return res.status(200).json({
      success: true,
      data: { title, poster, synopsis, servers: rawServers, episodes }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
