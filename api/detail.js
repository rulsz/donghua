import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  let { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ success: false, message: 'Slug diperlukan' });
  }

  // Bersihkan slug dari prefix/suffix URL
  const cleanSlug = String(slug)
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/?detail\//, '')
    .replace(/^\/?anime\//, '')
    .replace(/^\/?episode\//, '')
    .replace(/^\/+|\/+$/g, '');

  // Daftar variasi pola URL untuk Animexin
  const urlsToTry = [
    `https://animexin.dev/${cleanSlug}/`,
    `https://animexin.dev/anime/${cleanSlug}/`,
    `https://animexin.dev/${cleanSlug}-sub-indo/`,
    `https://animexin.dev/anime/${cleanSlug}-sub-indo/`
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
        if (text && (text.includes('eplister') || text.includes('entry-title') || text.includes('infox') || text.includes('embed') || text.includes('iframe'))) {
          html = text;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }

  if (!html) {
    return res.status(404).json({ success: false, message: 'Donghua/Episode tidak ditemukan di Animexin' });
  }

  try {
    const $ = cheerio.load(html);

    const title = $('.entry-title').first().text().trim() || $('h1.entry-title').text().trim() || 'Judul Donghua';
    const poster = $('.thumb img').attr('src') || $('.poster img').attr('src') || '';
    
    // Extrak dan bersihkan sinopsis agar hanya mengambil bagian Bahasa Indonesia
    let rawSynopsis = $('.entry-content p').text().trim() || $('.desc p').text().trim() || 'Tidak ada deskripsi.';
    let synopsis = rawSynopsis;

    if (rawSynopsis.includes('Indonesia')) {
      synopsis = rawSynopsis.split('Indonesia').pop().trim();
    } else if (rawSynopsis.includes('Indonesian')) {
      synopsis = rawSynopsis.split('Indonesian').pop().trim();
    }

    // Ambil daftar episode
    const episodes = [];
    $('.eplister ul li a, .eplist ul li a').each((_, el) => {
      const epTitle = $(el).find('.epl-title').text().trim() || $(el).find('.epl-num').text().trim() || $(el).text().trim();
      const epHref = $(el).attr('href') || '';
      
      const epSlug = epHref.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
      if (epSlug && !episodes.some(e => e.slug === epSlug)) {
        episodes.push({ title: epTitle, slug: epSlug });
      }
    });

    // Pastikan urutan episode berurutan dari episode terbesar ke terkecil (145 ke 1)
    if (episodes.length > 1) {
      const firstEpNum = parseInt((episodes[0].title.match(/\d+/) || [0])[0]);
      const lastEpNum = parseInt((episodes[episodes.length - 1].title.match(/\d+/) || [0])[0]);
      
      // Jika episode pertama lebih kecil dari episode terakhir, balikkan urutannya
      if (firstEpNum < lastEpNum) {
        episodes.reverse();
      }
    }

    // Ekstrak Server Video / Player Iframe
    const servers = [];

    // Iframe bawaan di halaman
    $('iframe, embed').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('ads')) {
        if (src.startsWith('//')) src = 'https:' + src;
        servers.push({ name: 'Server Utama', url: src });
      }
    });

    // Opsi pilihan Server Mirror
    $('.mirror option, select.mirror option, .select-service option').each((_, el) => {
      const name = $(el).text().trim();
      let value = $(el).attr('value');
      
      if (value && value !== '') {
        // Dekode jika nilai di-encode Base64
        if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 20) {
          try {
            const decoded = Buffer.from(value, 'base64').toString('utf-8');
            if (decoded.includes('http') || decoded.includes('iframe')) {
              const match = decoded.match(/src=["']([^"']+)["']/);
              value = match ? match[1] : decoded;
            }
          } catch (e) {}
        }

        if (value.startsWith('//')) value = 'https:' + value;
        
        if (value.includes('http') && !servers.some(s => s.url === value)) {
          servers.push({ name: name || 'Server Mirror', url: value });
        }
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
