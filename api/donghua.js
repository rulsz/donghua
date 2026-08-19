const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    const pageNum = req.query.page || 1;
    const targetUrl = `https://anichin.moe/anime/?page=${pageNum}&status=&type=&order=update`;

    const html = await cloudscraper.get({
      uri: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const $ = cheerio.load(html);
    const donghuaList = [];

    $('article, div.bs, div.bsx, div.post-show, .listupd .animposx').each((_, element) => {
      const card = $(element);
      
      // Ambil elemen judul
      const titleEl = card.find('.tt, .entry-title, h2, h3').first();
      const linkEl = card.find('a').first();
      const imgEl = card.find('img').first();
      const epEl = card.find('.epx, .bt .epx, .episode, .ep, .typez').first();

      // CARA AMPUH MENCEGAH JUDUL GANDA:
      // Ambil teks dari tag 'a' atau 'h2/h3' paling spesifik
      let rawTitle = titleEl.find('h2, h3').text().trim() || titleEl.text().trim();
      
      // Jika teks terduplikasi (misal: "TitleTitle"), potong jadi satu
      let cleanTitle = rawTitle.replace(/\s+/g, ' ');
      const middle = Math.floor(cleanTitle.length / 2);
      if (cleanTitle.length > 0 && cleanTitle.slice(0, middle) === cleanTitle.slice(middle)) {
        cleanTitle = cleanTitle.slice(0, middle);
      }

      const rawHref = linkEl.attr('href') || '';
      
      // EXTRACT SLUG UNIK MURNI (mencabut domain https://anichin.moe/ dan slash)
      let slug = rawHref.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/|\/$/g, '');

      const poster = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-lazy-src') || '';
      const episode = epEl.text().trim() || 'Ongoing';

      if (cleanTitle && slug) {
        donghuaList.push({
          title: cleanTitle,
          slug: slug,
          poster: poster || 'https://via.placeholder.com/150',
          episode: episode
        });
      }
    });

    const uniqueList = donghuaList.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);

    return res.status(200).json({
      success: true,
      page: parseInt(pageNum),
      total: uniqueList.length,
      data: uniqueList
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Gagal mengambil data: ' + error.message
    });
  }
};
