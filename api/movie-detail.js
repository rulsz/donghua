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

    // Ubah slug seperti "shera-2026" atau "yellow-eyes-2026" menjadi kata kunci pencarian "shera 2026"
    const keyword = cleanSlug.replace(/-/g, ' ');

    let html = null;
    let movieUrl = `https://v4.pusatfilm21info.net/${cleanSlug}/`;

    // Coba temukan lewat pencarian langsung di situs sumber agar akurat
    try {
      const searchResp = await fetch(`https://v4.pusatfilm21info.net/?s=${encodeURIComponent(keyword)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (searchResp.ok) {
        const searchHtml = await searchResp.text();
        const $$ = cheerio.load(searchHtml);
        
        // Ambil link hasil pencarian pertama yang paling relevan
        const firstLink = $$('.item a, article a, .ml-item a, .post-item a, .search-page .result-item a').first().attr('href');
        if (firstLink) {
          movieUrl = firstLink;
        }
      }
    } catch (e) {}

    // Ambil halaman detail film
    try {
      const resp = await fetch(movieUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (resp.ok) {
        html = await resp.text();
      }
    } catch (e) {}

    if (!html) {
      return res.status(404).json({ success: false, message: 'Film tidak ditemukan' });
    }

    const $ = cheerio.load(html);

    const title = $('.entry-title').first().text().trim() || $('h1.title').text().trim() || $('h1').first().text().trim() || keyword.toUpperCase();
    const poster = $('.thumb img').attr('src') || $('.poster img').attr('src') || $('.mvic-thumb img').attr('src') || '';
    const synopsis = $('.desc p, .entry-content p, .konten-sinopsis').text().trim() || 'Tidak ada deskripsi.';

    const servers = [];
    $('iframe, embed').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('ads')) {
        if (src.startsWith('//')) src = 'https:' + src;
        servers.push({ name: 'Server Utama', url: src });
      }
    });

    $('.player-option select option, .dropdown-menu a, .server_select option').each((_, el) => {
      const name = $(el).text().trim();
      let value = $(el).attr('value') || $(el).attr('data-url') || $(el).attr('href');
      if (value && value.includes('http') && !servers.some(s => s.url === value)) {
        servers.push({ name: name || 'Server Alternatif', url: value });
      }
    });

    if (servers.length === 0) {
      servers.push({ name: 'Server Streaming', url: `https://v4.pusatfilm21info.net/embed/${cleanSlug}` });
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
