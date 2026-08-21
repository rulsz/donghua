import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const type = req.query.type || 'all'; // 'all' (beranda), 'latest' (semua terbaru + pagination), 'popular_today', 'popular_all'
    const page = parseInt(req.query.page) || 1;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    // Helper parser elemen produk
    const parseItems = ($, selector) => {
      const items = [];
      $(selector).each((_, el) => {
        const title = $(el).find('h2, .title, .tt, .entry-title').first().text().trim();
        const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
        let href = $(el).find('a').attr('href') || '';
        const episode = $(el).find('.bt .ep, .epx, .episode, .sb').text().trim() || 'Ongoing';

        if (title && href) {
          const slug = href.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');
          items.push({ title, poster, slug, episode });
        }
      });
      return items;
    };

    // MODE 1: Request Halaman Beranda Gabungan
    if (type === 'all') {
      const response = await fetch('https://animexin.vip/', { headers });
      if (!response.ok) return res.status(404).json({ success: false });

      const html = await response.text();
      const $ = cheerio.load(html);

      // 1. Populer Hari Ini
      const popularToday = parseItems($, '.popular .bs, .popseries-content .bs, .serieslist.pop .bs, .wpp-list li').slice(0, 10);

      // 2. Donghua Terbaru (Hanya 15)
      const latest = parseItems($, '.post-show .bs, .listupd .bs, .article .bs').slice(0, 15);

      // 3. Donghua Populer (Populer Sepanjang Masa)
      const popularAll = parseItems($, '.serieslist .bs, .poppost .bs, .sidebar .bs').slice(0, 10);

      return res.status(200).json({
        success: true,
        data: {
          popularToday,
          latest,
          popularAll
        }
      });
    }

    // MODE 2: Request Khusus Modal/Dialog "Lihat Semua Donghua Terbaru" (30 item + Load More)
    if (type === 'latest') {
      const targetUrl = page > 1 ? `https://animexin.vip/page/${page}/` : 'https://animexin.vip/';
      const response = await fetch(targetUrl, { headers });
      if (!response.ok) return res.status(404).json({ success: false });

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Ambil hingga 30 data per halaman
      const latestList = parseItems($, '.post-show .bs, .listupd .bs, .article .bs').slice(0, 30);

      return res.status(200).json({
        success: true,
        page,
        data: latestList
      });
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data Animexin' });
  }
}
