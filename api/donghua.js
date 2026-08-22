import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const { type = 'all', page = 1 } = req.query;
    const pageNum = parseInt(page) || 1;

    // Menggunakan target URL arsip/halaman Animexin
    const targetUrl = pageNum > 1 
      ? `https://animexin.dev/page/${pageNum}/` 
      : `https://animexin.dev/`;

    // Menggunakan layanan public CORS proxy bebas blokir untuk menjembatani Vercel & Animexin
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: `Proxy Status: ${response.status}` });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const cleanTitle = (rawTitle) => {
      if (!rawTitle) return '';
      const text = rawTitle.trim();
      const halfLength = Math.floor(text.length / 2);
      if (text.length % 2 === 0 && text.substring(0, halfLength) === text.substring(halfLength)) {
        return text.substring(0, halfLength).trim();
      }
      return text;
    };

    const result = [];
    $('.listupd .bs, .bsx, .article .bs, .post-show .bs').each((_, el) => {
      let rawTitle = $(el).find('h2, h3, .title, .tt, .entry-title, .series-title').first().text();
      const title = cleanTitle(rawTitle);

      let poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      let href = $(el).find('a').first().attr('href') || '';
      
      // Mengambil teks episode dari elemen poster Animexin (.epx / .bt .epx)
      let rawEp = $(el).find('.epx, .bt .epx, .bt .ep, .episode, .sb, .ep').first().text().trim();
      let epNumber = 'Ep 1';

      if (rawEp) {
        const numMatch = rawEp.match(/\d+/);
        if (numMatch) epNumber = `Ep ${numMatch[0]}`;
      }

      let status = $(el).find('.status, .typez').first().text().trim() || 'Ongoing';

      if (title && href) {
        const slug = href.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');
        result.push({ title, poster, slug, status, episode: epNumber, type: 'Donghua' });
      }
    });

    if (!type || type === 'all') {
      return res.status(200).json({
        success: true,
        data: {
          popularToday: result.slice(0, 10),
          latest: result.slice(0, 15),
          popularAll: result.slice(5, 15)
        }
      });
    }

    if (type === 'latest') {
      return res.status(200).json({ success: true, page: pageNum, data: result.slice(0, 30) });
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
