import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const { type = 'all', page = 1 } = req.query;
    const pageNum = parseInt(page) || 1;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    };

    const parseList = ($, selector) => {
      const result = [];
      $(selector).each((_, el) => {
        const title = $(el).find('h2, .title, .tt, .entry-title').first().text().trim();
        const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
        let href = $(el).find('a').attr('href') || '';
        const episode = $(el).find('.bt .ep, .epx, .episode, .sb').text().trim() || 'Ongoing';

        if (title && href) {
          const slug = href.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');
          result.push({ title, poster, slug, episode, type: 'Donghua' });
        }
      });
      return result;
    };

    // 1. Ambil Data Gabungan Beranda
    if (type === 'all') {
      const response = await fetch('https://animexin.dev/', { headers });
      if (!response.ok) return res.status(404).json({ success: false, message: 'Gagal akses domain Animexin' });

      const html = await response.text();
      const $ = cheerio.load(html);

      const popularToday = parseList($, '.popular .bs, .popseries-content .bs, .serieslist.pop .bs, .wpp-list li').slice(0, 10);
      const latest = parseList($, '.post-show .bs, .listupd .bs, .article .bs').slice(0, 15);
      const popularAll = parseList($, '.serieslist .bs, .poppost .bs, .sidebar .bs').slice(0, 10);

      return res.status(200).json({
        success: true,
        data: { popularToday, latest, popularAll }
      });
    }

    // 2. Ambil 30 Data untuk Modal Dialog "Lihat Semua" + Load More
    if (type === 'latest') {
      const targetUrl = pageNum > 1 ? `https://animexin.dev/page/${pageNum}/` : 'https://animexin.dev/';
      const response = await fetch(targetUrl, { headers });
      if (!response.ok) return res.status(404).json({ success: false });

      const html = await response.text();
      const $ = cheerio.load(html);
      const latestList = parseList($, '.post-show .bs, .listupd .bs, .article .bs').slice(0, 30);

      return res.status(200).json({ success: true, page: pageNum, data: latestList });
    }

    // 3. Fallback Standard Fetch
    const targetUrl = pageNum > 1 ? `https://animexin.dev/page/${pageNum}/` : 'https://animexin.dev/';
    const response = await fetch(targetUrl, { headers });
    if (!response.ok) return res.status(404).json({ success: false });

    const html = await response.text();
    const $ = cheerio.load(html);
    const data = parseList($, '.post-show .bs, .listupd .bs, .article .bs');

    return res.status(200).json({ success: true, page: pageNum, data });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
