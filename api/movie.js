import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const page = req.query.page || 1;
    
    // Menggunakan domain langsung yang stabil untuk menghindari halaman redirect/info update
    const targetUrl = page > 1 
      ? `https://new39.ngefilm.site/page/${page}/` 
      : `https://new39.ngefilm.site/`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Referer': 'https://new39.ngefilm.site/'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Gagal mengambil data film' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const data = [];

    // Selektor elemen film
    $('.item, .post, .movies, article, .ml-item').each((_, el) => {
      const title = $(el).find('h2, .title, .jt, a').first().text().trim();
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      let href = $(el).find('a').attr('href') || '';
      const quality = $(el).find('.quality, .q, .hd, .label').text().trim() || 'HD';

      if (title && href) {
        if (!href.startsWith('http')) {
          href = `https://new39.ngefilm.site${href.startsWith('/') ? '' : '/'}${href}`;
        }
        const slug = href.replace('https://new39.ngefilm.site/', '').replace(/^\/+|\/+$/g, '');
        
        if (slug) {
          data.push({ title, poster, slug, episode: quality, type: 'Movie' });
        }
      }
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
