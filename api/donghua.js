import * as cheerio from 'cheerio';

// Fungsi helper untuk mengambil episode terbaru dari halaman detail anime
async function fetchEpisodeFromDetail(animeSlug, headers) {
  try {
    // URL detail mengikuti struktur Animexin
    const detailUrl = `https://animexin.dev/${animeSlug}/`;
    const response = await fetch(detailUrl, { headers });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Mencari teks episode dari elemen list episode di halaman detail
    let latestEp = null;
    
    // Biasannya list episode ada di .eplister atau .episodelist
    $('.eplister ul li, .episodelist ul li').each((_, el) => {
      const epText = $(el).find('.epl-num, .eps-num').text().trim() || $(el).text();
      const match = epText.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!latestEp || num > latestEp) {
          latestEp = num;
        }
      }
    });

    if (latestEp) {
      return `Ep ${latestEp}`;
    }
    return null;
  } catch (err) {
    return null;
  }
}

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
        
        let rawEp = $(el).find('.epx, .bt .ep, .episode, .sb, .ep').first().text().trim();
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

    const targetUrl = pageNum > 1 
      ? `https://animexin.dev/anime/?page=${pageNum}&status=&type=&order=update` 
      : `https://animexin.dev/anime/?status=&type=&order=update`;

    const response = await fetch(targetUrl, { headers });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: `Status: ${response.status}` });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    let allItems = parseList($, '.listupd .bs, .article .bs, .post-show .bs');

    // Mengambil episode dari halaman detail secara paralel agar cepat dan akurat
    allItems = await Promise.all(allItems.map(async (item) => {
      if (item.slug) {
        const detailEp = await fetchEpisodeFromDetail(item.slug, headers);
        if (detailEp) {
          item.episode = detailEp;
        }
      }
      return item;
    }));

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
