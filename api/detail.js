import * as cheerio from 'cheerio';

// Helper: Resolver Universal untuk berbagai provider video
async function resolveDirectStream(url) {
  if (!url) return null;

  try {
    // 1. Resolver untuk OK.RU
    if (url.includes('ok.ru')) {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await res.text();
      const $ = cheerio.load(html);
      const optionsAttr = $('[data-options]').attr('data-options');
      if (optionsAttr) {
        const json = JSON.parse(optionsAttr);
        const metadata = JSON.parse(json.flashvars.metadata);
        if (metadata && metadata.videos) {
          // Ambil kualitas tertinggi
          return { directUrl: metadata.videos.reverse()[0].url, referer: 'https://ok.ru/' };
        }
      }
    }

    // 2. Resolver untuk Blogger / Google Video
    if (url.includes('blogger.com') || url.includes('getvideo')) {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await res.text();
      const match = html.match(/"play_url"\s*:\s*"([^"]+)"/);
      if (match) {
        return { directUrl: match[1].replace(/\\u0026/g, '&'), referer: 'https://www.blogger.com/' };
      }
    }

    // 3. Resolver untuk Direct Link (.mp4 / .m3u8)
    if (/\.(mp4|m3u8)(\?.*)?$/i.test(url)) {
      return { directUrl: url, referer: '' };
    }
  } catch (e) {
    return null;
  }

  return null;
}

export default async function handler(req, res) {
  let { slug } = req.query;
  if (!slug) return res.status(400).json({ success: false, message: 'Slug diperlukan' });

  const cleanSlug = String(slug)
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/?detail\//, '')
    .replace(/^\/?anime\//, '')
    .replace(/^\/?movie\//, '')
    .replace(/^\/+|\/+$/g, '');

  const urlsToTry = [
    `https://animexin.dev/${cleanSlug}/`,
    `https://animexin.dev/anime/${cleanSlug}/`,
    `https://animexin.dev/${cleanSlug}-sub-indo/`
  ];

  let html = null;
  for (const targetUrl of urlsToTry) {
    try {
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (response.ok) {
        const text = await response.text();
        if (text && (text.includes('eplister') || text.includes('entry-title') || text.includes('embed'))) {
          html = text;
          break;
        }
      }
    } catch (e) { continue; }
  }

  if (!html) return res.status(404).json({ success: false, message: 'Media tidak ditemukan' });

  try {
    const $ = cheerio.load(html);
    const title = $('.entry-title').first().text().trim() || 'Judul Donghua';
    const poster = $('.thumb img').attr('src') || '';
    const synopsis = $('.entry-content p').text().trim() || '';

    const episodes = [];
    $('.eplister ul li a, .eplist ul li a').each((_, el) => {
      const epTitle = $(el).find('.epl-title').text().trim() || $(el).text().trim();
      const epHref = $(el).attr('href') || '';
      const epSlug = epHref.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
      if (epSlug) episodes.push({ title: epTitle, slug: epSlug });
    });
    episodes.reverse();

    const rawServers = [];
    $('.mirror option, select.mirror option, .select-service option').each((_, el) => {
      const name = $(el).text().trim();
      let value = $(el).attr('value');
      if (value && value !== '') {
        if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 20) {
          try {
            const decoded = Buffer.from(value, 'base64').toString('utf-8');
            const match = decoded.match(/src=["']([^"']+)["']/);
            value = match ? match[1] : decoded;
          } catch (e) {}
        }
        if (value.startsWith('//')) value = 'https:' + value;
        rawServers.push({ name: name || 'Server', rawUrl: value });
      }
    });

    // Proses konversi seluruh server menjadi stream langsung / proxy stream
    const processedServers = await Promise.all(
      rawServers.map(async (srv) => {
        const resolved = await resolveDirectStream(srv.rawUrl);
        if (resolved && resolved.directUrl) {
          // Bungkus dalam URL Proxy agar tidak error CORS / Angka 10
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(resolved.directUrl)}&referer=${encodeURIComponent(resolved.referer || '')}`;
          return { name: srv.name, url: proxyUrl, isDirect: true };
        }
        // Jika gagal diekstrak, kembalikan URL asli
        return { name: srv.name, url: srv.rawUrl, isDirect: false };
      })
    );

    return res.status(200).json({
      success: true,
      data: { title, poster, synopsis, episodes, servers: processedServers }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal parsing server' });
  }
}
