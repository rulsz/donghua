import * as cheerio from 'cheerio';

// Fungsi bantuan untuk mengambil halaman detail dan mendeteksi total episode
async function fetchDetailEpisode(slug) {
  try {
    const detailUrl = `https://animexin.dev/${slug}/`;
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animexin.dev/'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Mencari teks episode di halaman detail (biasanya ada di list episode / info / .epx)
    let episodeText = '';
    
    // Cek pada list episode atau tabel info halaman detail
    $('.eplister ul li, .episodelist ul li, .info-content, .spe').each((_, el) => {
      const text = $(el).text();
      if (/episode|ep/i.test(text)) {
        episodeText = text;
      }
    });

    // Jika tidak ketemu di list, cari elemen umum yang memuat angka episode di halaman detail
    if (!episodeText) {
      episodeText = $('.infox, .entry-content').text();
    }

    // Ambil angka terbesar atau angka episode yang ditemukan
    const matches = episodeText.match(/(?:Episode|Ep)\s*(\d+)/gi);
    if (matches && matches.length > 0) {
      // Ambil angka dari kecocokan terakhir (biasanya episode terbaru)
      const lastMatch = matches[matches.length - 1].match(/\d+/);
      if (lastMatch) {
        return `Ep ${lastMatch[0]}`;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { type = 'all', page = 1 } = req.query;
    const pageNum = parseInt(page) || 1;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://animexin.dev/anime/'
    };

    // Helper pembersih judul ganda
    const cleanTitle = (rawTitle) => {
      if (!rawTitle) return '';
      const text = rawTitle.trim();
      const halfLength = Math.floor(text.length / 2);
      
      if (text.length % 2 === 0 && text.substring(0, halfLength) === text.substring(halfLength)) {
        return text.substring(0, halfLength).trim();
      }
      
      const words = text.split(/\s+/);
      const halfWords = Math.floor(words.length / 2);
      if (words.length > 1 && words.slice(0, halfWords).join(' ') === words.slice(halfWords).join(' ')) {
        return words.slice(0, halfWords).join(' ');
      }
      return text;
    };

    const parseList = ($, selector) => {
      const result = [];
      $(selector).each((_, el) => {
        let rawTitle = $(el).find('h2, h3, .title, .tt, .entry-title, .series-title').first().text();
        const title = cleanTitle(rawTitle);

        let poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
        let href = $(el).find('a').first().attr('href') || '';
        let status = $(el).find('.status, .typez').first().text().trim() || 'Ongoing';

        if (title && href) {
          const slug = href.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '');
          result.push({ title, poster, slug, status, episode: 'Ep 1', type: 'Donghua' });
        }
      });
      return result;
    };

    const targetUrl = pageNum > 1 
      ? `https://animexin.dev/anime/?page=${pageNum}&status=&type=&order=update` 
      : `https://animexin.dev/anime/?status=&type=&order=update`;

    const response = await fetch(targetUrl, { headers });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: `Status: ${response.status}` });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    let allItems = parseList($, '.listupd .bs, .article .bs, .post-show .bs');

    // Batasi jumlah item yang diambil detailnya agar proses serverless tidak terlalu berat/timeout (misal 15 item pertama)
    const targetItems = allItems.slice(0, 15);
    
    // Ambil nomor episode dari halaman detail masing-masing secara paralel
    const enrichedItems = await Promise.all(targetItems.map(async (item) => {
      const realEpisode = await fetchDetailEpisode(item.slug);
      if (realEpisode) {
        item.episode = realEpisode;
      }
      return item;
    }));

    // Gabungkan kembali dengan sisa item jika ada
    const finalItems = [...enrichedItems, ...allItems.slice(15)];

    if (!type || type === 'all') {
      return res.status(200).json({
        success: true,
        data: {
          popularToday: finalItems.slice(0, 10),
          latest: finalItems.slice(0, 15),
          popularAll: finalItems.slice(5, 15)
        }
      });
    }

    if (type === 'latest') {
      return res.status(200).json({ success: true, page: pageNum, data: finalItems.slice(0, 30) });
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
