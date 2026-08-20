import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const page = req.query.page || 1;
    let targetUrl = page > 1 
      ? `https://ngefilm.live/page/${page}/` 
      : `https://ngefilm.live/`;

    let response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Gagal mengakses situs' });
    }

    let html = await response.text();
    let $ = cheerio.load(html);

    // Cek apakah halaman tersebut adalah halaman info update domain (mengandung teks "Info Live Update" atau tautan domain baru)
    const pageText = $('body').text();
    if (pageText.includes('Info Live Update') || pageText.includes('Alamat Website') || $('.item, article, .ml-item').length === 0) {
      // Ambil link domain aktif terbaru dari halaman pengumuman (misal: new39.ngefilm.site atau domain aktif di dalamnya)
      let activeDomainLink = '';
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.includes('ngefilm') && !href.includes('ngefilm.live')) {
          activeDomainLink = href;
        }
      });

      if (activeDomainLink) {
        targetUrl = page > 1 ? `${activeDomainLink.replace(/\/$/, '')}/page/${page}/` : activeDomainLink;
        response = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (response.ok) {
          html = await response.text();
          $ = cheerio.load(html);
        }
      }
    }

    const data = [];

    // Mengambil daftar film dari domain aktif yang sebenarnya
    $('.item, article, .ml-item, .post').each((_, el) => {
      const title = $(el).find('h2, .title, .jt, a').first().text().trim();
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      let href = $(el).find('a').attr('href') || '';
      const quality = $(el).find('.quality, .q, .hd').text().trim() || 'HD';

      if (title && href) {
        const slug = href.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');
        if (slug) {
          data.push({
            title,
            poster,
            slug,
            episode: quality,
            type: 'Movie'
          });
        }
      }
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
