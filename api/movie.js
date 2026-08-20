import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const page = req.query.page || 1;
    const targetUrl = page > 1 
      ? `https://v4.pusatfilm21info.net/film-terbaru/page/${page}/` 
      : `https://v4.pusatfilm21info.net/film-terbaru/`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Gagal mengambil data dari PusatFilm21' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const data = [];

    // Selector menyesuaikan struktur umum situs streaming film/PusatFilm
    $('.item, article, .post-item, .ml-item').each((_, el) => {
      const title = $(el).find('h2, .title, .jt').text().trim();
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      const href = $(el).find('a').attr('href') || '';
      const quality = $(el).find('.quality, .q, .hd').text().trim() || 'HD';
      
      const slug = href.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');

      if (title && slug) {
        data.push({
          title,
          poster,
          slug,
          episode: quality,
          type: 'Movie'
        });
      }
    });

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
