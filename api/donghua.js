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
      
      // Ambil elemen H2 atau H3 secara spesifik (BUKAN seluruh wadah .tt)
      let titleEl = card.find('h2, h3, .entry-title').first();
      if (!titleEl.length) titleEl = card.find('.tt').first();

      const linkEl = card.find('a').first();
      const imgEl = card.find('img').first();
      const epEl = card.find('.epx, .bt .epx, .episode, .ep, .typez').first();

      let title = titleEl.text().trim().replace(/\s+/g, ' ');

      // LOGIKA PEMBERSIH JUDUL GANDA (Misal: "Lingwu ContinentLingwu Continent")
      const halfLength = Math.floor(title.length / 2);
      const firstHalf = title.slice(0, halfLength).trim();
      const secondHalf = title.slice(halfLength).trim();
      if (firstHalf === secondHalf && firstHalf.length > 0) {
        title = firstHalf;
      }

      const href = linkEl.attr('href') || '';
      const poster = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-lazy-src') || '';
      const episode = epEl.text().trim() || 'Ongoing';

      if (title && href) {
        donghuaList.push({
          title: title,
          href: href,
          poster: poster || 'https://via.placeholder.com/150',
          episode: episode
        });
      }
    });

    const uniqueList = donghuaList.filter((v, i, a) => a.findIndex(t => t.href === v.href) === i);

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
