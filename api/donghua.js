import * as cheerio from 'cheerio';

// Fungsi untuk mengambil nomor episode terbaru dari AniList API berdasarkan judul
async function fetchEpisodeFromAniList(title) {
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          episodes
          nextAiringEpisode {
            episode
          }
        }
      }
    `;

    // Beri timeout 1.5 detik agar Vercel tidak lambat/timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables: { search: title } }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const json = await response.json();
    if (json.data && json.data.Media) {
      const media = json.data.Media;
      if (media.nextAiringEpisode && media.nextAiringEpisode.episode > 1) {
        return `Ep ${media.nextAiringEpisode.episode - 1}`;
      }
      if (media.episodes) {
        return `Ep ${media.episodes}`;
      }
    }
    return null;
  } catch (e) {
    return null; // Fallback aman jika gagal
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
        
        // Fallback awal jika AniList tidak merespons
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

    // Ambil data episode dari AniList secara paralel untuk setiap judul donghua yang ditemukan
    allItems = await Promise.all(allItems.map(async (item) => {
      const aniListEp = await fetchEpisodeFromAniList(item.title);
      if (aniListEp) {
        item.episode = aniListEp;
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
