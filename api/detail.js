import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  let { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ success: false, message: 'Path/Slug diperlukan' });
  }

  // Sanitasi slug dari URL penuh atau prefix
  const cleanSlug = String(slug)
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/anime\//, '')
    .replace(/^\/episode\//, '')
    .replace(/^\/+|\/+$/g, '');

  // Daftar variasi rute Anichin
  const slugVariants = [
    cleanSlug,
    `${cleanSlug}-sub-indo`,
    cleanSlug.replace(/-sub-indo$/, '')
  ];

  let html = null;

  for (const variant of slugVariants) {
    const targetUrl = `https://anichin.site/anime/${variant}/`;
    
    try {
      // Menggunakan Proxy Jina Reader untuk bypass Cloudflare Anichin
      const proxyApiUrl = `https://r.jina.ai/${targetUrl}`;
      const response = await fetch(proxyApiUrl, {
        headers: {
          'X-Target-Url': targetUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const text = await response.text();
        if (text && text.includes('eplister')) {
          html = text;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }

  // Fallback 2: Jika Anichin gagal, coba fetch direct HTML via proxy alternative
  if (!html) {
    for (const variant of slugVariants) {
      try {
        const altUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://anichin.site/anime/${variant}/`)}`;
        const resAlt = await fetch(altUrl);
        if (resAlt.ok) {
          const textAlt = await resAlt.text();
          if (textAlt && (textAlt.includes('eplister') || textAlt.includes('entry-title'))) {
            html = textAlt;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  if (!html) {
    return res.status(404).json({ success: false, message: 'Detail donghua tidak ditemukan' });
  }

  try {
    const $ = cheerio.load(html);
    
    // Parsing Data Detail
    const title = $('.entry-title').text().trim() || $('h1').first().text().trim() || 'Judul Tidak Diketahui';
    const poster = $('.thumb img').attr('src') || $('.poster img').attr('src') || '';
    const synopsis = $('.entry-content p').text().trim() || $('.synopsis p').text().trim() || 'Tidak ada deskripsi.';

    const episodes = [];
    $('.eplister ul li a').each((_, el) => {
      const epTitle = $(el).find('.epl-title').text().trim() || $(el).text().trim();
      const epHref = $(el).attr('href') || '';
      const epSlug = epHref.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
      if (epSlug) {
        episodes.push({ title: epTitle, slug: epSlug });
      }
    });

    const servers = [];
    $('.mirror option').each((_, el) => {
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
    return res.status(500).json({ success: false, message: 'Gagal melakukan parsing data HTML' });
  }
}
