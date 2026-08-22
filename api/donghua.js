import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    const { type = 'all', page = 1 } = req.query;
    const pageNum = parseInt(page) || 1;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://animexin.dev/anime/'
    };

    // Helper pembersih judul ganda
    const cleanTitle = (rawTitle) => {
      if (!rawTitle) return '';
      const text = rawTitle.trim();
      const halfLength = Math.floor(text.length / 2);
      
      if (text.length % 2 === 0 && text.substring(0, halfLength) === text.substring(halfLength)) {
        return text.substring(0, halfLength).trim();
      }
      
      const words = text.split(/\s+/);
      const halfWords = Math.floor(words.length / 2);
      if (words.length > 1 && words.slice(0, halfWords).join(' ') === words.slice(halfWords).join(' ')) {
        return words.slice(0, halfWords).join(' ');
      }
      return text;
    };

    const parseList = ($, selector) => {
      const result = [];
      $(selector).each((_, el) => {
        let rawTitle = $(el).find('h2, h3, .title, .tt, .entry-title, .series-title').first().text();
        const title = cleanTitle(rawTitle);

        let poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
        let href = $(el).find('a').first().attr('href') || '';
        
        // Pengekstrakkan episode yang lebih akurat dari elemen Animexin
        let rawEp = $(el).find('.epx, .bt .ep, .episode, .sb, .ep, .bt .epx').first().text().trim();
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
      return result;
    };

    // Mendukung halaman pagination (page=2, page=3, dst)
    const targetUrl = pageNum > 1 
      ? `https://animexin.dev/anime/?page=${pageNum}&status=&type=&order=update` 
      : `https://animexin.dev/anime/?status=&type=&order=update`;

    const response = await fetch(targetUrl, { headers });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: `Status: ${response.status}` });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const allItems = parseList($, '.listupd .bs, .article .bs, .post-show .bs');

    if (!type || type === 'all') {
      return res.status(200).json({
        success: true,
        data: {
          popularToday: allItems.slice(0, 10),
          latest: allItems.slice(0, 15),
          popularAll: allItems.slice(5, 15)
        }
      });
    }

    if (type === 'latest') {
      return res.status(200).json({ success: true, page: pageNum, data: allItems.slice(0, 30) });
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
