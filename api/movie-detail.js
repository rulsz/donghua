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
    
    // Coba ambil metadata judul & poster asli dari situs sumber
    try {
      const resp = await fetch(`https://v4.pusatfilm21info.net/${cleanSlug}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (resp.ok) {
        const html = await resp.text();
        const $ = cheerio.load(html);
        title = $('.entry-title').first().text().trim() || $('h1.title').first().text().trim() || title;
        poster = $('.thumb img').attr('src') || $('.poster img').attr('src') || '';
        synopsis = $('.desc p, .entry-content p, .konten-sinopsis').text().trim() || synopsis;
      }
    } catch (e) {}

    // Sediakan server pemutar video alternatif yang bersih dari landing page
    const servers = [
      {
        name: 'Server Utama HD',
        url: `https://database.gdriveplayer.us/player.php?imdb=${encodeURIComponent(keyword)}`
      },
      {
        name: 'Server Alternatif',
        url: `https://vidsrc.xyz/embed/movie?title=${encodeURIComponent(keyword)}`
      },
      {
        name: 'Server Cadangan',
        url: `https://iframe.mediadelivery.net/embed/search?q=${encodeURIComponent(keyword)}`
      }
    ];

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
