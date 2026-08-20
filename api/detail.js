import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    let { slug } = req.query;
    if (!slug) return res.status(400).json({ success: false, message: 'Slug diperlukan' });

    const cleanSlug = String(slug)
      .replace(/^https?:\/\/[^\/]+/, '')
      .replace(/^\/+|\/+$/g, '');

    // Sumber Donghua Utama
    const targetUrl = `https://anichin.vip/${cleanSlug}/`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('.entry-title, h1.title').first().text().trim() || 'Donghua';
    const poster = $('.thumb img, .poster img').first().attr('src') || '';
    const synopsis = $('.entry-content p, .desc p, .sinopsis').text().trim() || 'Sinopsis tidak tersedia.';

    // Ambil Daftar Episode
    const episodes = [];
    $('.episodelist ul li, .daftar-episode ul li, .lsteps ul li').each((_, el) => {
      const epTitle = $(el).find('a').text().trim();
      let epHref = $(el).find('a').attr('href') || '';
      if (epTitle && epHref) {
        const epSlug = epHref.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');
        episodes.push({ title: epTitle, slug: epSlug });
      }
    });

    // Ambil Iframe Pemutar Video
    const servers = [];
    $('iframe, .mobius').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        if (!src.includes('facebook') && !src.includes('disqus') && !src.includes('ads')) {
          servers.push({ name: 'Server Streaming', url: src });
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        episodes,
        servers
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail' });
  }
}
