import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const { type, page = 1 } = req.query;
    const pageNum = parseInt(page) || 1;

    // Header LENGKAP penyamaran browser (Anti-Cloudflare/Anti-Bot)
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not-A.Brand";v="99", "Chromium";v="124", "Google Chrome";v="124"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://animexin.dev/'
    };

    const parseList = ($, selector) => {
      const result = [];
      $(selector).each((_, el) => {
        const title = $(el).find('h2, h3, .title, .tt, .entry-title, .series-title, .lft .series').first().text().trim();
        let poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
        let href = $(el).find('a').first().attr('href') || '';
        const episode = $(el).find('.bt .ep, .epx, .episode, .sb, .ep, .egp').first().text().trim() || 'Ongoing';

        if (title && href) {
          const slug = href.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');
          result.push({ title, poster, slug, episode, type: 'Donghua' });
        }
      });
      return result;
    };

    // Tentukan URL Target
    let targetUrl = 'https://animexin.dev/';
    if (type === 'latest') {
      targetUrl = pageNum > 1 
        ? `https://animexin.dev/anime/?page=${pageNum}&status=&type=&order=update` 
        : `https://animexin.dev/anime/?status=&type=&order=update`;
    }

    // Fetch dengan Anti-Bot Headers
    const response = await fetch(targetUrl, { 
      headers,
      redirect: 'follow'
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        message: `Animexin merespon status HTTP: ${response.status}` 
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // MODE 1: Mode Beranda Utama (Default atau type=all)
    if (!type || type === 'all') {
      const latest = parseList($, '.utao .uta, .post-show .bs, .listupd .bs, .article .bs').slice(0, 15);
      let popularToday = parseList($, '.popular .bs, .popseries-content .bs, .serieslist.pop .bs, .wpp-list li, .popseries-content .item').slice(0, 10);
      let popularAll = parseList($, '.serieslist .bs, .poppost .bs, .sidebar .bs, .serieslist ul li').slice(0, 10);

      if (popularToday.length === 0) popularToday = latest.slice(0, 8);
      if (popularAll.length === 0) popularAll = latest.slice(5, 15);

      return res.status(200).json({
        success: true,
        data: { popularToday, latest, popularAll }
      });
    }

    // MODE 2: Mode Dialog "Lihat Semua" (type=latest)
    if (type === 'latest') {
      const latestList = parseList($, '.listupd .bs, .article .bs, .post-show .bs').slice(0, 30);
      return res.status(200).json({ success: true, page: pageNum, data: latestList });
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
