import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { page = 1, slug } = req.query;

  // Handler jika meminta detail film berdasarkan slug
  if (slug) {
    const cleanSlug = String(slug)
      .replace(/^https?:\/\/[^\/]+/, '')
      .replace(/^\/movie\//, '')
      .replace(/^\/+|\/+$/g, '');

    const targetUrl = `https://themoviebox.xyz/movie/${cleanSlug}/`;

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        return res.status(404).json({ success: false, message: 'Film tidak ditemukan' });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $('.entry-title, h1.setting-headline').first().text().trim() || 'Judul Film';
      const poster = $('.poster img, .thumb img').attr('src') || '';
      const synopsis = $('.entry-content p, .synopsis p').text().trim() || 'Tidak ada deskripsi.';

      const servers = [];
      $('iframe, embed').each((_, el) => {
        const src = $(el).attr('src');
        if (src) servers.push({ name: 'Server Utama', url: src });
      });

      $('.mirror option, select.mirror option').each((_, el) => {
        const name = $(el).text().trim();
        const value = $(el).attr('value');
        if (value && value !== '') {
          servers.push({ name, url: value });
        }
      });

      return res.status(200).json({
        success: true,
        data: { title, poster, synopsis, servers, isMovie: true }
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil detail film' });
    }
  }

  // Handler jika meminta daftar rilis film terbaru
  try {
    const targetUrl = `https://themoviebox.xyz/movie/page/${page}/`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(200).json({ success: true, data: [] });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const movieList = [];

    $('.article, .poster-box, article').each((_, el) => {
      const title = $(el).find('.entry-title, .title, h2').text().trim();
      const href = $(el).find('a').attr('href') || '';
      const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
      const slug = href.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');

      if (slug && title) {
        movieList.push({
          title,
          slug,
          poster,
          type: 'Movie'
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: movieList
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar film' });
  }
}
