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
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' }
    });

    let $ = cheerio.load(html);

    const title = $('h1.entry-title, .infox h1, .entry-title').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    let synopsis = $('.entry-content p, .synopsis p, .desc p').first().text().trim() || 'Tidak ada sinopsis.';

    const episodes = [];
    $('.eplister ul li, .eplister li, .mreplist li').each((_, el) => {
      const link = $(el).find('a').attr('href');
      const epTitle = $(el).find('.epl-num, .epl-title').text().trim() || $(el).find('a').text().trim();
      if (link && !link.includes('tutorial') && !link.includes('shortlink')) {
        episodes.push({ title: epTitle, slug: link.replace('https://anichin.moe/', '').replace(/\/$/, '') });
      }
    });

    // FUNGSI EKSTRAKSI LINK VIDEO MURNI OK.RU
    async function extractOkRuStream(okUrl) {
      try {
        const videoIdMatch = okUrl.match(/(?:video\/|embed\/)(\d+)/);
        if (!videoIdMatch) return null;
        
        const videoId = videoIdMatch[1];
        const pageHtml = await cloudscraper.get({
          uri: `https://ok.ru/videoembed/${videoId}`,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const match = pageHtml.match(/data-options="([^"]+)"/);
        if (match) {
          const cleanJson = match[1].replace(/&quot;/g, '"');
          const data = JSON.parse(cleanJson);
          if (data.flashvars && data.flashvars.metadata) {
            const meta = JSON.parse(data.flashvars.metadata);
            if (meta.videos && meta.videos.length > 0) {
              // Ambil kualitas video tertinggi
              return meta.videos[meta.videos.length - 1].url;
            }
          }
        }
      } catch (err) {}
      return null;
    }

    let rawServers = [];
    $('.mirror option, select.mirror option').each((_, el) => {
      const name = $(el).text().trim();
      let val = $(el).attr('value') || '';

      if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('dailymotion')) {
        if (val.startsWith('aHR0c')) {
          try { val = Buffer.from(val, 'base64').toString('utf-8'); } catch(e){}
        }
        const match = val.match(/src=["']([^"']+)["']/);
        const embedUrl = match ? match[1] : val;
        rawServers.push({ name, embedUrl });
      }
    });

    // Jika di halaman anime utama, ambil dari episode 1 / terbaru
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
          if (val && !name.toLowerCase().includes('pilih') && !name.toLowerCase().includes('dailymotion')) {
            if (val.startsWith('aHR0c')) {
              try { val = Buffer.from(val, 'base64').toString('utf-8'); } catch(e){}
            }
            const match = val.match(/src=["']([^"']+)["']/);
            rawServers.push({ name, embedUrl: match ? match[1] : val });
          }
        });
      } catch (e) {}
    }

    const processedServers = [];
    for (let srv of rawServers) {
      if (srv.embedUrl.includes('ok.ru')) {
        const directMp4 = await extractOkRuStream(srv.embedUrl);
        if (directMp4) {
          processedServers.push({ name: srv.name + ' (Direct MP4)', url: directMp4, isDirect: true });
        } else {
          processedServers.push({ name: srv.name, url: srv.embedUrl, isDirect: false });
        }
      } else {
        processedServers.push({ name: srv.name, url: srv.embedUrl, isDirect: false });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        servers: processedServers,
        streamUrl: processedServers.length > 0 ? processedServers[0].url : '',
        episodes
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
