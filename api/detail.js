import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  try {
    let { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug diperlukan' });
    }

    const cleanSlug = String(slug)
      .replace(/^https?:\/\/[^\/]+/, '')
      .replace(/^\/?detail\//, '')
      .replace(/^\/?anime\//, '')
      .replace(/^\/?episode\//, '')
      .replace(/^\/+|\/+$/g, '');

    const urlsToTry = [
      `https://animexin.dev/anime/${cleanSlug}/`,
      `https://animexin.dev/${cleanSlug}/`,
      `https://animexin.dev/anime/${cleanSlug}-sub-indo/`,
      `https://animexin.dev/${cleanSlug}-sub-indo/`
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
          if (text && (text.includes('eplister') || text.includes('entry-title') || text.includes('eps'))) {
            html = text;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!html) {
      try {
        const searchRes = await fetch(`https://animexin.dev/?s=${encodeURIComponent(cleanSlug.replace(/-/g, ' '))}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const searchHtml = await searchRes.text();
        const $$ = cheerio.load(searchHtml);
        const firstResultUrl = $$('.bs.rax a, .animpost a, .bsx a').first().attr('href');
        
        if (firstResultUrl) {
          const secondRes = await fetch(firstResultUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (secondRes.ok) {
            html = await secondRes.text();
          }
        }
      } catch (err) {}
    }

    if (!html) {
      return res.status(404).json({ success: false, message: 'Donghua/Episode tidak ditemukan di Animexin' });
    }

    const $ = cheerio.load(html);

    const title = $('.entry-title').first().text().trim() || $('h1.entry-title').text().trim() || 'Judul Donghua';
    const poster = $('.thumb img').attr('src') || $('.poster img').attr('src') || '';
    
    let synopsis = 'Tidak ada deskripsi.';
    try {
      let rawSynopsis = $('.entry-content p').text().trim() || $('.desc p').text().trim() || '';
      if (rawSynopsis) {
        synopsis = rawSynopsis;
        const matchIndo = rawSynopsis.match(/(indonesia|indonesian)([\s\S]*)/i);
        if (matchIndo && matchIndo[2]) {
          synopsis = matchIndo[2].trim();
        } else if (rawSynopsis.includes('English')) {
          synopsis = rawSynopsis.replace(/^English/i, '').trim();
        }
      }
    } catch (err) {}

    // Ambil daftar episode secara natural tanpa sorting agar indeks array sinkron dengan tombol frontend
    let episodes = [];
    try {
      $('.eplister ul li a, .eplist ul li a').each((_, el) => {
        const epTitle = $(el).find('.epl-title').text().trim() || $(el).find('.epl-num').text().trim() || $(el).text().trim();
        const epHref = $(el).attr('href') || '';
        const epSlug = epHref.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
        
        if (epSlug && !episodes.some(e => e.slug === epSlug)) {
          episodes.push({ title: epTitle, slug: epSlug });
        }
      });
    } catch (err) {}

    const servers = [];
    try {
      $('iframe, embed').each((_, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('ads')) {
          if (src.startsWith('//')) src = 'https:' + src;
          servers.push({ name: 'Server Utama', url: src });
        }
      });
    } catch (err) {}

    try {
      $('.mirror option, select.mirror option, .select-service option').each((_, el) => {
        const name = $(el).text().trim();
        let value = $(el).attr('value');
        
        if (value && value !== '') {
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
    } catch (err) {}

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
