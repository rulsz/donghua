const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // Set Header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const type = req.query.type || 'all';
    const page = parseInt(req.query.page) || 1;

    // Tentukan URL target Animexin berdasarkan parameter page
    const targetUrl = page === 1 
      ? 'https://animexin.dev/' 
      : `https://animexin.dev/page/${page}/`;

    const { data: html } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    const $ = cheerio.load(html);

    // Fungsi Pembantu untuk Memproses Set Tiap Card Animexin
    function parseAnimexinCards(selector) {
      const items = [];
      $(selector).each((i, el) => {
        const title = $(el).find('.tt').text().trim();
        const link = $(el).find('a').attr('href') || '';
        const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
        
        // LOGIKA UTAMA: Mengambil teks episode langsung dari Animexin (.epx / .bt .epx)
        const rawEp = $(el).find('.epx').text().trim() || $(el).find('.bt .epx').text().trim() || '';
        const typeText = $(el).find('.typez').text().trim() || 'ONA';

        // Ekstraksi angka episode (misal: "Episode 155" -> "Ep 155")
        const epMatch = rawEp.match(/\d+/);
        const formattedEp = epMatch ? `Ep ${epMatch[0]}` : (rawEp || 'ONGOING');

        // Pembersihan Slug Utama
        const cleanSlug = link
          .replace(/^https?:\/\/[^\/]+\//, '')
          .replace(/\/$/, '')
          .replace(/-episode-\d+.*$/i, '');

        if (title) {
          items.push({
            title,
            slug: cleanSlug,
            link,
            poster,
            episode: formattedEp, // Properti ini yang dibaca oleh index.html
            type: typeText
          });
        }
      });
      return items;
    }

    // 1. Jika permintaan khusus untuk pagination / latest
    if (type === 'latest') {
      const latestItems = parseAnimexinCards('.listupd .bs .bsx');
      return res.status(200).json({
        success: true,
        page: page,
        data: latestItems
      });
    }

    // 2. Jika permintaan type=all (default beranda)
    const popularToday = parseAnimexinCards('#content .popular .bs .bsx, .popularToday .bs .bsx');
    const latestList = parseAnimexinCards('.listupd .bs .bsx');
    
    // Jika bagian Popular Today di HTML Animexin kosong, gunakan fallback slice
    const finalPopularToday = popularToday.length > 0 
      ? popularToday 
      : latestList.slice(0, 5);

    return res.status(200).json({
      success: true,
      data: {
        latest: latestList,
        popularToday: finalPopularToday,
        popularAll: latestList
      }
    });

  } catch (error) {
    console.error('Error in donghua.js scraping:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data dari Animexin',
      error: error.message
    });
  }
};
