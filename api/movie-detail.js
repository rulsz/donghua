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

    const keyword = cleanSlug.replace(/-/g, ' ');

    let html = null;
    let movieUrl = `https://v4.pusatfilm21info.net/${cleanSlug}/`;

    try {
      const searchResp = await fetch(`https://v4.pusatfilm21info.net/?s=${encodeURIComponent(keyword)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      
      if (searchResp.ok) {
        const searchHtml = await searchResp.text();
        const $$ = cheerio.load(searchHtml);
        const firstLink = $$('.item a, article a, .ml-item a, .post-item a').first().attr('href');
        if (firstLink) movieUrl = firstLink;
      }
    } catch (e) {}

    try {
      const resp = await fetch(movieUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (resp.ok) html = await resp.text();
    } catch (e) {}

    if (!html) {
      return res.status(404).json({ success: false, message: 'Film tidak ditemukan' });
    }

    const $ = cheerio.load(html);

    const title = $('.entry-title').first().text().trim() || $('h1.title').text().trim() || keyword.toUpperCase();
    const poster = $('.thumb img').attr('src') || $('.poster img').attr('src') || '';
    const synopsis = $('.desc p, .entry-content p, .konten-sinopsis').text().trim() || 'Tidak ada deskripsi.';

    const servers = [];

    // 1. Ambil semua iframe yang ada di halaman detail
    $('iframe, embed').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('ads') && !src.includes('official')) {
        if (src.startsWith('//')) src = 'https:' + src;
        servers.push({ name: 'Server Utama', url: src });
      }
    });

    // 2. Ambil tombol pilihan server atau list server alternatif di bawah player (seperti Hydrax, TurboVIP, GDPlayer)
    $('.player-option select option, .dropdown-menu a, .server_select option, .button-animation, .servers-index a, [data-server]').each((_, el) => {
      const name = $(el).text().trim();
      let value = $(el).attr('value') || $(el).attr('data-url') || $(el).attr('href') || $(el).attr('data-server');
      
      if (value && value.includes('http') && !value.includes('official') && !servers.some(s => s.url === value)) {
        servers.push({ name: name || 'Server Alternatif', url: value });
      }
    });

    // Fallback aman jika server kosong
    if (servers.length === 0) {
      servers.push({ name: 'Server Streaming HD', url: movieUrl });
    }

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
