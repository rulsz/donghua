import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  let { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ success: false, message: 'Slug/Path diperlukan' });
  }

  const cleanSlug = String(slug)
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/anime\//, '')
    .replace(/^\/episode\//, '')
    .replace(/^\/+|\/+$/g, '');

  const urlsToTry = [
    `https://animexin.dev/anime/${cleanSlug}/`,
    `https://animexin.dev/${cleanSlug}/`,
    `https://animexin.dev/anime/${cleanSlug.replace(/-sub-indo$/, '')}/`
  ];

  let html = null;

  for (const targetUrl of urlsToTry) {
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (response.ok) {
        const text = await response.text();
        if (text && (text.includes('eplister') || text.includes('entry-title') || text.includes('infox'))) {
          html = text;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }

  if (!html) {
    return res.status(404).json({ success: false, message: 'Donghua tidak ditemukan di Animexin' });
  }

  try {
    const $ = cheerio.load(html);

    const title = $('.entry-title').text().trim() || $('h1.entry-title').text().trim() || 'Judul Donghua';
    const poster = $('.thumb img').attr('src') || $('.poster img').attr('src') || '';
    const synopsis = $('.entry-content p').text().trim() || $('.desc p').text().trim() || 'Tidak ada deskripsi.';

    const episodes = [];
    $('.eplister ul li a, .eplist ul li a').each((_, el) => {
      const epTitle = $(el).find('.epl-title').text().trim() || $(el).find('.epl-num').text().trim() || $(el).text().trim();
      const epHref = $(el).attr('href') || '';
      const epSlug = epHref.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
      if (epSlug && !episodes.some(e => e.slug === epSlug)) {
        episodes.push({ title: epTitle, slug: epSlug });
      }
    });

    const servers = [];
    $('.mirror option, select.mirror option').each((_, el) => {
      const name = $(el).text().trim();
      const value = $(el).attr('value');
      if (value && value !== '') {
        servers.push({ name, url: value });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        episodes,
        servers
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal parsing data Animexin' });
  }
}
