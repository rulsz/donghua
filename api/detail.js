export default async function handler(req, res) {
  let { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ success: false, message: 'Slug/Path diperlukan' });
  }

  // Sanitasi slug dari URL penuh atau prefix
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

  // Jalur Proxy 1: AllOrigins (CORS Bypass)
  for (const variant of slugVariants) {
    const targetUrl = `https://anichin.site/anime/${variant}/`;
    
    try {
      const res1 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
      if (res1.ok) {
        const json1 = await res1.json();
        if (json1.contents && (json1.contents.includes('eplister') || json1.contents.includes('entry-title'))) {
          rawHtml = json1.contents;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }

  // Jalur Proxy 2: Corsproxy Fallback
  if (!rawHtml) {
    for (const variant of slugVariants) {
      const targetUrl = `https://anichin.site/anime/${variant}/`;
      try {
        const res2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
        if (res2.ok) {
          const text2 = await res2.text();
          if (text2 && (text2.includes('eplister') || text2.includes('entry-title'))) {
            rawHtml = text2;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  if (!rawHtml) {
    return res.status(404).json({ success: false, message: 'Detail donghua tidak ditemukan' });
  }

  try {
    // Ekstraksi Judul
    const titleMatch = rawHtml.match(/<h1[^>]*class="entry-title"[^>]*>(.*?)<\/h1>/i) || rawHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Judul Donghua';

    // Ekstraksi Poster Image
    const posterMatch = rawHtml.match(/<div[^>]*class="[^\"]*thumb[^\"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i) || rawHtml.match(/<img[^>]*src="([^"]+)"/i);
    const poster = posterMatch ? posterMatch[1] : '';

    // Ekstraksi Sinopsis
    const synopsisMatch = rawHtml.match(/<div[^>]*class="entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    let synopsis = synopsisMatch ? synopsisMatch[1].replace(/<[^>]+>/g, '').trim() : 'Tidak ada deskripsi.';

    // Ekstraksi List Episode
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
    return res.status(500).json({ success: false, message: 'Gagal mengekstrak data detail' });
  }
}
