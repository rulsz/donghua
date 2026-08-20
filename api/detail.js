import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  let { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ success: false, message: 'Slug/path diperlukan' });
  }

  // Sanitasi slug dari prefix/suffix slash
  const cleanSlug = String(slug)
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/anime\//, '')
    .replace(/^\/episode\//, '')
    .replace(/^\/+|\/+$/g, '');

  // Daftar variasi URL Anichin yang akan dicoba
  const urlsToTry = [
    `https://anichin.site/anime/${cleanSlug}/`,
    `https://anichin.site/anime/${cleanSlug}-sub-indo/`,
    `https://anichin.site/${cleanSlug}/`,
    `https://anichin.site/${cleanSlug}-sub-indo/`
  ];

  let html = null;
  for (const targetUrl of urlsToTry) {
    try {
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 6000
      });
      if (response.data) {
        html = response.data;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!html) {
    return res.status(404).json({ success: false, message: 'Donghua tidak ditemukan di Anichin' });
  }

  try {
    const $ = cheerio.load(html);
    const title = $('.entry-title').text().trim() || $('.breadcrumb li:last-child').text().trim() || 'Judul Tidak Diketahui';
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

    // Ambil server video jika halaman yang dibuka adalah halaman episode
    const servers = [];
    $('.mirror option').each((_, el) => {
      const name = $(el).text().trim();
      const value = $(el).attr('value');
      if (value) {
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
    return res.status(500).json({ success: false, message: 'Gagal parsing data detail' });
  }
}
