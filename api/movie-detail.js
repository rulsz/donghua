import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    let { slug } = req.query;
    if (!slug) return res.status(400).json({ success: false });

    // Slug pembersih
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-]/g, '');
    const movieUrl = `https://v4.pusatfilm21info.net/${cleanSlug}/`;

    // Ambil Data Meta untuk Judul/Poster
    const response = await fetch(movieUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const title = $('.entry-title').text().trim() || 'Film';
    const poster = $('.thumb img').attr('src') || '';

    // INI SOLUSI UTAMA: Menggunakan layanan proxy yang menghapus header X-Frame-Options
    // Ini memungkinkan domain Anda merender iframe tersebut.
    const bypassUrl = `https://corsproxy.io/?${encodeURIComponent(movieUrl)}`;

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        isMovie: true,
        servers: [
          { name: 'Server Utama', url: bypassUrl },
          { name: 'Server Cadangan', url: `https://vidsrc.xyz/embed/movie?title=${encodeURIComponent(title)}` }
        ]
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false });
  }
}
