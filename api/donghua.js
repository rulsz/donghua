import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { page = 1 } = req.query;

  try {
    const targetUrl = `https://animexin.dev/anime/?page=${page}&status=&type=&order=update`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(200).json({ success: true, data: [] });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const list = [];

    $('.listupd .bs, .animposx').each((_, el) => {
      const title = $(el).find('.tt, .title').text().trim();
      const href = $(el).find('a').attr('href') || '';
      const poster = $(el).find('img').attr('src') || '';
      const episode = $(el).find('.epx, .bt .ep').text().trim();
      const slug = href.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');

      if (slug && title) {
        list.push({
          title,
          slug,
          poster,
          episode,
          type: 'Donghua'
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat data Donghua' });
  }
}
