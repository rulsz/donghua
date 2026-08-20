import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const page = req.query.page || 1;
    // Kita langsung mencoba domain yang sering aktif atau halaman utama ngefilm
    let targetUrl = page > 1 
      ? `https://new39.ngefilm.site/page/${page}/` 
      : `https://new39.ngefilm.site/`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Gagal mengakses sumber' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const data = [];

    // Selektor baru yang lebih umum untuk struktur Ngefilm
    // Mengecek elemen yang biasanya berisi film: .search-item, .post, .item, .movies
    $('.item, .post, .movies, article, .ml-item').each((_, el) => {
      const title = $(el).find('h2, .title, .jt, a').first().text().trim();
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      let href = $(el).find('a').attr('href') || '';
      const quality = $(el).find('.quality, .q, .hd, .label').text().trim() || 'HD';

      if (title && href) {
        // Mengubah link relatif menjadi absolut
        if (!href.startsWith('http')) {
          href = `https://new39.ngefilm.site${href.startsWith('/') ? '' : '/'}${href}`;
        }
        
        const slug = href.replace('https://new39.ngefilm.site/', '').replace(/^\/+|\/+$/g, '');

        data.push({
          title,
          poster,
          slug,
          episode: quality,
          type: 'Movie'
        });
      }
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memproses data' });
  }
}
