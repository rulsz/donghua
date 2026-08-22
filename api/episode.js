const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // Set header CORS agar bisa dipanggil dari frontend Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ambil parameter page dari query URL (?page=2)
    const page = parseInt(req.query.page) || 1;
    
    // Tentukan URL target Animexin
    const targetUrl = page === 1 
      ? 'https://animexin.dev/' 
      : `https://animexin.dev/page/${page}/`;

    // Request HTML dari Animexin
    const { data: html } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    const $ = cheerio.load(html);
    const episodeList = [];

    // Parsing struktur card Animexin (.listupd .bs .bsx)
    $('.listupd .bs .bsx').each((i, el) => {
      const title = $(el).find('.tt').text().trim();
      const link = $(el).find('a').attr('href') || '';
      const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
      
      // Ambil teks episode langsung dari class .epx
      const rawEp = $(el).find('.epx').text().trim() || $(el).find('.bt .epx').text().trim() || '';
      const typeText = $(el).find('.typez').text().trim() || 'ONA';

      // Ekstraksi angka episode saja (contoh: "Episode 155" -> "155")
      const epMatch = rawEp.match(/\d+/);
      const epNumber = epMatch ? epMatch[0] : null;

      // Bersihkan slug dari URL link
      const slug = link
        .replace(/^https?:\/\/[^\/]+\//, '')
        .replace(/\/$/, '')
        .replace(/^[a-zA-Z0-9]+-episode-/, '') // opsi jika ingin slug bersih
        .replace(/-sub-indo.*$/, '');

      if (title) {
        episodeList.push({
          title,
          slug,
          link,
          poster,
          episode: rawEp,                   // "Episode 155" / "Ep 188"
          epNumber: epNumber ? parseInt(epNumber, 10) : null, // 155
          type: typeText
        });
      }
    });

    return res.status(200).json({
      success: true,
      page: page,
      totalResult: episodeList.length,
      data: episodeList
    });

  } catch (error) {
    console.error('Error scraping Animexin:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data episode dari Animexin',
      error: error.message
    });
  }
};
