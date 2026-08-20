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
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36', 'Referer': 'https://anichin.moe/' }
    });

    let $ = cheerio.load(html);

    const title = $('.infox h1, h1.entry-title').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src'] || '';
    
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

    function parseServers($doc) {
      const servers = [];
      const added = new Set();

      // 1. Cek Dropdown Server biasa / data-em / data-content
      $doc('.mirror option, select#selectserver option, select.mirror option').each((_, el) => {
        const name = $doc(el).text().trim();
        const val = $doc(el).attr('value') || $doc(el).attr('data-em') || $doc(el).attr('data-content') || '';
        
        if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('ads')) {
          let embedUrl = decodeVal(val);
          if (embedUrl && !added.has(embedUrl) && !embedUrl.includes('dailymotion') && !embedUrl.includes('shortlink')) {
            added.add(embedUrl);
            servers.push({ name, url: embedUrl });
          }
        }
      });

      // 2. Cek Iframe Statis
      $doc('iframe').each((_, el) => {
        let src = $doc(el).attr('src') || $doc(el).attr('data-src') || '';
        if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('ads')) {
          if (src.startsWith('//')) src = 'https:' + src;
          if (!added.has(src)) {
            added.add(src);
            servers.push({ name: 'Server Utama', url: src });
          }
        }
      });

      return servers;
    }

    let rawServers = parseServers($);

    // 3. Jika server kosong, ekstrak postid untuk mengambil ajax player Anichin
    if (rawServers.length === 0) {
      const postId = $('input#post_id').val() || $('div[data-post]').attr('data-post');
      if (postId) {
        try {
          const ajaxRes = await cloudscraper.post({
            uri: 'https://anichin.moe/wp-admin/admin-ajax.php',
            form: { action: 'player_ajax', post: postId, eval: 'true' },
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': targetUrl, 'X-Requested-With': 'XMLHttpRequest' }
          });
          const $ajaxDoc = cheerio.load(ajaxRes);
          rawServers = parseServers($ajaxDoc);
        } catch(err) {}
      }
    }

    return res.status(200).json({
      success: true,
      data: { title, poster, synopsis, servers: rawServers, episodes }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
