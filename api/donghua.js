const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    const { data: html } = await axios.get('https://anichin.moe', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });

    const $ = cheerio.load(html);
    const donghuaList = [];

    $('article, div.bs, div.bsx, div.post-show').each((_, element) => {
      const card = $(element);
      const titleEl = card.find('div.tt, h2, h3, .title').first();
      const linkEl = card.find('a').first();
      const imgEl = card.find('img').first();

      const title = titleEl.text().trim();
      const href = linkEl.attr('href');
      const poster = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-lazy-src') || '';

      if (title && href) {
        donghuaList.push({
          title: title.replace(/\s+/g, ' '),
          href: href,
          poster: poster || 'https://via.placeholder.com/150'
        });
      }
    });

    const uniqueList = donghuaList.filter((v, i, a) => a.findIndex(t => t.href === v.href) === i);

    return res.status(200).json({
      success: true,
      updated: new Date(),
      total: uniqueList.length,
      data: uniqueList
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
