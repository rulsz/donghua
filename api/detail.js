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

    // Ambil list episode
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

    // Helper Pembersih URL Embed
    function cleanEmbedUrl(url) {
      if (!url) return '';
      let result = url;

      if (url.startsWith('aHR0c') || (url.length > 30 && !url.includes('http'))) {
        try { result = Buffer.from(url, 'base64').toString('utf-8'); } catch(e){}
      }

      const match = result.match(/src=["']([^"']+)["']/i);
      if (match) result = match[1];

      if (result.startsWith('//')) result = 'https:' + result;

      // Hapus jika tautan masih mengarah ke anichin / dailymotion / shortlink
      if (result.includes('anichin.moe') || result.includes('dailymotion') || result.includes('shortlink')) {
        return '';
      }

      return result;
    }

    // Fungsi Ekstraksi Server dari HTML Episode
    async function extractServersFromHtml($doc) {
      const servers = [];

      // 1. Cek Tag Option
      $doc('.mirror option, select.mirror option').each((_, el) => {
        const name = $doc(el).text().trim();
        const val = $doc(el).attr('value') || '';

        if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('ads')) {
          const validUrl = cleanEmbedUrl(val);
          if (validUrl) {
            servers.push({ name, url: validUrl });
          }
        }
      });

      // 2. Cek Iframe Default jika option tidak memberikan hasil
      if (servers.length === 0) {
        $doc('iframe').each((_, el) => {
          const src = $doc(el).attr('src') || '';
          const validUrl = cleanEmbedUrl(src);
          if (validUrl) {
            servers.push({ name: 'Server Utama', url: validUrl });
          }
        });
      }

      // 3. Cek Atribut Data (data-em, data-post, data-type) jika Anichin menggunakan AJAX
      if (servers.length === 0) {
        const dataEm = $doc('.mirror option[data-em]').first().attr('data-em') || '';
        if (dataEm) {
          const validUrl = cleanEmbedUrl(dataEm);
          if (validUrl) {
            servers.push({ name: 'Server Utama', url: validUrl });
          }
        }
      }

      return servers;
    }

    // Ambil Server dari halaman yang sedang dibuka
    let rawServers = await extractServersFromHtml($);

    // JIKA DI HALAMAN UTAMA ANIME: Scraping otomatis dilakukan ke episode pertama
    if (rawServers.length === 0 && episodes.length > 0) {
      try {
        const epHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${episodes[0].slug}/`,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' }
        });
        const $ep = cheerio.load(epHtml);
        rawServers = await extractServersFromHtml($ep);
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
