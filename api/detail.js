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

    // FUNGSI EKSTRAKSI DARI STREAM OK.RU KE DIRECT MP4
    async function extractDirectMp4(embedUrl) {
      if (!embedUrl) return null;

      if (embedUrl.includes('ok.ru')) {
        try {
          const videoIdMatch = embedUrl.match(/(?:video\/|embed\/)(\d+)/);
          if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            const okPageHtml = await cloudscraper.get({
              uri: `https://ok.ru/videoembed/${videoId}`,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            const match = okPageHtml.match(/data-options="([^"]+)"/);
            if (match) {
              const cleanJson = match[1].replace(/&quot;/g, '"');
              const data = JSON.parse(cleanJson);
              if (data.flashvars && data.flashvars.metadata) {
                const meta = JSON.parse(data.flashvars.metadata);
                if (meta.videos && meta.videos.length > 0) {
                  // Mengambil file MP4 kualitas paling tinggi
                  return meta.videos[meta.videos.length - 1].url;
                }
              }
            }
          }
        } catch (e) {}
      }
      return null;
    }

    async function getDirectServers($doc) {
      const servers = [];
      const rawOptions = [];

      $doc('.mirror option, select.mirror option').each((_, el) => {
        const name = $doc(el).text().trim();
        const val = $doc(el).attr('value') || $doc(el).attr('data-em') || '';
        if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('ads')) {
          rawOptions.push({ name, val });
        }
      });

      for (let opt of rawOptions) {
        let embedUrl = decodeVal(opt.val);

        if (embedUrl.includes('anichin.moe')) {
          try {
            const playerHtml = await cloudscraper.get({
              uri: embedUrl,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': targetUrl }
            });
            const $p = cheerio.load(playerHtml);
            const realIframe = $p('iframe').attr('src') || '';
            if (realIframe && !realIframe.includes('anichin.moe')) {
              embedUrl = realIframe.startsWith('//') ? 'https:' + realIframe : realIframe;
            }
          } catch(e){}
        }

        if (embedUrl && !embedUrl.includes('anichin.moe') && !embedUrl.includes('dailymotion') && !embedUrl.includes('shortlink')) {
          // EKSTRAKSI KE MP4 MURNI
          const directMp4 = await extractDirectMp4(embedUrl);
          const finalStreamUrl = directMp4 || embedUrl;

          servers.push({ name: opt.name, url: finalStreamUrl });
        }
      }

      return servers;
    }

    let rawServers = await getDirectServers($);

    if (rawServers.length === 0 && episodes.length > 0) {
      try {
        const epHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${episodes[0].slug}/`,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ep = cheerio.load(epHtml);
        rawServers = await getDirectServers($ep);
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
