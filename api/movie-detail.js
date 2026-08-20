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

    const $ = html ? cheerio.load(html) : null;

    const title = $ ? ($('.entry-title').first().text().trim() || $('h1.title').text().trim() || keyword.toUpperCase()) : keyword.toUpperCase();
    const poster = $ ? ($('.thumb img').attr('src') || $('.poster img').attr('src') || '') : '';
    const synopsis = $ ? ($('.desc p, .entry-content p, .konten-sinopsis').text().trim() || 'Tidak ada deskripsi.') : 'Tidak ada deskripsi.';

    // Saring iframe agar tidak memuat halaman utama/landing page situs sumber
    const servers = [];
    if ($) {
      $('iframe, embed').each((_, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('ads') && !src.includes('official') && !src.includes('pusatfilm')) {
          if (src.startsWith('//')) src = 'https:' + src;
          servers.push({ name: 'Server Utama', url: src });
        }
      });
    }

    // Jika tidak ada iframe bersih yang ditemukan, gunakan pemutar alternatif yang aman dari blokir landing page
    if (servers.length === 0) {
      servers.push({ 
        name: 'Server HD 1', 
        url: `https://v4.pusatfilm21info.net/embed/${cleanSlug}` 
      });
      servers.push({ 
        name: 'Server HD 2', 
        url: `https://multimovies.cloud/embed/${cleanSlug}` 
      });
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
