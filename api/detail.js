export default async function handler(req, res) {
  let { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ success: false, message: 'Slug diperlukan' });
  }

  // Sanitasi slug
  const cleanSlug = String(slug)
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/anime\//, '')
    .replace(/^\/episode\//, '')
    .replace(/^\/+|\/+$/g, '');

  const slugVariants = [
    cleanSlug,
    `${cleanSlug}-sub-indo`,
    cleanSlug.replace(/-sub-indo$/, '')
  ];

  let rawHtml = '';

  // Gunakan Scraper Proxy yang mengembalikan HTML murni tanpa konversi Markdown
  for (const variant of slugVariants) {
    const targetUrl = `https://anichin.site/anime/${variant}/`;
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (response.ok) {
        const json = await response.json();
        if (json.contents && (json.contents.includes('eplister') || json.contents.includes('entry-title'))) {
          rawHtml = json.contents;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }

  if (!rawHtml) {
    return res.status(404).json({ success: false, message: 'Donghua tidak ditemukan' });
  }

  try {
    // Regex parsing ringan tanpa kebergantungan DOMParser/Cheerio yang rentan crash
    const titleMatch = rawHtml.match(/<h1[^>]*class="entry-title"[^>]*>(.*?)<\/h1>/i) || rawHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Judul Donghua';

    const posterMatch = rawHtml.match(/<div[^>]*class="[^\"]*thumb[^\"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i) || rawHtml.match(/<img[^>]*src="([^"]+)"/i);
    const poster = posterMatch ? posterMatch[1] : '';

    const synopsisMatch = rawHtml.match(/<div[^>]*class="entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    let synopsis = synopsisMatch ? synopsisMatch[1].replace(/<[^>]+>/g, '').trim() : 'Tidak ada deskripsi.';

    // Extract Episode List
    const episodes = [];
    const epRegex = /<li[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;
    let match;

    while ((match = epRegex.exec(rawHtml)) !== null) {
      const href = match[1];
      const content = match[2];
      
      const epSlug = href.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
      const epTitleMatch = content.match(/class="epl-title"[^>]*>(.*?)<\/div>/i);
      const epTitle = epTitleMatch ? epTitleMatch[1].trim() : content.replace(/<[^>]+>/g, '').trim();

      if (epSlug && !episodes.some(e => e.slug === epSlug)) {
        episodes.push({ title: epTitle, slug: epSlug });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        title,
        poster,
        synopsis,
        episodes
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal ekstrak detail' });
  }
}
