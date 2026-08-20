import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const page = req.query.page || 1;
    
    // Header browser lengkap agar tidak langsung diblokir oleh Cloudflare/sumber
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // 1. Ambil domain aktif terbaru dari ngefilm.live
    const mainResponse = await fetch('https://ngefilm.live/', { headers });
    const mainHtml = await mainResponse.text();
    const $main = cheerio.load(mainHtml);
    
    let activeDomain = 'https://new39.ngefilm.site';
    $main('a').each((_, el) => {
      const href = $main(el).attr('href');
      if (href && href.includes('ngefilm') && !href.includes('ngefilm.live')) {
        activeDomain = href.replace(/\/$/, '');
      }
    });

    // 2. Ambil data dari domain aktif
    const targetUrl = page > 1 ? `${activeDomain}/page/${page}/` : `${activeDomain}/`;
    const response = await fetch(targetUrl, { headers });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Gagal mengakses domain aktif' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const data = [];

    // 3. Selektor penarikan data film
    $('.item, .post, .movies, article, .ml-item').each((_, el) => {
      const title = $(el).find('h2, .title, .jt, a').first().text().trim();
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      let href = $(el).find('a').attr('href') || '';
      const quality = $(el).find('.quality, .q, .hd, .label').text().trim() || 'HD';

      if (title && href) {
        if (!href.startsWith('http')) {
          href = `${activeDomain}${href.startsWith('/') ? '' : '/'}${href}`;
        }
        const slug = href.replace(activeDomain + '/', '').replace(/^\/+|\/+$/g, '');
        
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
