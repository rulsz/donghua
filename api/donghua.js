const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

module.exports = async (req, res) => {
  // Atur Header CORS agar API bisa dipanggil dari web manapun
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  let browser = null;

  try {
    // Jalankan Chromium versi ringan khusus Serverless
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    // Set User-Agent agar tidak terdeteksi bot biasa
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Buka situs Anichin
    await page.goto('https://anichin.moe', { 
      waitUntil: 'domcontentloaded', 
      timeout: 25000 
    });

    // Ambil data kartu donghua dari DOM
    const donghuaList = await page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('article, div.bs, div.bsx, div.post-show');

      cards.forEach(card => {
        const titleEl = card.querySelector('div.tt, h2, h3, .title');
        const linkEl = card.querySelector('a');
        const imgEl = card.querySelector('img');

        if (titleEl && linkEl) {
          const title = titleEl.innerText.trim();
          const href = linkEl.getAttribute('href');
          let poster = imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src')) : '';

          if (href) {
            items.push({
              title: title.replace(/\s+/g, ' '),
              href: href,
              poster: poster || 'https://via.placeholder.com/150'
            });
          }
        }
      });
      return items;
    });

    // Filter duplikat berdasarkan URL
    const uniqueList = donghuaList.filter((v, i, a) => a.findIndex(t => t.href === v.href) === i);

    // Kirim respon JSON
    res.status(200).json({
      success: true,
      updated: new Date(),
      total: uniqueList.length,
      data: uniqueList
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};
