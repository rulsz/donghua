import * as cheerio from 'cheerio';

// Helper untuk mengekstrak direct MP4 dari OK.ru
async function resolveOkRu(okUrl) {
  try {
    const res = await fetch(okUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Cari JSON metadata video di attribute data-options
    const optionsAttr = $('[data-options]').attr('data-options');
    if (optionsAttr) {
      const json = JSON.parse(optionsAttr);
      const metadata = JSON.parse(json.flashvars.metadata);
      if (metadata && metadata.videos) {
        // Ambil kualitas tertinggi (misal: hd, full, mobile, sd)
        const highestVid = metadata.videos.reverse()[0];
        return highestVid.url;
      }
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

  const targetUrl = `https://animexin.dev/${cleanSlug}/`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (!response.ok) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('.entry-title').first().text().trim() || 'Judul Donghua';
    const poster = $('.thumb img').attr('src') || '';
    const synopsis = $('.entry-content p').text().trim() || '';

    const episodes = [];
    $('.eplister ul li a').each((_, el) => {
      const epTitle = $(el).find('.epl-title').text().trim() || $(el).text().trim();
      const epHref = $(el).attr('href') || '';
      const epSlug = epHref.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
      if (epSlug) episodes.push({ title: epTitle, slug: epSlug });
    });
    episodes.reverse();

    const rawServers = [];
    $('.mirror option, select.mirror option').each((_, el) => {
      const name = $(el).text().trim();
      let value = $(el).attr('value');
      if (value) {
        if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 20) {
          try {
            const decoded = Buffer.from(value, 'base64').toString('utf-8');
            const match = decoded.match(/src=["']([^"']+)["']/);
            value = match ? match[1] : decoded;
          } catch (e) {}
        }
        if (value.startsWith('//')) value = 'https:' + value;
        rawServers.push({ name: name || 'Server', url: value });
      }
    });

    // Proses konversi server ke Direct File URL jika memungkinkan
    const processedServers = await Promise.all(
      rawServers.map(async (srv) => {
        if (srv.url.includes('ok.ru')) {
          const directMp4 = await resolveOkRu(srv.url);
          if (directMp4) {
            return { name: `${srv.name} (Direct MP4)`, url: directMp4, isDirect: true };
          }
        }
        return srv;
      })
    );

    return res.status(200).json({
      success: true,
      data: { title, poster, synopsis, episodes, servers: processedServers }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error Server' });
  }
}
