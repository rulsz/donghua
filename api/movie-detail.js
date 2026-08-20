import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    let { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug diperlukan' });
    }

    const cleanSlug = String(slug)
      .replace(/^https?:\/\/[^\/]+/, '')
      .replace(/^\/?film\//, '')
      .replace(/^\/?movie\//, '')
      .replace(/^\/+|\/+$/g, '');

    const targetUrl = `https://v4.pusatfilm21info.net/${cleanSlug}/`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Film tidak ditemukan' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('.entry-title, h1.title, .mvic-desc h3').first().text().trim() || 'Judul Film';
    const poster = $('.mvic-thumb img, .poster img, .thumb img').attr('src') || '';
    const synopsis = $('.desc, .entry-content, .konten-sinopsis').text().trim() || 'Tidak ada deskripsi.';

    // Cari server video / iframe player
    const servers = [];
    $('iframe, embed').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('ads')) {
        if (src.startsWith('//')) src = 'https:' + src;
        servers.push({ name: 'Server Utama', url: src });
      }
    });

    // Ambil pilihan server dari dropdown/mirror jika ada
    $('.player-option select option, .dropdown-menu a, .server-item').each((_, el) => {
      const name = $(el).text().trim();
      let value = $(el).attr('value') || $(el).attr('data-url') || $(el).attr('href');
      if (value && value.includes('http') && !servers.some(s => s.url === value)) {
        servers.push({ name: name || 'Server Alternatif', url: value });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        isMovie: true,
        servers
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail film' });
  }
}
