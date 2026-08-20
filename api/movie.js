import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const page = req.query.page || 1;
    
    // 1. Mengambil domain aktif terbaru dari ngefilm.live
    const mainResponse = await fetch('https://ngefilm.live/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const mainHtml = await mainResponse.text();
    const $main = cheerio.load(mainHtml);
    
    // Mencari link domain aktif (biasanya berupa link yang bukan ngefilm.live)
    let activeDomain = 'https://new39.ngefilm.site'; // Fallback default
    $main('a').each((_, el) => {
      const href = $main(el).attr('href');
      if (href && href.includes('ngefilm') && !href.includes('ngefilm.live')) {
        activeDomain = href.replace(/\/$/, '');
      }
    });

    // 2. Mengambil data dari domain aktif yang ditemukan
    const targetUrl = page > 1 ? `${activeDomain}/page/${page}/` : `${activeDomain}/`;
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!response.ok) return res.status(404).json({ success: false, message: 'Gagal akses domain baru' });

    const html = await response.text();
    const $ = cheerio.load(html);
    const data = [];

    // 3. Selektor fleksibel untuk mengambil data film
    $('.item, .post, .movies, article, .ml-item').each((_, el) => {
      const title = $(el).find('h2, .title, .jt, a').first().text().trim();
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      let href = $(el).find('a').attr('href') || '';
      const quality = $(el).find('.quality, .q, .hd, .label').text().trim() || 'HD';

      if (title && href) {
        const slug = href.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');
        data.push({ title, poster, slug, episode: quality, type: 'Movie' });
      }
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
