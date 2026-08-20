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

    const keyword = cleanSlug.replace(/-/g, ' ').replace(/\b(2025|2026)\b/g, '').trim();

    let title = keyword.toUpperCase();
    let poster = '';
    let synopsis = 'Sinopsis tidak tersedia.';
    let movieUrl = `https://v4.pusatfilm21info.net/${cleanSlug}/`;

    // 1. Cari halaman film di situs sumber
    try {
      const searchResp = await fetch(`https://v4.pusatfilm21info.net/?s=${encodeURIComponent(keyword)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (searchResp.ok) {
        const searchHtml = await searchResp.text();
        const $$ = cheerio.load(searchHtml);
        const firstLink = $$('.item a, article a, .ml-item a, .post-item a').first().attr('href');
        if (firstLink) movieUrl = firstLink;
      }
    } catch (e) {}

    // 2. Ambil HTML halaman detail film
    let html = '';
    try {
      const resp = await fetch(movieUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (resp.ok) {
        html = await resp.text();
      }
    } catch (e) {}

    const $ = cheerio.load(html);
    title = $('.entry-title').first().text().trim() || $('h1.title').first().text().trim() || title;
    poster = $('.thumb img').attr('src') || $('.poster img').attr('src') || '';
    synopsis = $('.desc p, .entry-content p, .konten-sinopsis').text().trim() || synopsis;

    const servers = [];

    // 3. Ekstrak iframe yang benar-benar memuat pemutar video (biasanya mengandung 'embed', 'player', atau domain streaming pihak ketiga)
    $('iframe, embed').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        // Pastikan bukan iframe iklan atau landing page utama
        if (!src.includes('facebook') && !src.includes('disqus') && !src.includes('ads') && !src.includes('pusatfilm') && !src.includes('official')) {
          servers.push({ name: 'Server Player', url: src });
        }
      }
    });

    // 4. Jika iframe di halaman utama tidak ditemukan, buatkan URL embed langsung dari layanan pemutar publik yang bersih
    if (servers.length === 0) {
      servers.push({
        name: 'Server HD Utama',
        url: `https://vidsrc.xyz/embed/movie?title=${encodeURIComponent(keyword)}`
      });
      servers.push({
        name: 'Server Alternatif',
        url: `https://vidsrc.cc/v2/embed/movie?q=${encodeURIComponent(keyword)}`
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
