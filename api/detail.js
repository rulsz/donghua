const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

function unpackJS(code) {
  try {
    const match = code.match(/eval\(function\(p,a,c,k,e,d\).*\)/);
    if (!match) return code;
    return code; 
  } catch (e) {
    return code;
  }
}

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

    const title = $('.entry-title, .titl').first().text().trim();
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    const synopsis = $('.entry-content p, .synopsis p').text().trim() || 'Tidak ada sinopsis.';

    const episodes = [];
    $('.eplister ul li, .eplister li, .mreplist li').each((_, el) => {
      const link = $(el).find('a').attr('href');
      const epTitle = $(el).find('.epl-num, .epl-title').text().trim() || $(el).find('a').text().trim();
      if (link) {
        episodes.push({ title: epTitle, slug: link.replace('https://anichin.moe/', '').replace(/\/$/, '') });
      }
    });

    // EKSTRAKSI DENGAN FALLBACK AMAN
    async function extractDirectStream(iframeUrl) {
      if (!iframeUrl) return null;
      try {
        const frameHtml = await cloudscraper.get({
          uri: iframeUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://anichin.moe/'
          }
        });

        const directMatch = frameHtml.match(/(https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/i);
        if (directMatch) return directMatch[1];

        if (iframeUrl.includes('ok.ru')) {
          const okMatch = frameHtml.match(/data-options="([^"]+)"/);
          if (okMatch) {
            const cleanJson = okMatch[1].replace(/&quot;/g, '"');
            const data = JSON.parse(cleanJson);
            if (data.flashvars && data.flashvars.metadata) {
              const meta = JSON.parse(data.flashvars.metadata);
              if (meta.videos && meta.videos.length > 0) {
                return meta.videos[meta.videos.length - 1].url;
              }
            }
          }
        }

        if (iframeUrl.includes('vidhide') || iframeUrl.includes('streamwish')) {
          const unpacked = unpackJS(frameHtml);
          const m3u8Match = unpacked.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
          if (m3u8Match) return m3u8Match[1];
        }

      } catch (err) {}
      return null;
    }

    let rawServers = [];
    $('.mirror option, select.mirror option').each((_, el) => {
      const name = $(el).text().trim();
      let val = $(el).attr('value') || '';
      if (val && !name.toLowerCase().includes('pilih')) {
        if (val.startsWith('aHR0c')) {
          try { val = Buffer.from(val, 'base64').toString('utf-8'); } catch(e){}
        }
        const match = val.match(/src=["']([^"']+)["']/);
        const embedUrl = match ? match[1] : val;
        rawServers.push({ name, embedUrl });
      }
    });

    // Ambil iframe default jika selector option kosong
    let defaultIframe = $('iframe').first().attr('src') || '';

    // Jika di halaman anime utama, ambil server episode pertama
    if (rawServers.length === 0 && !defaultIframe && episodes.length > 0) {
      try {
        const epHtml = await cloudscraper.get({
          uri: `https://anichin.moe/${episodes[0].slug}/`,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ep = cheerio.load(epHtml);
        $ep('.mirror option, select.mirror option').each((_, el) => {
          const name = $ep(el).text().trim();
          let val = $ep(el).attr('value') || '';
          if (val && !name.toLowerCase().includes('pilih')) {
            if (val.startsWith('aHR0c')) {
              try { val = Buffer.from(val, 'base64').toString('utf-8'); } catch(e){}
            }
            const match = val.match(/src=["']([^"']+)["']/);
            rawServers.push({ name, embedUrl: match ? match[1] : val });
          }
        });
        if (rawServers.length === 0) {
          defaultIframe = $ep('iframe').first().attr('src') || '';
        }
      } catch (e) {}
    }

    const processedServers = [];
    for (let srv of rawServers) {
      const directUrl = await extractDirectStream(srv.embedUrl);
      processedServers.push({
        name: srv.name,
        url: directUrl || srv.embedUrl
      });
    }

    if (processedServers.length === 0 && defaultIframe) {
      const directUrl = await extractDirectStream(defaultIframe);
      processedServers.push({
        name: 'Default Server',
        url: directUrl || defaultIframe
      });
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
